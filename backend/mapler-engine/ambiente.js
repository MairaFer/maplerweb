// Arquivo: ambiente.js (Versão com Escopo/Closure)

import { obterTipoDoValor } from './checadorTipos.js'; // Ajuste o path se necessário

export class Ambiente {
  // Agora aceita um ambiente 'pai' (enclosing)
  constructor(enclosing = null) {
    this.valores = new Map();
    this.tipos = new Map();
    this.enclosing = enclosing; // Referência ao escopo externo (pai)
  }

  definir(nome, tipoDado, valor = null) {
    this.valores.set(nome, valor);
    this.tipos.set(nome, tipoDado);
  }

  atribuir(tokenNome, valor) {
    const nome = tokenNome.lexema;
    
    // 1. Tenta encontrar no escopo atual
    if (this.valores.has(nome)) {
      const tipoEsperado = this.tipos.get(nome);

      // Permite atribuir Módulo a uma variável do tipo Módulo
      if (tipoEsperado === 'TIPO_MODULO' && valor && typeof valor === 'object' && valor.constructor.name === 'ModuloChamavel') {
        this.valores.set(nome, valor);
        return valor;
      }

      // Validação de Tipo
      const tipoDoValor = this._obterTipoDoValor(valor);
      
      // Permite: Mesmo tipo OU Inteiro em Real
      if (tipoEsperado === tipoDoValor || (tipoEsperado === 'TIPO_REAL' && tipoDoValor === 'TIPO_INTEIRO')) {
        this.valores.set(nome, valor);
        return valor;
      } else {
        throw new Error(`Erro de tipo: Impossivel atribuir um valor do tipo ${tipoDoValor} a uma variavel do tipo ${tipoEsperado}. (Linha: ${tokenNome.linha})`);
      }
    }

    // 2. Se não achou aqui, tenta no escopo pai (Recursão)
    if (this.enclosing !== null) {
      return this.enclosing.atribuir(tokenNome, valor);
    }

    throw new Error(`Erro em tempo de execucao: Variavel indefinida '${nome}'. (Linha: ${tokenNome.linha})`);
  }

  obter(tokenNome) {
    const nome = tokenNome.lexema;
    
    // 1. Busca no atual
    if (this.valores.has(nome)) {
      return this.valores.get(nome);
    }

    // 2. Busca no pai
    if (this.enclosing !== null) {
      return this.enclosing.obter(tokenNome);
    }

    throw new Error(`Erro em tempo de execucao: Variavel indefinida '${nome}'. (Linha: ${tokenNome.linha})`);
  }

  obterTipo(tokenNome) {
    if (this.tipos.has(tokenNome.lexema)) return this.tipos.get(tokenNome.lexema);
    if (this.enclosing) return this.enclosing.obterTipo(tokenNome);
    throw new Error(`Variavel indefinida '${tokenNome.lexema}'. (Linha: ${tokenNome.linha})`);
  }

  _obterTipoDoValor(valor) {
    // Helper simples se não quiser importar do checadorTipos.js, 
    // mas o ideal é usar a importação.
    if (typeof valor === 'number') {
        return Number.isInteger(valor) ? 'TIPO_INTEIRO' : 'TIPO_REAL';
    }
    if (typeof valor === 'string') return 'TIPO_CADEIA';
    if (typeof valor === 'boolean') return 'TIPO_LOGICO';
   
    if (Array.isArray(valor)) {

        if (valor.length === 0)
            return "TIPO_VETOR";

        return {
            tipo: "TIPO_VETOR",
            elemento: this._obterTipoDoValor(valor[0])
        };
    }
    if (valor && typeof valor === 'object' && valor.constructor.name === 'ModuloChamavel') return 'TIPO_MODULO';
    return 'DESCONHECIDO';
  }
}
