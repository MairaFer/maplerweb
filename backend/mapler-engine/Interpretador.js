 // interpretador.js
//import { Vetor } from '../vetor.js';
import { Ambiente } from './ambiente.js';
import { converterInputString } from './checadorTipos.js';

// Classe auxiliar para guardar a definição de um módulo e torná-lo "chamável"
class ModuloChamavel {
    constructor(declaracao) {
      this.declaracao = declaracao; // nó Decl.Modulo
    }
    
    async chamar(interpretador, argumentos = []) {
      // Guarda o ambiente atual
      const ambienteAnterior = interpretador.ambiente;
  
      // Cria um novo ambiente local, encadeado
      const ambienteLocal = new Ambiente(ambienteAnterior);
      interpretador.ambiente = ambienteLocal;
  
      try {
        // Liga parâmetros formais aos argumentos recebidos
        const params = this.declaracao.parametros || [];
        for (let i = 0; i < params.length; i++) {
          const param = params[i];
          const valorArg = i < argumentos.length ? argumentos[i] : null;
  
          // O tipo está em param.tipo (token de tipo), o nome em param.nome (token IDENTIFICADOR)
          ambienteLocal.definir(param.nome.lexema, param.tipo.tipo, valorArg);
        }
  
        // Executa o corpo do módulo no ambiente local
        await interpretador.executarBloco(this.declaracao.corpo, ambienteLocal);
        interpretador.ambiente = ambienteAnterior;
        return null;
      } catch (erro) {
        // Se for o nosso “retorne”
        interpretador.ambiente = ambienteAnterior; // restaura antes de retornar
        if (erro?.tipo === 'RETORNO_FUNCAO') return erro.valor;
            throw erro;  // Erros reais sobem
      }
  
    //   // Se terminou sem 'retorne', restaura e devolve null
    //   interpretador.ambiente = ambienteAnterior;
    //   return null;
    }
  }
  

export class Interpretador {
    constructor(eventosService, entradas = []) {
      this.eventosService = eventosService;
      this.ambiente = new Ambiente();
      this.resolverInput = null;
      this.entradas = Array.isArray(entradas) ? [...entradas] : [];
   }

    async interpretar(ast) {
      if (!ast) {
          this.erro("Erro de sintaxe impediu a execucao.");
          return;
      }
      
      this.ambiente = new Ambiente();

      try {
      if (Array.isArray(ast.variaveis)) {
        for (const declaracao of ast.variaveis) {
          await this.executarDeclaracao(declaracao);
        }
      }

      if (Array.isArray(ast.modulos)) {
        for (const modulo of ast.modulos) {
          await this.executarDeclaracao(modulo);
        }
      }

      if (Array.isArray(ast.corpo)) {
        for (const declaracao of ast.corpo) {
          await this.executarDeclaracao(declaracao);
        }
      }
    } catch (erro) {
      if (erro?.tipo === 'RETORNO_FUNCAO') return;
      this.erro(erro.message || String(erro));
    }
}
    async executarBloco(bloco, ambiente = this.ambiente) {
        const ambienteAnterior = this.ambiente;
        this.ambiente = ambiente;
        
         try {
            const declaracoes = Array.isArray(bloco) ? bloco : bloco?.declaracoes || [];
            for (const declaracao of declaracoes) {
                await this.executarDeclaracao(declaracao);
            }
        } finally {
            this.ambiente = ambienteAnterior;
        }
    }
        // for (const declaracao of bloco.declaracoes) {
        //     await this.executarDeclaracao(declaracao);
        // }

    async executarDeclaracao(declaracao) {
        if (!declaracao) return null;

        if (typeof declaracao.aceitar === 'function') {
          return await declaracao.aceitar(this);
        }

        const nomeMetodo = `visitar${declaracao.tipo}`;
    if (typeof this[nomeMetodo] === 'function') {
      return await this[nomeMetodo](declaracao);
    }

    throw new Error(`Declaração não suportada: ${declaracao.tipo}`);
  }

  async avaliarExpressao(expr) {
    if (!expr) return null;

    if (typeof expr.aceitar === 'function') {
      return await expr.aceitar(this);
    }

    const nomeMetodo = `visitar${expr.tipo}`;
    if (typeof this[nomeMetodo] === 'function') {
      return await this[nomeMetodo](expr);
    }

    throw new Error(`Expressão não suportada: ${expr.tipo}`);
  }

