/**
 * Nos da AST: linha identifica a linha no fonte; tipo identifica a classe do no.
 * Tokens possuem lexema, tipo e linha. Os nos guardam dados, sem executar o programa.
 * aceitar(visitante) chama visitarX; o retorno pode ser uma Promise.
 */
// declaracao.js - Com suporte ao Padrão Visitor

/** Raiz: variaveis: VarDeclaracoes[]; corpo: nos[]; modulos: Modulo[]; fim: Fim. */
export class Programa {
  constructor(linha, variaveis, corpo, modulos, fim) {
    this.tipo = 'Programa';
    this.linha = linha;
    this.variaveis = variaveis;
    this.corpo = corpo;
    this.modulos = modulos;
    this.fim = fim;
  }
  aceitar(visitante) {
    return visitante.visitarPrograma(this);
  }
}

/** token: Token de fechamento. */
export class Fim {
  constructor(linha, token) {
    this.tipo = 'Fim';
    this.linha = linha;
    this.token = token;
  }
  aceitar(visitante) {
    return visitante.visitarFim(this);
  }
}

/** variavel: Variavel ou VariavelArray. */
export class Ler {
  constructor(linha, variavel) {
    this.tipo = 'Ler';
    this.linha = linha;
    this.variavel = variavel; 
  }
  aceitar(visitante) {
    return visitante.visitarLer(this);
  }
}

/** expressoes: lista de expressoes. */
export class Escreva {
  constructor(linha, expressoes) {
    this.tipo = 'Escreva';
    this.linha = linha;
    this.expressoes = expressoes;
  }
  aceitar(visitante) {
    return visitante.visitarEscreva(this);
  }
}

/** nome e tipoDado: Tokens. dimensoes: tamanhos positivos; indices a partir de zero. */
export class Var {
  constructor(linha, nome, tipo, dimensoes = []) {
    this.tipo = 'Var';
    this.linha = linha;
    this.nome = nome;
    this.tipoDado = tipo;
    this.dimensoes = dimensoes;
  }
  aceitar(visitante) {
    return visitante.visitarVar(this);
  }
}

/** variaveis: Var[]. */
export class VarDeclaracoes {
  constructor(linha, variaveis) {
    this.tipo = 'VarDeclaracoes';
    this.linha = linha;
    this.variaveis = variaveis; 
  }
  aceitar(visitante) {
    return visitante.visitarVarDeclaracoes(this);
  }
}

/** declaracoes: lista de declaracoes ou expressoes. */
export class Bloco {
  constructor(linha, declaracoes) {
    this.tipo = 'Bloco';
    this.linha = linha;
    this.declaracoes = declaracoes;
  }
  aceitar(visitante) {
    return visitante.visitarBloco(this);
  }
}

/** condicao: expressao; entaoBloco: Bloco; senaoBloco: Bloco ou null. */
export class Se {
  constructor(linha, condicao, entaoBloco, senaoBloco) {
    this.tipo = 'Se';
    this.linha = linha;
    this.condicao = condicao;
    this.entaoBloco = entaoBloco;
    this.senaoBloco = senaoBloco;
  }
  aceitar(visitante) {
    return visitante.visitarSe(this);
  }
}

/** condicao: expressao; corpo: Bloco. */
export class Enquanto {
  constructor(linha, condicao, corpo) {
    this.tipo = 'Enquanto';
    this.linha = linha;
    this.condicao = condicao;
    this.corpo = corpo;
  }
  aceitar(visitante) {
    return visitante.visitarEnquanto(this);
  }
}

/** inicializacao e incremento: atribuicoes; condicao: expressao; corpo: Bloco. */
export class Para {
  constructor(linha, inicializacao, condicao, incremento, corpo) {
    this.tipo = 'Para';
    this.linha = linha;
    this.inicializacao = inicializacao; // Geralmente uma Atribuicao
    this.condicao = condicao;
    this.incremento = incremento; // Geralmente uma Atribuicao
    this.corpo = corpo;
  }
  aceitar(visitante) {
    return visitante.visitarPara(this);
  }
}

/** corpo: Bloco, executado antes de testar condicao: expressao. */
export class Repita {
  constructor(linha, corpo, condicao) {
    this.tipo = 'Repita';
    this.linha = linha;
    this.corpo = corpo;
    this.condicao = condicao;
  }
  aceitar(visitante) {
    return visitante.visitarRepita(this);
  }
}

/** nome: Token; parametros: { nome: Token, tipo: Token }[]; corpo: Bloco. */
export class Modulo {
  constructor(linha, nome, parametros, corpo) {
    this.tipo = 'Modulo';
    this.linha = linha;
    this.nome = nome;
    this.parametros = parametros; 
    this.corpo = corpo;
  }
  aceitar(visitante) {
    return visitante.visitarModulo(this);
  }
}

/** Comando: identificador: Token; argumentos: expressoes[]. Chamada (expressao.js) permite usar o retorno em outra expressao. */
export class ChamadaModulo {
  constructor(linha, identificador, argumentos = []) {
    this.tipo = 'ChamadaModulo';
    this.linha = linha;
    this.identificador = identificador; // Token
    this.argumentos = argumentos;
  }
  aceitar(visitante) {
    return visitante.visitarChamadaModulo(this);
  }
}

/** valor: expressao ou null. */
export class Retorne {
  constructor(linha, valor) {
    this.tipo = 'Retorne';
    this.linha = linha;
    this.valor = valor; 
  }
  aceitar(visitante) {
    return visitante.visitarRetorne(this);
  }
}
