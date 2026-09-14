// Arquivo: TranspiladorPython.js (Versão Final Visitor)

class EscritorDeCodigo {
    constructor() { this.codigo = ''; this.nivelIndentacao = 0; }
    reset() { this.codigo = ''; this.nivelIndentacao = 0; return this; }
    adicionar(texto) { this.codigo += texto; return this; }
    adicionarLinha(texto) { this.codigo += '    '.repeat(this.nivelIndentacao) + texto + '\n'; return this; }
    indentar() { this.nivelIndentacao++; return this; }
    removerIndentacao() { if (this.nivelIndentacao > 0) { this.nivelIndentacao--; } return this; }
    getResultado() { return this.codigo; }
}

export class TranspiladorPython {
    constructor() {
        this.escritor = new EscritorDeCodigo();
        this.operadores = new Map([
            ['E', 'and'], ['OU', 'or'], ['NAO', 'not '],
            ['IGUAL', '=='], ['DIFERENTE', '!='],
            ['MAIOR_QUE', '>'], ['MAIOR_IGUAL', '>='],
            ['MENOR_QUE', '<'], ['MENOR_IGUAL', '<='],
            ['MAIS', '+'], ['MENOS', '-'],
            ['ASTERISCO', '*'], ['BARRA', '/'], ['RESTO', '%']
        ]);
    }

    transpilar(ast) {
        this.escritor.reset();
        this.tipos = new Map();
        if (ast && ast.aceitar) ast.aceitar(this);
        return this.escritor.getResultado();
    }

    visitar(no) {
        if (no && no.aceitar) return no.aceitar(this);
        return "";
    }

    visitarPrograma(no) {
        this.escritor.adicionarLinha("# Mapler -> Python");
        this.escritor.adicionarLinha("import sys");
        this.escritor.adicionarLinha("");

        for (const v of no.variaveis) this.visitar(v);
        this.escritor.adicionarLinha("");

        for (const m of no.modulos) {
            this.visitar(m);
            this.escritor.adicionarLinha("");
        }

        this.escritor.adicionarLinha("if __name__ == '__main__':");
        this.escritor.indentar();
        if (no.corpo.length === 0) this.escritor.adicionarLinha("pass");
        else {
            for (const stmt of no.corpo) {
const res = this.visitar(stmt);
                if (typeof res === 'string' && res.trim().length > 0) {
                    this.escritor.adicionarLinha(res); // Python não usa ';', mas precisa escrever a linha se for uma expressão
                }
            }
        }
        this.escritor.removerIndentacao();
    }

    visitarVarDeclaracoes(no) {
        for (const variavel of no.variaveis) this.visitar(variavel);
    }

    visitarVar(no) {
        this.tipos ??= new Map();
        this.tipos.set(no.nome.lexema, no.tipoDado.tipo);
        if (no.tipoDado.tipo === 'TIPO_MODULO') return;
        let valor = 'None';
        for (const tamanho of [...no.dimensoes].reverse()) {
            if (!Number.isSafeInteger(tamanho) || tamanho <= 0) throw new Error('Dimensao invalida.');
            valor = `[${valor} for _ in range(${tamanho})]`;
        }
        this.escritor.adicionarLinha(`${no.nome.lexema} = ${valor}`);
    }

    visitarFim() { return null; }

    visitarModulo(no) {
        const tiposAnteriores = this.tipos;
        this.tipos = new Map(this.tipos);
        for (const p of no.parametros) this.tipos.set(p.nome.lexema, p.tipo.tipo);
        const params = no.parametros.map(p => p.nome.lexema).join(", ");
        this.escritor.adicionarLinha(`def ${no.nome.lexema}(${params}):`);
        this.escritor.indentar();
        this.visitar(no.corpo);
        this.escritor.removerIndentacao();
        this.tipos = tiposAnteriores;
    }

    visitarBloco(no) {
        if (no.declaracoes.length === 0) {
            this.escritor.adicionarLinha("pass");
        } else {
            for (const decl of no.declaracoes) {
                const res = this.visitar(decl);
                // Python não usa ';', mas precisa escrever a linha se for uma expressão
                if (typeof res === 'string' && res.trim().length > 0) {
                    this.escritor.adicionarLinha(res);
                }
            }
        }
    }