    async visitarPrograma(declaracao) {
        return this.interpretar(declaracao);
    }

    async visitarBloco(declaracao) {
        const ambienteLocal = new Ambiente(this.ambiente);
        await this.executarBloco(declaracao, ambienteLocal);
    }

    // --- MÉTODOS DE VISITAÇÃO PARA DECLARAÇÕES ---

    async visitarVarDeclaracoes(declaracao) {
        for (const variavel of declaracao.variaveis) {
            await this.executarDeclaracao(variavel);
        }
    }

    visitarVar(declaracao) {
        const criar = (nivel) => {
            if (nivel === declaracao.dimensoes.length) return null;
            const tamanho = declaracao.dimensoes[nivel];
            if (!Number.isSafeInteger(tamanho) || tamanho <= 0) throw new Error('Dimensao invalida.');
            return Array.from({ length: tamanho }, () => criar(nivel + 1));
        };
        this.ambiente.definir(declaracao.nome.lexema, declaracao.tipoDado.tipo, criar(0));
    }

    async resolverElemento(expr) {
        let recipiente = this.ambiente.obter(expr.nome);
        if (!expr.indices.length) throw new Error('Esperado indice do vetor.');
        for (let nivel = 0; nivel < expr.indices.length; nivel++) {
            const indice = await this.avaliarExpressao(expr.indices[nivel]);
            if (!Array.isArray(recipiente)) throw new Error(`Quantidade de indices invalida para '${expr.nome.lexema}'.`);
            if (!Number.isInteger(indice) || indice < 0 || indice >= recipiente.length) {
                throw new Error(`Indice fora dos limites de '${expr.nome.lexema}': ${indice}.`);
            }
            if (nivel === expr.indices.length - 1) {
                if (Array.isArray(recipiente[indice])) throw new Error(`Faltam indices para '${expr.nome.lexema}'.`);
                return { recipiente, indice };
            }
            recipiente = recipiente[indice];
        }
    }

    async visitarVariavelArray(expr) {
        const { recipiente, indice } = await this.resolverElemento(expr);
        return recipiente[indice];
    }

    async visitarAtribuicaoArray(expr) {
        const { recipiente, indice } = await this.resolverElemento(expr);
        const valor = await this.avaliarExpressao(expr.valor);
        // Reutiliza a validacao de tipos das atribuicoes escalares.
        const validacao = new Ambiente();
        validacao.definir(expr.nome.lexema, this.ambiente.obterTipo(expr.nome));
        validacao.atribuir(expr.nome, valor);
        recipiente[indice] = valor;
        return valor;
    }

    async visitarExpressao(declaracao) {
        await this.avaliarExpressao(declaracao.expressao);
    }

    async visitarAtribuicao(expr) {
        const valor = await this.avaliarExpressao(expr.valor);
        this.ambiente.atribuir(expr.nome, valor);
        return valor;
    }

    async visitarEscreva(declaracao) {
        const partes = [];

        for (const expr of declaracao.expressoes) {
            const valor = await this.avaliarExpressao(expr);

            if (typeof valor === 'boolean') {
                partes.push(valor ? 'verdadeiro' : 'falso');
            } else if (valor === null || valor === undefined) {
                partes.push('nulo');
            } else {
                partes.push(String(valor));
            }
        }

        this.eventosService?.notificar('ESCREVER', partes.join(''));
    }

    async visitarSe(declaracao) {
        const condicao = await  this.avaliarExpressao(declaracao.condicao);
        if (condicao) {
            await this.executarBloco(declaracao.entaoBloco, new Ambiente(this.ambiente));
            return;
        } 
        if (declaracao.senaoBloco) {
            await this.executarBloco(declaracao.senaoBloco, new Ambiente(this.ambiente));
            return;
        }
    }

    async visitarEnquanto(declaracao) {
        while (await this.avaliarExpressao(declaracao.condicao)) {
            await this.executarBloco(declaracao.corpo, new Ambiente(this.ambiente));
        }
    }
    
      async visitarPara(declaracao) {
        await this.avaliarExpressao(declaracao.inicializacao);

        while (await this.avaliarExpressao(declaracao.condicao)) {
            await this.executarBloco(declaracao.corpo, new Ambiente(this.ambiente));
            await this.avaliarExpressao(declaracao.incremento);
        }
      }

