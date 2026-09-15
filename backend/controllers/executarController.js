import { Worker } from 'node:worker_threads';

export function processar(body, acao = 'executar', { signal, timeout = 5000 } = {}) {
  if (!body || typeof body.codigo !== 'string' || !body.codigo.trim()) {
    return Promise.resolve({ sucesso: false, erro: 'Informe um código não vazio.' });
  }
  if (body.codigo.length > 100000 || (body.entradas !== undefined && (!Array.isArray(body.entradas) || body.entradas.length > 10000 || body.entradas.some(valor => typeof valor !== 'string')))) {
    return Promise.resolve({ sucesso: false, erro: 'Código ou entradas fora dos limites permitidos.' });
  }
  return new Promise(resolve => {
    if (signal?.aborted) { resolve({ sucesso: false, erro: 'Operação cancelada.' }); return; }
    const worker = new Worker(new URL('./engineWorker.js', import.meta.url), {
      workerData: { codigo: body.codigo, entradas: body.entradas ?? [], linguagem: body.linguagem ?? 'python', acao },
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    let terminado = false;
    const finalizar = resultado => {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancelar);
      void worker.terminate();
      resolve(resultado);
    };
    const cancelar = () => finalizar({ sucesso: false, erro: 'Operação cancelada.' });
    const timer = setTimeout(() => finalizar({ sucesso: false, erro: 'Tempo limite de execução excedido (5 segundos).' }), timeout);
    signal?.addEventListener('abort', cancelar, { once: true });
    worker.once('message', finalizar);
    worker.once('error', () => finalizar({ sucesso: false, erro: 'O programa excedeu os recursos disponíveis ou o motor falhou.' }));
    worker.once('exit', () => finalizar({ sucesso: false, erro: 'O motor encerrou sem resposta.' }));
  });
}

function handler(acao) {
  return async (req, res) => {
    const controller = new AbortController();
    const cancelar = () => controller.abort();
    res.once('close', cancelar);
    try {
      const resultado = await processar(req.body, acao, { signal: controller.signal });
      if (!res.destroyed) res.status(200).json(resultado);
    } finally { res.removeListener('close', cancelar); }
  };
}
export const executar = handler('executar');
export const traduzir = handler('traduzir');
export default { executar, traduzir };
