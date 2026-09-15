// Geração a partir da AST: nenhuma substituição textual do código-fonte.
import { criarNomesDestino } from './NomesDestino.js';
export const LINGUAGENS = Object.freeze({
  c: { nome: 'C', arquivo: 'programa.c' },
  cpp: { nome: 'C++', arquivo: 'programa.cpp' },
  coffeescript: { nome: 'CoffeeScript', arquivo: 'programa.coffee' },
  java: { nome: 'Java', arquivo: 'Programa.java' },
  javascript: { nome: 'JavaScript', arquivo: 'programa.js' },
  pascal: { nome: 'Pascal', arquivo: 'programa.pas' },
  python: { nome: 'Python', arquivo: 'programa.py' },
  ruby: { nome: 'Ruby', arquivo: 'programa.rb' },
  typescript: { nome: 'TypeScript', arquivo: 'programa.ts' },
});

const TIPOS = { TIPO_INTEIRO: 'int', TIPO_REAL: 'real', TIPO_CADEIA: 'text', TIPO_CARACTERE: 'text', TIPO_LOGICO: 'bool', TIPO_MODULO: 'void' };
const COMPARACOES = ['IGUAL', 'DIFERENTE', 'MAIOR_QUE', 'MAIOR_IGUAL', 'MENOR_QUE', 'MENOR_IGUAL', 'E', 'OU'];
const OPS = { MAIS: '+', MENOS: '-', ASTERISCO: '*', BARRA: '/', RESTO: '%', POTENCIA: '**', IGUAL: '==', DIFERENTE: '!=', MAIOR_QUE: '>', MAIOR_IGUAL: '>=', MENOR_QUE: '<', MENOR_IGUAL: '<=', E: '&&', OU: '||' };

export class TranspiladorMultilinguagem {
  constructor(linguagem = 'python') {
    if (!Object.hasOwn(LINGUAGENS, linguagem)) throw new Error('Linguagem de destino não suportada.');
    this.lang = linguagem;
    this.js = ['javascript', 'typescript'].includes(linguagem);
    this.chaves = ['c', 'cpp', 'java', 'javascript', 'typescript'].includes(linguagem);
  }