    async visitarRepita(declaracao) {
        do {
            await this.executarBloco(declaracao.corpo, new Ambiente(this.ambiente));
        } while (!(await this.avaliarExpressao(declaracao.condicao)));
    }

    async visitarLer(declaracao) {
        if (!this.entradas.length) {
            this.eventosService?.notificar('INPUT_SOLICITADO');
            throw new Error('Nenhuma entrada foi fornecida para o comando ler.');
        }
        const alvo = declaracao.variavel;
        const tipo = this.ambiente.obterTipo(alvo.nome);
        const valor = converterInputString(String(this.entradas.shift()), tipo);
        if (alvo.tipo === 'VariavelArray') {
            return this.visitarAtribuicaoArray({ ...alvo, valor: { tipo: 'Literal', valor } });
        }
        return this.ambiente.atribuir(alvo.nome, valor);
    }

    async visitarModulo(declaracao) {
        const modulo = new ModuloChamavel(declaracao);
        // ATRIBUI a definição do módulo à variável já declarada.
       this.ambiente.definir(declaracao.nome.lexema, 'TIPO_MODULO', modulo);
    }

    async visitarChamadaModulo(declaracao) {
        return this.visitarChamada({
            callee: { tipo: 'Variavel', nome: declaracao.identificador },
            argumentos: declaracao.argumentos || [],
        });
    }

    visitarLiteral(expr) {
    return expr.valor;
  }

  visitarVariavel(expr) {
    return this.ambiente.obter(expr.nome);
  }

  async visitarGrupo(expr) {
    return await this.avaliarExpressao(expr.expressao);
  }

  async visitarExpParentizada(expr) {
    return await this.avaliarExpressao(expr.grupo);
  }

  async visitarBinario(expr) {
    const esquerda = await this.avaliarExpressao(expr.esquerda);
    const direita = await this.avaliarExpressao(expr.direita);
    return this.avaliarOperacaoBinaria(expr.operador.tipo, esquerda, direita);
  }

  async visitarLogico(expr) {
    const esquerda = await this.avaliarExpressao(expr.esquerda);

    if (expr.operador.tipo === 'OU') {
      if (Boolean(esquerda)) return true;
    } else {
      if (!Boolean(esquerda)) return false;
    }

    return Boolean(await this.avaliarExpressao(expr.direita));
  }

  async visitarUnario(expr) {
    const direita = await this.avaliarExpressao(expr.direita);

    switch (expr.operador.tipo) {
      case 'NAO':
        return !Boolean(direita);
      case 'MENOS':
        return -direita;
      default:
        throw new Error(`Operador unário não suportado: ${expr.operador.tipo}`);
    }
  }

  async visitarChamada(expr) {
    const calleeValor = await this.avaliarExpressao(expr.callee);
    const argumentos = [];

    for (const argumento of expr.argumentos) {
      argumentos.push(await this.avaliarExpressao(argumento));
    }

    if (calleeValor instanceof ModuloChamavel) {
      return await calleeValor.chamar(this, argumentos);
    }

    throw new Error('Tentativa de chamar algo que não é módulo/função.');
  }

  avaliarOperacaoBinaria(operadorTipo, esquerda, direita) {
    switch (operadorTipo) {
      case 'MAIS':
        return esquerda + direita;
      case 'MENOS':
        return esquerda - direita;
      case 'ASTERISCO':
        return esquerda * direita;
      case 'BARRA':
        return esquerda / direita;
      case 'RESTO':
        return esquerda % direita;
      case 'POTENCIA':
        return esquerda ** direita;
      case 'IGUAL':
        return esquerda === direita;
      case 'DIFERENTE':
        return esquerda !== direita;
      case 'MAIOR_QUE':
        return esquerda > direita;
      case 'MENOR_QUE':
        return esquerda < direita;
      case 'MAIOR_IGUAL':
        return esquerda >= direita;
      case 'MENOR_IGUAL':
        return esquerda <= direita;
      default:
        throw new Error(`Operador binário não implementado: ${operadorTipo}`);
    }
  }

  async visitarRetorne(declaracao) {
    let valor = null;
    if (declaracao.valor) {
      valor = await this.avaliarExpressao(declaracao.valor);
    }
    throw { tipo: 'RETORNO_FUNCAO', valor };
  }

  visitarFim() {
    return null;
  }

  erro(mensagem) {
    this.eventosService?.notificar('ERRO', mensagem);
    throw new Error(mensagem);
  }
      
}