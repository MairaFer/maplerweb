import test from 'node:test';
import assert from 'node:assert/strict';
import { criarNomesDestino } from '../mapler-engine/NomesDestino.js';

for (const linguagem of ['c', 'cpp', 'java', 'javascript', 'typescript', 'python', 'ruby', 'pascal', 'coffeescript']) {
  test(`${linguagem}: preserva nomes comuns`, () => {
    const nome = criarNomesDestino(linguagem, ['i', 'valor', 'nome', 'dobro']);
    assert.deepEqual(['i', 'valor', 'nome', 'dobro'].map(nome), ['i', 'valor', 'nome', 'dobro']);
  });
}
test('evita palavras reservadas sem tomar o nome de outra variável', () => {
  const nome = criarNomesDestino('java', ['class', 'class_1', 'nome']);
  assert.equal(nome('class'), 'class_2');
  assert.equal(nome('class_1'), 'class_1');
  assert.equal(nome('nome'), 'nome');
});
test('respeita maiúsculas e minúsculas do Pascal', () => {
  const nome = criarNomesDestino('pascal', ['Valor', 'valor']);
  assert.equal(nome('Valor'), 'Valor');
  assert.equal(nome('valor'), 'valor_1');
});
test('evita conflitos com funções utilizadas pelo código gerado', () => {
  const nome = criarNomesDestino('python', ['print', 'input', 'mapler_texto']);
  assert.equal(nome('print'), 'print_1');
  assert.equal(nome('input'), 'input_1');
  assert.equal(nome('mapler_texto'), 'mapler_texto_1');
});