  falha(no, mensagem) { throw new Error(`Linha ${no?.linha ?? '?'}: ${mensagem}`); }
  linha(texto = '') { this.linhas.push('    '.repeat(this.nivel) + texto); }
  nome(nome, modulo = false) {
    const chave = `${modulo ? 'f' : 'v'}:${nome}`;
    if (!this.nomes.has(chave)) this.nomes.set(chave, this.alocarNome(nome));
    const id = this.nomes.get(chave);
    return this.lang === 'ruby' && !modulo && !this.parametros.has(nome) ? `$${id}` : id;
  }
  tipoToken(token) {
    const tipo = TIPOS[token?.tipo];
    if (!tipo) this.falha(token, 'Tipo não suportado na tradução.');
    return tipo;
  }
  simbolo(no) {
    const simbolo = this.escopo.get(no.nome.lexema);
    if (!simbolo) this.falha(no, `Variável '${no.nome.lexema}' não declarada.`);
    return simbolo;
  }
  tipo(no) {
    if (!no) return 'void';
    switch (no.tipo) {
      case 'Literal': return typeof no.valor === 'string' ? 'text' : typeof no.valor === 'boolean' ? 'bool' : Number.isInteger(no.valor) ? 'int' : 'real';
      case 'Variavel': case 'VariavelArray': return this.simbolo(no).tipo;
      case 'Atribuicao': case 'AtribuicaoArray': return this.tipo(no.valor);
      case 'Grupo': return this.tipo(no.expressao);
      case 'ExpParentizada': return this.tipo(no.grupo);
      case 'Unario': return no.operador.tipo === 'NAO' ? 'bool' : this.tipo(no.direita);
      case 'Logico': return 'bool';
      case 'Binario': {
        if (COMPARACOES.includes(no.operador.tipo)) return 'bool';
        const a = this.tipo(no.esquerda), b = this.tipo(no.direita);
        if (no.operador.tipo === 'MAIS' && (a === 'text' || b === 'text')) return 'text';
        if (a === 'unknown' || b === 'unknown') return 'unknown';
        return ['BARRA', 'POTENCIA'].includes(no.operador.tipo) || a === 'real' || b === 'real' ? 'real' : 'int';
      }
      case 'Chamada': case 'ChamadaModulo': {
        const nome = no.callee?.nome?.lexema ?? no.identificador?.lexema;
        if (!this.modulos.has(nome)) this.falha(no, `Módulo '${nome}' não declarado.`);
        return this.retornos.get(nome) ?? 'unknown';
      }
      default: this.falha(no, `Expressão '${no.tipo}' não suportada.`);
    }
  }
  visitarNos(no, fn) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) { for (const item of no) this.visitarNos(item, fn); return; }
    if (no.tipo) fn(no);
    for (const [chave, valor] of Object.entries(no)) if (chave !== 'token' && chave !== 'nome') this.visitarNos(valor, fn);
  }
  escopoModulo(modulo) {
    this.escopo = new Map(this.globais);
    this.parametros = new Set();
    for (const p of modulo?.parametros ?? []) {
      this.escopo.set(p.nome.lexema, { tipo: this.tipoToken(p.tipo), dimensoes: [] });
      this.parametros.add(p.nome.lexema);
    }
  }

  transpilar(ast) {
    const originais = [];
    this.visitarNos(ast, no => { if (no.nome?.lexema) originais.push(no.nome.lexema); });
    for (const modulo of ast.modulos) for (const parametro of modulo.parametros) originais.push(parametro.nome.lexema);
    this.alocarNome = criarNomesDestino(this.lang, originais);
    this.temLeitura = false;
    this.visitarNos(ast, no => { if (no.tipo === 'Ler') this.temLeitura = true; });
    this.auxiliares = [];
    this.linhas = []; this.nivel = 0; this.nomes = new Map(); this.parametros = new Set();
    this.globais = new Map(); this.retornos = new Map();
    this.modulos = new Map(ast.modulos.map(m => [m.nome.lexema, m]));
    this.variaveis = ast.variaveis.flatMap(v => v.variaveis ?? [v]).filter(v => this.tipoToken(v.tipoDado) !== 'void');
    for (const v of this.variaveis) {
      if (this.globais.has(v.nome.lexema)) this.falha(v, 'Variável declarada mais de uma vez.');
      if (v.dimensoes.some(d => !Number.isSafeInteger(d) || d <= 0) || v.dimensoes.reduce((a, b) => a * b, 1) > 1000000) this.falha(v, 'Dimensões de vetor inválidas ou muito grandes.');
      this.globais.set(v.nome.lexema, { tipo: this.tipoToken(v.tipoDado), dimensoes: v.dimensoes });
      this.nome(v.nome.lexema);
    }
    // Propaga retornos entre módulos, inclusive chamadas adiantadas e recursão.
    for (let rodada = 0; rodada <= ast.modulos.length + 1; rodada++) {
      for (const m of ast.modulos) {
        this.escopoModulo(m);
        const tipos = [];
        this.visitarNos(m.corpo, n => { if (n.tipo === 'Retorne') tipos.push(this.tipo(n.valor)); });
        const conhecidos = tipos.filter(t => t !== 'unknown');
        let tipo = conhecidos[0] ?? (tipos.length ? 'unknown' : 'void');
        for (const t of conhecidos) {
          if (t === tipo) continue;
          if (['int', 'real'].includes(t) && ['int', 'real'].includes(tipo)) tipo = 'real';
          else this.falha(m, 'O módulo retorna tipos incompatíveis.');
        }
        this.retornos.set(m.nome.lexema, tipo);
      }
    }
    for (const m of ast.modulos) if (this.retornos.get(m.nome.lexema) === 'unknown') this.falha(m, 'Não foi possível inferir o tipo de retorno do módulo.');
    this.cNativo = this.lang === 'c';
    this.leituraTexto = false;
    this.leituraNumero = false;
    const analisarC = no => {
      if (no.tipo === 'Ler') {
        if (this.tipo(no.variavel) === 'text') this.leituraTexto = true;
        else this.leituraNumero = true;
      }
      if (no.tipo === 'Binario' && no.operador.tipo === 'MAIS' && this.tipo(no) === 'text') this.cNativo = false;
    };
    this.escopoModulo(null);
    this.visitarNos(ast.corpo, analisarC);
    for (const m of ast.modulos) {
      this.escopoModulo(m);
      if (this.retornos.get(m.nome.lexema) === 'text' || m.parametros.some(p => this.tipoToken(p.tipo) === 'text')) this.cNativo = false;
      this.visitarNos(m.corpo, analisarC);
    }
    this.variaveisLocais = this.cNativo && ast.modulos.length === 0;
    this.escopoModulo(null);
    this.cabecalho();
    if (this.lang === 'java') { this.linha('public class Programa {'); this.nivel++; if (this.temLeitura) this.linha('static final java.util.Scanner entrada = new java.util.Scanner(System.in);'); }
    if (this.lang !== 'pascal') this.ajudantes();
    if (this.lang === 'pascal' && this.variaveis.length) this.linha('var');
    if (!this.variaveisLocais) for (const v of this.variaveis) this.declarar(v);
    if (this.cNativo && !this.variaveisLocais && this.leituraNumero && this.leituraTexto) this.linha('char entrada[4096];');
    if (this.lang === 'pascal') this.ajudantes();
    this.linha();
    if (['c', 'cpp', 'pascal'].includes(this.lang)) for (const m of ast.modulos) this.linha(this.assinatura(m) + (this.lang === 'pascal' ? '; forward;' : ';'));
    for (const m of ast.modulos) this.modulo(m);
    this.escopoModulo(null);
    this.moduloAtual = null;
    if (this.lang === 'java') this.linha('public static void main(String[] args) {');
    else if (['c', 'cpp'].includes(this.lang)) this.linha('int main(void) {');
    else if (this.lang === 'pascal') this.linha('begin');
    else if (this.lang === 'python') this.linha('if __name__ == "__main__":');
    if (['java', 'c', 'cpp', 'pascal', 'python'].includes(this.lang)) this.nivel++;
    if (this.variaveisLocais) {
      for (const v of this.variaveis) this.declarar(v);
      if (this.leituraNumero && this.leituraTexto) this.linha('char entrada[4096];');
      if (this.variaveis.length) this.linha();
    }
    this.bloco(ast.corpo);
    if (['c', 'cpp'].includes(this.lang)) this.linha('return 0;');
    if (['java', 'c', 'cpp', 'pascal', 'python'].includes(this.lang)) this.nivel--;
    if (['java', 'c', 'cpp'].includes(this.lang)) this.linha('}');
    if (this.lang === 'pascal') this.linha('end.');
    if (this.lang === 'java') { this.nivel--; this.linha('}'); }
    return this.finalizar();
  }

  cabecalho() {
    this.linha('@@MAPLER_HEADER@@');
    if (this.js && this.temLeitura) {
      if (this.lang === 'typescript') this.linha('declare function require(id: string): { readFileSync(fd: number, encoding: string): string };');
      this.linha('const maplerEntradas = require("fs").readFileSync(0, "utf8").replace(/\\r\\n?/g, "\\n").split("\\n");');
      this.linha('let maplerIndice = 0;');
    }
    if (this.lang === 'coffeescript' && this.temLeitura) this.linha('maplerEntradas = require("fs").readFileSync(0, "utf8").replace(/\\r\\n?/g, "\\n").split("\\n")\nmaplerIndice = 0');
    this.linha();
  }

  ajudantes() {
    const programa = this.linhas;
    this.linhas = [];
    this.emitirAjudantes();
    for (const trecho of this.linhas) {
      // Cada declaração fica independente, inclusive nos destinos com indentação.
      for (const codigo of trecho.split(/\n(?=(?:def |function |mapler\w+ =))/)) {
        const nome = codigo.match(/\b(mapler\w+)(?=\s*(?:\(|=|:|\n|$))/)?.[1] ?? (codigo.includes('typedef struct') ? 'MaplerTexto' : null);
        if (nome) this.auxiliares.push({ nome, codigo });
      }
    }
    this.linhas = programa;
    this.linha('@@MAPLER_HELPERS@@');
  }

  finalizar() {
    const identificadores = codigo => codigo.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, ' ');
    let corpo = this.linhas.join('\n');
    const necessarios = new Set();
    let referencias = identificadores(corpo);
    // Inclui dependências transitivas: ler texto, por exemplo, precisa do tipo e do construtor.
    for (let rodada = 0; rodada < this.auxiliares.length; rodada++) {
      let mudou = false;
      for (const ajuda of this.auxiliares) {
        if (!necessarios.has(ajuda.nome) && new RegExp(`\\b${ajuda.nome}\\b`).test(referencias)) {
          necessarios.add(ajuda.nome);
          referencias += '\n' + identificadores(ajuda.codigo);
          mudou = true;
        }
      }
      if (!mudou) break;
    }
    corpo = corpo.replace(/^[ \t]*@@MAPLER_HELPERS@@/m, this.auxiliares.filter(a => necessarios.has(a.nome)).map(a => a.codigo).join('\n'));
    const usado = identificadores(corpo);
    let cabecalho = '';
    if (this.lang === 'c' || this.lang === 'cpp') {
      const bibliotecas = this.lang === 'c' ? [
        ['stdio.h', /\b(?:puts|fputs|printf|scanf|putchar|fgets|snprintf|stdin|stdout|stderr)\b/],
        ['stdlib.h', /\b(?:exit|strtoll|strtod|NULL)\b/],
        ['string.h', /\b(?:strlen|strcpy|strcat|strcspn|strcmp)\b/],
        ['stdbool.h', /\b(?:bool|true|false)\b/],
        ['math.h', /\b(?:pow|fmod|trunc|isfinite)\b/],
      ] : [
        ['iostream', /std::(?:cout|cin|endl)/], ['string', /std::(?:string|getline|stoll|stod)/],
        ['cmath', /std::(?:pow|fmod|trunc|isfinite)/], ['cstdlib', /\bexit\b/],
        ['stdexcept', /std::runtime_error/], ['sstream', /std::ostringstream/], ['iomanip', /std::setprecision/],
      ];
      cabecalho = bibliotecas.filter(([, regex]) => regex.test(usado)).map(([nome]) => `#include <${nome}>`).join('\n');
    } else if (this.lang === 'python' && /\bmath\./.test(usado)) cabecalho = 'import math';
    else if (this.lang === 'pascal') {
      const units = [];
      if (/\b(?:Exception|StrToInt64|StrToFloat|IntToStr|FloatToStr|LowerCase)\b/.test(usado)) units.push('SysUtils');
      if (/\b(?:Power|IsNan|IsInfinite)\b/.test(usado)) units.push('Math');
      cabecalho = 'program Programa;\n{$mode objfpc}{$H+}{$codepage utf8}' + (units.length ? `\nuses ${units.join(', ')};` : '');
    }
    return corpo.replace('@@MAPLER_HEADER@@', cabecalho).replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').trim() + '\n';
  }

  emitirAjudantes() {
    // Funções pequenas para manter a leitura e a apresentação de booleanos consistentes.
    if (this.lang === 'c') {
      this.linha('typedef struct { char dados[4096]; } MaplerTexto;');
      this.linha('MaplerTexto maplerTexto(const char *s) { MaplerTexto r; if (strlen(s) >= sizeof(r.dados)) { fputs("Texto muito longo\\n", stderr); exit(1); } strcpy(r.dados, s); return r; }');
      this.linha('MaplerTexto maplerLer(void) { char s[4096]; if (!fgets(s, sizeof(s), stdin)) { fputs("Entrada ausente\\n", stderr); exit(1); } s[strcspn(s, "\\r\\n")] = 0; return maplerTexto(s); }');
      this.linha('MaplerTexto maplerConcat(MaplerTexto a, MaplerTexto b) { if (strlen(a.dados) + strlen(b.dados) >= sizeof(a.dados)) exit(1); strcat(a.dados, b.dados); return a; }');
      this.linha('MaplerTexto maplerNumero(double n) { char s[64]; snprintf(s, sizeof(s), "%.15g", n); return maplerTexto(s); }');
    }
    if (['c', 'cpp'].includes(this.lang)) this.linha('long long maplerInteiro(double v) { if (!isfinite(v) || v != trunc(v)) { exit(1); } return (long long)v; }'.replaceAll('isfinite(', this.lang === 'cpp' ? 'std::isfinite(' : 'isfinite(').replaceAll('trunc(', this.lang === 'cpp' ? 'std::trunc(' : 'trunc('));
    if (this.lang === 'cpp') this.linha('std::string maplerNumero(double v) { std::ostringstream s; s << std::setprecision(15) << v; return s.str(); }');
    if (this.lang === 'java') {
      this.linha('static long maplerInteiro(double v) { if (!Double.isFinite(v) || v != Math.rint(v)) throw new IllegalArgumentException("Valor não inteiro"); return (long)v; }');
      this.linha('static String maplerNumero(double v) { return Double.isFinite(v) && v == Math.rint(v) ? String.format(java.util.Locale.ROOT, "%.0f", v) : Double.toString(v); }');
    }
    if (this.lang === 'pascal') this.linha("function maplerInteiro(v: Double): Int64;\nbegin\n    if IsNan(v) or IsInfinite(v) or (v <> Trunc(v)) then raise Exception.Create('Valor não inteiro');\n    Result := Trunc(v);\nend;");
    if (this.lang === 'cpp') this.linha('std::string maplerLer() { std::string s; if (!std::getline(std::cin, s)) throw std::runtime_error("Entrada ausente"); if (!s.empty() && s.back() == \'\\r\') s.pop_back(); return s; }');
    if (this.lang === 'pascal') this.linha("function maplerBool(b: Boolean): String;\nbegin\n    if b then Result := 'verdadeiro' else Result := 'falso';\nend;\nfunction maplerLer: String;\nbegin\n    if Eof(Input) then raise Exception.Create('Entrada ausente');\n    ReadLn(Result);\nend;");
    if (this.lang === 'python') this.linha('def mapler_texto(v):\n    if v is True: return "verdadeiro"\n    if v is False: return "falso"\n    if isinstance(v, float) and v.is_integer(): return str(int(v))\n    return str(v)\n');
    if (this.lang === 'ruby') this.linha('def mapler_texto(v)\n    return "verdadeiro" if v == true\n    return "falso" if v == false\n    return v.to_i.to_s if v.is_a?(Float) && v.finite? && v == v.to_i\n    v.to_s\nend\ndef mapler_ler\n    s = STDIN.gets\n    raise "Entrada ausente" if s.nil?\n    s.chomp\nend\n');
    if (this.js) {
      const ts = this.lang === 'typescript';
      this.linha(`function maplerLer()${ts ? ': string' : ''} { if (maplerIndice >= maplerEntradas.length) throw new Error("Entrada ausente"); return maplerEntradas[maplerIndice++]; }`);
      this.linha(`function maplerTexto(v${ts ? ': unknown' : ''})${ts ? ': string' : ''} { return v === true ? "verdadeiro" : v === false ? "falso" : String(v); }`);
    }
    if (this.lang === 'coffeescript') this.linha('maplerLer = ->\n    throw new Error("Entrada ausente") if maplerIndice >= maplerEntradas.length\n    maplerEntradas[maplerIndice++]\nmaplerTexto = (v) ->\n    return "verdadeiro" if v is true\n    return "falso" if v is false\n    String(v)\n');
  }

  retornaSempre(no) {
    const nos = Array.isArray(no) ? no : no?.declaracoes ?? [];
    return nos.some(n => n.tipo === 'Retorne' || (n.tipo === 'Se' && n.senaoBloco && this.retornaSempre(n.entaoBloco) && this.retornaSempre(n.senaoBloco)));
  }

  valorCompativel(no, esperado) {
    const tipo = this.tipo(no), valor = this.expr(no);
    if (tipo === esperado || (esperado === 'real' && tipo === 'int')) return valor;
    if (esperado === 'int' && tipo === 'real') {
      if (['c', 'cpp', 'java', 'pascal'].includes(this.lang)) return `maplerInteiro(${valor})`;
      return valor;
    }
    this.falha(no, `Tipos incompatíveis: esperado ${esperado}, recebido ${tipo}.`);
  }

  condicao(no) {
    const tipo = this.tipo(no), valor = this.expr(no);
    if (tipo === 'bool') return valor;
    if (tipo === 'void') this.falha(no, 'Condição sem valor.');
    if (tipo !== 'text') return `(${valor} ${this.lang === 'pascal' ? '<>' : '!='} 0)`;
    if (this.lang === 'c') return `(strlen(${valor}${this.cNativo ? '' : '.dados'}) > 0)`;
    if (this.lang === 'cpp' || this.lang === 'java') return `(!${valor}.${this.lang === 'java' ? 'isEmpty' : 'empty'}())`;
    if (this.lang === 'pascal') return `(Length(${valor}) > 0)`;
    if (this.lang === 'python') return `bool(${valor})`;
    if (this.lang === 'ruby') return `(!${valor}.empty?)`;
    return `Boolean(${valor})`;
  }

  tipoDestino(tipo) {
    const mapa = {
      c: { int: 'long long', real: 'double', text: 'MaplerTexto', bool: 'bool', void: 'void' },
      cpp: { int: 'long long', real: 'double', text: 'std::string', bool: 'bool', void: 'void' },
      java: { int: 'long', real: 'double', text: 'String', bool: 'boolean', void: 'void' },
      typescript: { int: 'number', real: 'number', text: 'string', bool: 'boolean', void: 'void' },
      pascal: { int: 'Int64', real: 'Double', text: 'String', bool: 'Boolean', void: '' },
    };
    return mapa[this.lang]?.[tipo] ?? tipo;
  }
  padrao(tipo) { return tipo === 'text' ? this.texto('') : tipo === 'bool' ? this.booleano(false) : '0'; }
  booleano(valor) { return this.lang === 'python' ? (valor ? 'True' : 'False') : String(valor); }
  texto(valor) {
    if (this.lang === 'pascal') return "'" + valor.replace(/'/g, "''").replace(/\r/g, "'#13'").replace(/\n/g, "'#10'").replace(/\t/g, "'#9'") + "'";
    let literal = JSON.stringify(valor);
    if (['ruby', 'coffeescript'].includes(this.lang)) literal = literal.replace(/#\{/g, '\\#{');
    if (this.lang === 'c') return this.cNativo ? literal : `maplerTexto(${literal})`;
    if (this.lang === 'cpp') return `std::string(${literal})`;
    return literal;
  }
  declarar(v) {
    const nome = this.nome(v.nome.lexema), tipo = this.tipoToken(v.tipoDado), dims = v.dimensoes;
    if (this.cNativo && tipo === 'text') { this.linha(`char ${nome}${dims.map(d => `[${d}]`).join('')}[4096] = {0};`); return; }
    if (this.lang === 'pascal') { this.linha(`    ${nome}: ${dims.map(d => `array[0..${d - 1}] of `).join('')}${this.tipoDestino(tipo)};`); return; }
    if (['c', 'cpp'].includes(this.lang)) { this.linha(`${this.tipoDestino(tipo)} ${nome}${dims.map(d => `[${d}]`).join('')} = ${dims.length ? (this.lang === 'cpp' ? '{}' : '{0}') : this.lang === 'c' && tipo === 'text' ? '{""}' : this.padrao(tipo)};`); return; }
    if (this.lang === 'java') { this.linha(`static ${this.tipoDestino(tipo)}${'[]'.repeat(dims.length)} ${nome} = ${dims.length ? `new ${this.tipoDestino(tipo)}${dims.map(d => `[${d}]`).join('')}` : this.padrao(tipo)};`); return; }
    let inicial = this.padrao(tipo);
    for (const d of [...dims].reverse()) {
      if (this.lang === 'python') inicial = `[${inicial} for _ in range(${d})]`;
      else if (this.lang === 'ruby') inicial = `Array.new(${d}) { ${inicial} }`;
      else if (this.lang === 'coffeescript') inicial = `Array.from({length: ${d}}, -> ${inicial})`;
      else inicial = `Array.from({length: ${d}}, () => ${inicial})`;
    }
    const anotacao = this.lang === 'typescript' ? `: ${this.tipoDestino(tipo)}${'[]'.repeat(dims.length)}` : '';
    this.linha(`${this.js ? 'let ' : ''}${nome}${anotacao} = ${inicial}${this.js ? ';' : ''}`);
  }

  assinatura(m) {
    const tipo = this.retornos.get(m.nome.lexema), nome = this.nome(m.nome.lexema, true);
    const params = m.parametros.map(p => {
      const id = this.nome(p.nome.lexema), t = this.tipoDestino(this.tipoToken(p.tipo));
      return this.lang === 'pascal' || this.lang === 'typescript' ? `${id}: ${t}` : ['c', 'cpp', 'java'].includes(this.lang) ? `${t} ${id}` : id;
    }).join(this.lang === 'pascal' ? '; ' : ', ');
    if (this.lang === 'pascal') return `${tipo === 'void' ? 'procedure' : 'function'} ${nome}(${params})${tipo === 'void' ? '' : `: ${this.tipoDestino(tipo)}`}`;
    if (this.lang === 'java') return `static ${this.tipoDestino(tipo)} ${nome}(${params})`;
    if (['c', 'cpp'].includes(this.lang)) return `${this.tipoDestino(tipo)} ${nome}(${params || 'void'})`;
    if (this.js) return `function ${nome}(${params})${this.lang === 'typescript' ? `: ${this.tipoDestino(tipo)}` : ''}`;
    if (this.lang === 'coffeescript') return `${nome} = (${params}) ->`;
    return `def ${nome}(${params})${this.lang === 'python' ? ':' : ''}`;
  }
  modulo(m) {
    this.escopoModulo(m); this.moduloAtual = m;
    this.linha(this.assinatura(m) + (this.chaves ? ' {' : this.lang === 'pascal' ? ';\nbegin' : ''));
    this.nivel++;
    if (this.lang === 'python') {
      const globais = this.variaveis.filter(v => !this.parametros.has(v.nome.lexema));
      if (globais.length) this.linha(`global ${globais.map(v => this.nome(v.nome.lexema)).join(', ')}`);
    }
    this.bloco(m.corpo);
    const retorno = this.retornos.get(m.nome.lexema);
    if (retorno !== 'void') {
      // Um caminho sem retorne deve falhar, nunca inventar um valor.
      if (['c', 'cpp'].includes(this.lang)) this.linha('exit(1);');
      else if (this.lang === 'java' && !this.retornaSempre(m.corpo)) this.linha('throw new IllegalStateException("Módulo terminou sem retornar um valor");');
      else if (this.lang === 'typescript') this.linha('throw new Error("Módulo terminou sem retornar um valor");');
    } else if (['ruby', 'coffeescript'].includes(this.lang)) this.linha(this.lang === 'ruby' ? 'nil' : 'return');
    this.nivel--;
    if (this.chaves) this.linha('}');
    if (this.lang === 'ruby') this.linha('end');
    if (this.lang === 'pascal') this.linha('end;');
    this.linha(); this.escopoModulo(null); this.moduloAtual = null;
  }
  bloco(no) {
    const nos = Array.isArray(no) ? no : no?.declaracoes ?? [];
    if (!nos.length && this.lang === 'python') this.linha('pass');
    if (!nos.length && this.lang === 'coffeescript') this.linha('undefined');
    for (const n of nos) this.comando(n);
  }
  estrutura(cabecalho, no) {
    this.linha(cabecalho + (this.chaves ? ' {' : this.lang === 'python' ? ':' : this.lang === 'pascal' ? '\nbegin' : ''));
    this.nivel++; this.bloco(no); this.nivel--;
    if (this.chaves) this.linha('}');
    if (this.lang === 'ruby') this.linha('end');
    if (this.lang === 'pascal') this.linha('end;');
  }
  comando(no) {
    const fim = this.chaves || this.lang === 'pascal' ? ';' : '';
    switch (no.tipo) {
      case 'Bloco': this.bloco(no); break;
      case 'Fim': break;
      case 'Escreva': this.escrever(no); break;
      case 'Ler': {
        if (this.cNativo) { this.lerCNativo(no); break; }
        this.linha(`${this.expr(no.variavel)} ${this.lang === 'pascal' ? ':=' : '='} ${this.ler(this.tipo(no.variavel))}${fim}`); break;
      }
      case 'Atribuicao': case 'AtribuicaoArray': this.linha(this.expr(no) + fim); break;
      case 'Chamada': case 'ChamadaModulo': this.linha(this.expr(no) + fim); break;
      case 'Se': {
        this.estrutura(`if ${this.chaves ? '(' : ''}${this.condicao(no.condicao)}${this.chaves ? ')' : this.lang === 'pascal' ? ' then' : ''}`, no.entaoBloco);
        if (no.senaoBloco) {
          if (this.lang === 'ruby') this.linhas.pop();
          if (this.lang === 'pascal') this.linhas[this.linhas.length - 1] = '    '.repeat(this.nivel) + 'end';
          this.estrutura('else', no.senaoBloco);
        }
        break;
      }
      case 'Para': this.comando(no.inicializacao); this.repeticao(no.condicao, no.corpo, no.incremento); break;
      case 'Enquanto': this.repeticao(no.condicao, no.corpo); break;
      case 'Repita': {
        const breakNo = { tipo: 'PararSe', condicao: no.condicao };
        this.repeticao({ tipo: 'Literal', valor: true }, [...no.corpo.declaracoes, breakNo]); break;
      }
      case 'PararSe': {
        const cond = this.condicao(no.condicao);
        this.linha(this.chaves ? `if (${cond}) break;` : this.lang === 'pascal' ? `if ${cond} then Break;` : this.lang === 'python' ? `if ${cond}: break` : `break if ${cond}`); break;
      }
      case 'Retorne': {
        if (!this.moduloAtual) this.falha(no, 'retorne deve estar dentro de um módulo.');
        const valor = no.valor ? this.expr(no.valor) : '';
        this.linha(this.lang === 'pascal' ? `Exit${valor ? `(${valor})` : ''};` : `return${valor ? ` ${valor}` : ''}${fim}`); break;
      }
      default: this.falha(no, `Comando '${no.tipo}' não suportado na tradução.`);
    }
  }
  repeticao(condicao, corpo, incremento) {
    const nos = Array.isArray(corpo) ? [...corpo] : [...corpo.declaracoes];
    if (incremento) nos.push(incremento);
    this.estrutura(`while ${this.chaves ? '(' : ''}${this.condicao(condicao)}${this.chaves ? ')' : this.lang === 'pascal' ? ' do' : ''}`, nos);
  }

  ler(tipo) {
    const raw = this.lang === 'java' ? 'entrada.nextLine()' : this.lang === 'python' ? 'input()' : this.lang === 'ruby' ? 'mapler_ler()' : 'maplerLer()';
    if (tipo === 'text') return raw;
    if (tipo === 'bool') {
      if (this.lang === 'c') return `(strcmp(${raw}.dados, "verdadeiro") == 0)`;
      if (this.lang === 'java') return `${raw}.equalsIgnoreCase("verdadeiro")`;
      if (this.lang === 'pascal') return `(LowerCase(${raw}) = 'verdadeiro')`;
      if (this.lang === 'python') return `(${raw}.lower() == "verdadeiro")`;
      if (this.lang === 'ruby') return `(${raw}.downcase == "verdadeiro")`;
      return `(${raw} == "verdadeiro")`;
    }
    if (this.lang === 'c') return tipo === 'int' ? `strtoll(${raw}.dados, NULL, 10)` : `strtod(${raw}.dados, NULL)`;
    if (this.lang === 'cpp') return `${tipo === 'int' ? 'std::stoll' : 'std::stod'}(${raw})`;
    if (this.lang === 'java') return `${tipo === 'int' ? 'Long.parseLong' : 'Double.parseDouble'}(${raw})`;
    if (this.lang === 'pascal') return `${tipo === 'int' ? 'StrToInt64' : 'StrToFloat'}(${raw})`;
    if (this.lang === 'python') return `${tipo === 'int' ? 'int' : 'float'}(${raw})`;
    if (this.lang === 'ruby') return `${tipo === 'int' ? 'Integer' : 'Float'}(${raw})`;
    return `${tipo === 'int' ? 'Number.parseInt' : 'Number'}(${raw}${tipo === 'int' ? ', 10' : ''})`;
  }

  lerCNativo(no) {
    const alvo = this.expr(no.variavel), tipo = this.tipo(no.variavel);
    if (tipo === 'text') {
      this.linha(`if (fgets(${alvo}, sizeof(${alvo}), stdin) == NULL) exit(1);`);
      this.linha(`${alvo}[strcspn(${alvo}, "\\r\\n")] = '\\0';`);
    } else if (tipo === 'bool') {
      this.linha('{'); this.nivel++;
      this.linha('char valor[16];');
      if (this.leituraTexto) {
        this.linha('if (fgets(valor, sizeof(valor), stdin) == NULL) exit(1);');
        this.linha('valor[strcspn(valor, "\\r\\n")] = \'\\0\';');
      } else this.linha('if (scanf("%15s", valor) != 1) exit(1);');
      this.linha(`${alvo} = strcmp(valor, "verdadeiro") == 0;`);
      this.nivel--; this.linha('}');
    } else if (this.leituraTexto) {
      this.linha('if (fgets(entrada, sizeof(entrada), stdin) == NULL) exit(1);');
      this.linha(`${alvo} = ${tipo === 'int' ? 'strtoll(entrada, NULL, 10)' : 'strtod(entrada, NULL)'};`);
    } else {
      this.linha(`if (scanf("${tipo === 'int' ? '%lld' : '%lf'}", &${alvo}) != 1) exit(1);`);
    }
  }
  paraTexto(no) {
    const valor = this.expr(no), tipo = this.tipo(no);
    if (tipo === 'text') return valor;
    if (tipo === 'void') this.falha(no, 'Módulo sem retorno usado como valor.');
    if (this.lang === 'c') return tipo === 'bool' ? `maplerTexto(${valor} ? "verdadeiro" : "falso")` : `maplerNumero(${valor})`;
    if (this.lang === 'cpp') return tipo === 'bool' ? `std::string(${valor} ? "verdadeiro" : "falso")` : `maplerNumero(${valor})`;
    if (this.lang === 'java') return tipo === 'bool' ? `(${valor} ? "verdadeiro" : "falso")` : tipo === 'real' ? `maplerNumero(${valor})` : `String.valueOf(${valor})`;
    if (this.lang === 'pascal') return `${tipo === 'bool' ? 'maplerBool' : tipo === 'int' ? 'IntToStr' : 'FloatToStr'}(${valor})`;
    if (tipo === 'int') {
      if (this.lang === 'python') return `str(${valor})`;
      if (this.lang === 'ruby') return `(${valor}).to_s`;
      return `String(${valor})`;
    }
    if (this.lang === 'python' || this.lang === 'ruby') return `mapler_texto(${valor})`;
    return `maplerTexto(${valor})`;
  }
  escrever(no) {
    if (this.lang === 'c') {
      let temChamada = false;
      this.visitarNos(no.expressoes, e => { if (['Chamada', 'ChamadaModulo', 'Atribuicao', 'AtribuicaoArray'].includes(e.tipo)) temChamada = true; });
      if (this.cNativo && !temChamada && !(no.expressoes.length === 1 && no.expressoes[0].tipo === 'Literal' && typeof no.expressoes[0].valor === 'string')) {
        const argumentos = [];
        const formato = no.expressoes.map(e => {
          if (e.tipo === 'Literal' && typeof e.valor === 'string') return e.valor.replaceAll('%', '%%');
          const tipo = this.tipo(e), valor = this.expr(e);
          argumentos.push(tipo === 'int' ? `(long long)(${valor})` : tipo === 'real' ? `(double)(${valor})` : tipo === 'bool' ? `${valor} ? "verdadeiro" : "falso"` : valor);
          return tipo === 'int' ? '%lld' : tipo === 'real' ? '%.15g' : '%s';
        }).join('') + '\n';
        this.linha(`printf(${JSON.stringify(formato)}${argumentos.length ? ', ' + argumentos.join(', ') : ''});`);
        return;
      }
      if (no.expressoes.length === 1 && no.expressoes[0].tipo === 'Literal' && typeof no.expressoes[0].valor === 'string') {
        this.linha(`puts(${JSON.stringify(no.expressoes[0].valor)});`);
      } else {
        // Uma expressão por instrução preserva a ordem de avaliação do Portugol.
        for (const e of no.expressoes) {
          const tipo = this.tipo(e);
          if (tipo === 'int') this.linha(`printf("%lld", (long long)(${this.expr(e)}));`);
          else if (tipo === 'real') this.linha(`printf("%.15g", (double)(${this.expr(e)}));`);
          else if (tipo === 'bool') this.linha(`fputs(${this.expr(e)} ? "verdadeiro" : "falso", stdout);`);
          else this.linha(`fputs(${e.tipo === 'Literal' ? JSON.stringify(e.valor) : `${this.expr(e)}${this.cNativo ? '' : '.dados'}`}, stdout);`);
        }
        this.linha('putchar(\'\\n\');');
      }
      return;
    }
    if (this.lang === 'cpp') {
      this.linha(`std::cout${no.expressoes.map(e => ` << ${e.tipo === 'Literal' && typeof e.valor === 'string' ? JSON.stringify(e.valor) : this.tipo(e) === 'bool' ? this.paraTexto(e) : this.expr(e)}`).join('')} << std::endl;`); return;
    }
    const args = no.expressoes.map(e => this.paraTexto(e));
    if (this.lang === 'pascal') this.linha(`WriteLn(${args.join(', ')});`);
    else if (this.lang === 'java') this.linha(`System.out.println(${args.join(' + ') || '""'});`);
    else if (this.lang === 'python') this.linha(`print(${args.join(' + ') || '""'})`);
    else if (this.lang === 'ruby') this.linha(`puts(${args.join(' + ') || '""'})`);
    else this.linha(`console.log(${args.join(' + ') || '""'})${this.js ? ';' : ''}`);
  }

  expr(no) {
    switch (no.tipo) {
      case 'Literal': return typeof no.valor === 'string' ? this.texto(no.valor) : typeof no.valor === 'boolean' ? this.booleano(no.valor) : String(no.valor) + (this.lang === 'java' && Number.isInteger(no.valor) ? 'L' : '');
      case 'Variavel': {
        if (this.simbolo(no).dimensoes.length) this.falha(no, 'Use índices para acessar um elemento do vetor.');
        return this.nome(no.nome.lexema);
      }
      case 'VariavelArray': case 'AtribuicaoArray': {
        const simbolo = this.simbolo(no);
        if (no.indices.length !== simbolo.dimensoes.length) this.falha(no, 'Quantidade incorreta de índices do vetor.');
        const indices = no.indices.map(i => {
          if (this.tipo(i) !== 'int') this.falha(i, 'Índice deve ser inteiro.');
          const valor = this.expr(i);
          return this.lang === 'java' ? `(int)(${valor})` : valor;
        });
        const alvo = this.nome(no.nome.lexema) + (this.lang === 'pascal' ? `[${indices.join(', ')}]` : indices.map(i => `[${i}]`).join(''));
        if (no.tipo === 'AtribuicaoArray' && this.cNativo && simbolo.tipo === 'text') return `snprintf(${alvo}, sizeof(${alvo}), "%s", ${this.valorCompativel(no.valor, simbolo.tipo)})`;
        return no.tipo === 'VariavelArray' ? alvo : `${alvo} ${this.lang === 'pascal' ? ':=' : '='} ${this.valorCompativel(no.valor, simbolo.tipo)}`;
      }
      case 'Atribuicao': {
        const simbolo = this.simbolo(no);
        if (simbolo.dimensoes.length) this.falha(no, 'Use índices para atribuir um elemento do vetor.');
        if (this.cNativo && simbolo.tipo === 'text') return `snprintf(${this.nome(no.nome.lexema)}, sizeof(${this.nome(no.nome.lexema)}), "%s", ${this.valorCompativel(no.valor, simbolo.tipo)})`;
        return `${this.nome(no.nome.lexema)} ${this.lang === 'pascal' ? ':=' : '='} ${this.valorCompativel(no.valor, simbolo.tipo)}`;
      }
      case 'Grupo': return `(${this.expr(no.expressao)})`;
      case 'ExpParentizada': return `(${this.expr(no.grupo)})`;
      case 'Unario': return `(${no.operador.tipo === 'MENOS' ? '-' : ['python', 'pascal', 'coffeescript'].includes(this.lang) ? 'not ' : '!'}${no.operador.tipo === 'NAO' ? this.condicao(no.direita) : this.expr(no.direita)})`;
      case 'Chamada': case 'ChamadaModulo': {
        const nome = no.callee?.nome?.lexema ?? no.identificador?.lexema, modulo = this.modulos.get(nome);
        if (!modulo) this.falha(no, 'Módulo não declarado.');
        const args = no.argumentos ?? [];
        if (args.length !== modulo.parametros.length) this.falha(no, 'Quantidade incorreta de argumentos.');
        return `${this.nome(nome, true)}(${args.map((a, i) => this.valorCompativel(a, this.tipoToken(modulo.parametros[i].tipo))).join(', ')})`;
      }
      case 'Binario': case 'Logico': {
        const a = this.expr(no.esquerda), b = this.expr(no.direita), op = no.operador.tipo;
        const ta = this.tipo(no.esquerda), tb = this.tipo(no.direita);
        if (op === 'MAIS' && (ta === 'text' || tb === 'text')) {
          const ea = this.paraTexto(no.esquerda), eb = this.paraTexto(no.direita);
          return this.lang === 'c' ? `maplerConcat(${ea}, ${eb})` : `(${ea} + ${eb})`;
        }
        if (['IGUAL', 'DIFERENTE', 'MAIOR_QUE', 'MAIOR_IGUAL', 'MENOR_QUE', 'MENOR_IGUAL'].includes(op) && ta === 'text' && tb === 'text') {
          if (this.lang === 'c') return `(strcmp(${a}${this.cNativo ? '' : '.dados'}, ${b}${this.cNativo ? '' : '.dados'}) ${OPS[op]} 0)`;
          if (this.lang === 'java') return `(${a}.compareTo(${b}) ${OPS[op]} 0)`;
        }
        if (op === 'POTENCIA') {
          const func = { c: 'pow', cpp: 'std::pow', java: 'Math.pow', javascript: 'Math.pow', typescript: 'Math.pow', coffeescript: 'Math.pow', pascal: 'Power' }[this.lang];
          return func ? `${func}(${a}, ${b})` : `(${a} ** ${b})`;
        }
        if (op === 'BARRA') {
          if (['c', 'cpp', 'java'].includes(this.lang)) return `((double)(${a}) / (${b}))`;
          if (this.lang === 'ruby') return `((${a}).to_f / (${b}))`;
        }
        if (op === 'RESTO') {
          if (this.lang === 'python') return `(${a} - math.trunc(${a} / ${b}) * ${b})`;
          if (this.lang === 'ruby') return `(${a}).remainder(${b})`;
          if (this.lang === 'c' || this.lang === 'cpp') return `(${this.tipo(no) === 'int' ? '(long long)' : ''}${this.lang === 'cpp' ? 'std::' : ''}fmod(${a}, ${b}))`;
          if (this.lang === 'pascal') return `(${a} - Trunc(${a} / ${b}) * ${b})`;
        }
        const especiais = this.lang === 'pascal' ? { IGUAL: '=', DIFERENTE: '<>', E: 'and', OU: 'or' } : ['python', 'coffeescript'].includes(this.lang) ? { E: 'and', OU: 'or' } : this.js ? { IGUAL: '===', DIFERENTE: '!==' } : {};
        const operador = especiais[op] ?? OPS[op];
        if (!operador) this.falha(no, `Operador '${op}' não suportado.`);
        if (['E', 'OU'].includes(op)) return `(${this.condicao(no.esquerda)} ${operador} ${this.condicao(no.direita)})`;
        if ((ta === 'text') !== (tb === 'text')) this.falha(no, 'Operação entre texto e número incompatível.');
        return `(${a} ${operador} ${b})`;
      }
      default: this.falha(no, `Expressão '${no.tipo}' não suportada.`);
    }
  }
}
