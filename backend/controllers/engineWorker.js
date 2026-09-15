import { parentPort, workerData } from 'node:worker_threads';
import Lexico from '../mapler-engine/lexico.js';
import { AnalisadorSintatico } from '../mapler-engine/sintatico.js';
import { Interpretador } from '../mapler-engine/Interpretador.js';
import { EventosService } from '../mapler-engine/EventosService.js';
import { TranspiladorMultilinguagem, LINGUAGENS } from '../mapler-engine/TranspiladorMultilinguagem.js';

function mensagem(erro) {
  if (typeof erro === 'string') return erro;
  return [erro?.linha ? `Linha ${erro.linha}:` : '', erro?.mensagem ?? erro?.message ?? 'Erro no programa'].filter(Boolean).join(' ');
}
try {
  const eventos = new EventosService();
  const notificar = eventos.notificar.bind(eventos);
  let tamanhoSaida = 0;
  eventos.notificar = (tipo, payload) => {
    if (tipo === 'ESCREVER') {
      tamanhoSaida += String(payload).length;
      if (eventos.saidas.length >= 10000 || tamanhoSaida > 1000000) throw new Error('Limite de saída excedido.');
    }
    notificar(tipo, payload);
  };
  const tokens = new Lexico(eventos).scanTokens(workerData.codigo);
  const ast = new AnalisadorSintatico(eventos).parse(tokens);
  if (!ast || eventos.erros.length) {
    parentPort.postMessage({ sucesso: false, erro: eventos.erros.map(mensagem).join('\n') || 'Não foi possível analisar o programa.' });
  } else if (workerData.acao === 'traduzir') {
    const linguagem = workerData.linguagem ?? 'python';
    const codigo = new TranspiladorMultilinguagem(linguagem).transpilar(ast);
    parentPort.postMessage({ sucesso: true, codigo, linguagem, arquivo: LINGUAGENS[linguagem].arquivo });
  } else {
    const interpretador = new Interpretador(eventos, workerData.entradas);
    await interpretador.interpretar(ast);
    const variaveis = {};
    for (const [nome, valor] of interpretador.ambiente.valores.entries()) {
      variaveis[nome] = { tipo: interpretador.ambiente.tipos.get(nome) ?? null, valor };
    }
    // Remove referências de métodos antes de enviar os dados ao processo HTTP.
    parentPort.postMessage(JSON.parse(JSON.stringify({
      sucesso: eventos.erros.length === 0, tokens, ast,
      saida: eventos.saidas, errosExecucao: eventos.erros.map(mensagem), variaveis,
    }, (_key, value) => typeof value === 'function' ? undefined : value)));
  }
} catch (error) {
  parentPort.postMessage({ sucesso: false, erro: mensagem(error) });
}
