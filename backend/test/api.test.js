import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../app.js';
import { processar } from '../controllers/executarController.js';
test('execução retorna saídas, tokens e variáveis', async () => {
  const result = await processar({ codigo: 'variaveis a: inteiro; inicio ler a; escrever a + 1; fim', entradas: ['4'] });
  assert.equal(result.sucesso, true, result.erro);
  assert.deepEqual(result.saida, ['5']);
  assert.equal(result.variaveis.a.valor, 4);
  assert.ok(result.tokens.length);
  assert.ok(result.ast);
});
test('erros léxicos, sintáticos e de entrada são legíveis', async () => {
  for (const codigo of ['inicio @ fim', 'inicio escrever ; fim', 'variaveis a: inteiro; inicio ler a; fim']) {
    const result = await processar({ codigo });
    assert.equal(result.sucesso, false);
    assert.ok(result.erro || result.errosExecucao?.length);
  }
});
test('tradução não depende de entradas', async () => {
  const result = await processar({ codigo: 'variaveis a: inteiro; inicio ler a; escrever a; fim' }, 'traduzir');
  assert.equal(result.sucesso, true, result.erro);
  assert.match(result.codigo, /input\(/);
});
test('interrompe laço infinito e permite a próxima execução', async () => {
  const result = await processar({ codigo: 'inicio enquanto verdadeiro faca fim enquanto; fim' }, 'executar', { timeout: 500 });
  assert.equal(result.sucesso, false);
  assert.match(result.erro, /Tempo limite/);
  assert.equal((await processar({ codigo: 'inicio fim' })).sucesso, true);
});
test('valida o corpo e permite cancelamento', async () => {
  for (const body of [null, {}, { codigo: ' ' }, { codigo: 'inicio fim', entradas: [2] }]) {
    assert.equal((await processar(body)).sucesso, false);
  }
  const controller = new AbortController();
  const pending = processar({ codigo: 'inicio enquanto verdadeiro faca fim enquanto; fim' }, 'executar', { signal: controller.signal });
  controller.abort();
  assert.match((await pending).erro, /cancelada/);
});
test('rotas HTTP de saúde, execução e tradução', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await (await fetch(url + '/health')).json()).sucesso, true);
    for (const rota of ['/executar', '/traduzir']) {
      const res = await fetch(url + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: 'inicio escrever "oi"; fim' }) });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).sucesso, true);
    }
    const invalid = await fetch(url + '/executar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(invalid.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