    visitarEscreva(no) {
        const args = no.expressoes.map(e => `str(${this.visitar(e)})`).join(" + ");
        this.escritor.adicionarLinha(`print(${args})`);
    }

    visitarLer(no) {
        const nome = this.visitar(no.variavel);
        const tipo = this.tipos.get(no.variavel.nome.lexema);
        const conversores = {
            TIPO_INTEIRO: 'int(input())',
            TIPO_REAL: 'float(input())',
            TIPO_LOGICO: "{'verdadeiro': True, 'falso': False}[input().lower()]",
        };
        this.escritor.adicionarLinha(`${nome} = ${conversores[tipo] || 'input()'}`);
    }

    visitarSe(no) {
        this.escritor.adicionarLinha(`if ${this.visitar(no.condicao)}:`);
        this.escritor.indentar();
        this.visitar(no.entaoBloco);
        this.escritor.removerIndentacao();
        if (no.senaoBloco) {
            this.escritor.adicionarLinha("else:");
            this.escritor.indentar();
            this.visitar(no.senaoBloco);
            this.escritor.removerIndentacao();
        }
    }

    visitarEnquanto(no) {
        this.escritor.adicionarLinha(`while ${this.visitar(no.condicao)}:`);
        this.escritor.indentar();
        this.visitar(no.corpo);
        this.escritor.removerIndentacao();
    }

    visitarPara(no) {
        this.escritor.adicionarLinha(`# Para -> While`);
        this.escritor.adicionarLinha(this.visitar(no.inicializacao));
        this.escritor.adicionarLinha(`while ${this.visitar(no.condicao)}:`);
        this.escritor.indentar();
        this.visitar(no.corpo);
        this.escritor.adicionarLinha(this.visitar(no.incremento));
        this.escritor.removerIndentacao();
    }
    
    visitarRepita(no) {
        this.escritor.adicionarLinha(`while True:`);
        this.escritor.indentar();
        this.visitar(no.corpo);
        this.escritor.adicionarLinha(`if ${this.visitar(no.condicao)}: break`);
        this.escritor.removerIndentacao();
    }

    visitarRetorne(no) {
        const valor = no.valor ? this.visitar(no.valor) : "";
        this.escritor.adicionarLinha(`return ${valor}`);
    }

   visitarChamadaModulo(no) {
        return `${no.identificador.lexema}(${(no.argumentos || []).map(a => this.visitar(a)).join(", ")})`;
    }
    // Expressões
    visitarAtribuicao(no) { return `${no.nome.lexema} = ${this.visitar(no.valor)}`; }
    visitarBinario(no) { return `(${this.visitar(no.esquerda)} ${this.operadores.get(no.operador.tipo)} ${this.visitar(no.direita)})`; }
    visitarLiteral(no) {
        if (typeof no.valor === 'string') return `'${no.valor}'`;
        if (typeof no.valor === 'boolean') return no.valor ? 'True' : 'False';
        return no.valor;
    }
    visitarVariavel(no) { return no.nome.lexema; }
    visitarChamada(no) {
        const args = no.argumentos.map(a => this.visitar(a)).join(", ");
        return `${no.callee.nome.lexema}(${args})`;
    }
    visitarVariavelArray(no) {
        const indices = no.indices.map(i => `[${this.visitar(i)}]`).join("");
        return `${no.nome.lexema}${indices}`;
    }
    visitarAtribuicaoArray(no) {
        const indices = no.indices.map(i => `[${this.visitar(i)}]`).join("");
        return `${no.nome.lexema}${indices} = ${this.visitar(no.valor)}`;
    }
    visitarLogico(no) { return this.visitarBinario(no); }
    visitarUnario(no) { return `${this.operadores.get(no.operador.tipo)}(${this.visitar(no.direita)})`; }
    visitarGrupo(no) { return `(${this.visitar(no.expressao)})`; }
    visitarExpParentizada(no) { return `(${this.visitar(no.grupo.expressao)})`; }
}
