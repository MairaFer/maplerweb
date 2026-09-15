import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { resolve } from 'node:path';
import CoffeeScript from 'coffeescript';
import ts from 'typescript';
import Lexico from '../mapler-engine/lexico.js';
import { AnalisadorSintatico } from '../mapler-engine/sintatico.js';
import { TranspiladorMultilinguagem, LINGUAGENS } from '../mapler-engine/TranspiladorMultilinguagem.js';
import { processar } from '../controllers/executarController.js';

function gerar(fonte, linguagem) {
  const erros = [];
  const eventos = { notificar: (_tipo, erro) => erros.push(erro) };
  const ast = new AnalisadorSintatico(eventos).parse(new Lexico(eventos).scanTokens(fonte));
  assert.deepEqual(erros, []);
  assert.ok(ast);
  return new TranspiladorMultilinguagem(linguagem).transpilar(ast);
}
function executar(codigo, linguagem, entradas) {
  if (linguagem === 'python') {
    const result = spawnSync('python', ['-X', 'utf8', '-c', codigo], { encoding: 'utf8', input: entradas.join('\n') + '\n', timeout: 5000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr + '\n' + codigo);
    return result.stdout.trimEnd().split(/\r?\n/);
  }
  if (linguagem === 'coffeescript') codigo = CoffeeScript.compile(codigo, { bare: true });
  if (linguagem === 'typescript') {
    const filename = resolve('programa-gerado.ts').replaceAll('\\', '/');
    const options = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, types: [], skipLibCheck: true };
    const host = ts.createCompilerHost(options);
    const original = host.getSourceFile.bind(host);
    host.getSourceFile = (file, version, ...rest) => file === filename ? ts.createSourceFile(file, codigo, version, true) : original(file, version, ...rest);
    const program = ts.createProgram([filename], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
    const result = ts.transpileModule(codigo, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
    assert.deepEqual(result.diagnostics, []);
    codigo = result.outputText;
  }
  const saida = [];
  vm.runInNewContext(codigo, { console: { log: v => saida.push(String(v)) }, require: () => ({ readFileSync: () => entradas.join('\n') + '\n' }) }, { timeout: 5000 });
  return saida;
}

const cenarios = [
  { nome: 'entrada e texto com apóstrofo e interpolação literal', fonte: 'variaveis nome: cadeia; inicio ler nome; escrever "Olá ", nome, " d\'água #{1+2}"; fim', entradas: ['Ana Maria'], saida: ["Olá Ana Maria d'água #{1+2}"] },
  { nome: 'condições, repetições e operadores', fonte: 'variaveis i, soma: inteiro; inicio soma <- 0; para i de 1 ate 3 faca soma <- soma + i; fim para; enquanto soma < 8 faca soma <- soma + 1; fim enquanto; repita soma <- soma - 1; ate soma = 6; se soma = 6 entao escrever "sim", soma; senao escrever "não"; fim se; escrever 5 / 2, ":", 2 ^ 3, ":", -5 % 2; fim', entradas: [], saida: ['sim6', '2.5:8:-1'] },
  { nome: 'vetores e matrizes independentes', fonte: 'variaveis v: vetor[2] de inteiro; m: vetor[2,2] de inteiro; inicio ler v[0]; m[0,0] <- 2; m[1,0] <- 7; escrever v[0], ":", m[0,0], ":", m[1,0]; fim', entradas: ['4'], saida: ['4:2:7'] },
  { nome: 'módulos, retorno e escrita em global', fonte: 'variaveis total: inteiro; inicio total <- 1; incrementar(); escrever dobro(total); fim modulo incrementar inicio total <- total + 1; fim modulo; modulo dobro(x: inteiro) inicio retorne x * 2; fim modulo;', entradas: [], saida: ['4'] },
  { nome: 'booleanos e concatenação', fonte: 'variaveis b: logico; inicio ler b; escrever b, ":", nao b; escrever "valor=" + 2; fim', entradas: ['verdadeiro'], saida: ['verdadeiro:falso', 'valor=2'] },
];

for (const linguagem of ['javascript', 'typescript', 'coffeescript', 'python']) {
  for (const cenario of cenarios) test(`${linguagem}: ${cenario.nome}`, () => {
    assert.deepEqual(executar(gerar(cenario.fonte, linguagem), linguagem, cenario.entradas), cenario.saida);
  });
}
test('API gera as nove linguagens, com extensão correta', async () => {
  for (const [linguagem, meta] of Object.entries(LINGUAGENS)) {
    const result = await processar({ codigo: cenarios[0].fonte, linguagem }, 'traduzir');
    assert.equal(result.sucesso, true, result.erro);
    assert.equal(result.linguagem, linguagem);
    assert.equal(result.arquivo, meta.arquivo);
    assert.ok(result.codigo.length > 50);
  }
});
test('linguagem inválida e identificador não declarado geram diagnóstico', async () => {
  assert.match((await processar({ codigo: 'inicio fim', linguagem: 'desconhecida' }, 'traduzir')).erro, /não suportada/);
  assert.throws(() => gerar('inicio escrever ausente; fim', 'java'), /não declarada/);
});
