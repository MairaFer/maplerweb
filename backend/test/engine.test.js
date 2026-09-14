import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import Lexico from '../mapler-engine/lexico.js';
import { AnalisadorSintatico } from '../mapler-engine/sintatico.js';
import { Interpretador } from '../mapler-engine/Interpretador.js';
import { TranspiladorPython } from '../mapler-engine/TranspiladorPython.js';
import * as Decl from '../mapler-engine/declaracao.js';
import { Literal } from '../mapler-engine/expressao.js';

function parse(fonte) {
    const erros = [];
    const eventos = { notificar: (tipo, valor) => { if (tipo === 'ERRO') erros.push(valor); } };
    const ast = new AnalisadorSintatico(eventos).parse(new Lexico(eventos).scanTokens(fonte));
    assert.deepEqual(erros, []);
    assert.ok(ast);
    return ast;
}

async function executar(ast, entradas = []) {
    const saida = [];
    const motor = new Interpretador({ notificar: (tipo, valor) => {
        if (tipo === 'ESCREVER') saida.push(valor);
    } }, entradas);
    await motor.interpretar(ast);
    return { motor, saida };
}

function python(ast, entradas = []) {
    const codigo = new TranspiladorPython().transpilar(ast);
    const resultado = spawnSync('python', ['-c', codigo], {
        input: entradas.join('\n') + '\n', encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(resultado.error);
    assert.equal(resultado.status, 0, resultado.stderr + '\n' + codigo);
    return resultado.stdout.trim().split(/\r?\n/);
}

test('vetores, matrizes e tres dimensoes: atribuicao, leitura e linhas independentes', async () => {
    const ast = parse(`variaveis
        v: vetor[3] de inteiro;
        m: vetor[2,2] de inteiro;
        t: vetor[2,2,2] de inteiro;
        inicio
        v[0] <- 7; v[1] <- v[0] + 2;
        m[0,0] <- 1; m[1,0] <- 9;
        t[1,0,1] <- 12;
        ler(v[2]); ler m[0,1];
        escrever v[1], ":", v[2], ":", m[0,0], ":", m[1,0], ":", m[0,1], ":", t[1,0,1];
        fim`);
    const entradas = ['4', '5'];
    const esperado = ['9:4:1:9:5:12'];
    assert.deepEqual((await executar(ast, entradas)).saida, esperado);
    assert.deepEqual(python(ast, entradas), esperado);
});

test('modulos com e sem parenteses executam uma vez; parametros e retorno', async () => {
    const ast = parse(`inicio
        saudacao; saudacao(); escrever dobro(4);
        fim
        modulo saudacao inicio escrever "oi"; fim modulo;
        modulo dobro(x: inteiro) inicio retorne x * 2; fim modulo;`);
    const esperado = ['oi', 'oi', '8'];
    assert.deepEqual((await executar(ast)).saida, esperado);
    assert.deepEqual(python(ast), esperado);
});

test('ChamadaModulo aceita argumentos na AST', async () => {
    const ast = parse('inicio fim modulo mostrar(x: inteiro) inicio escrever x; fim modulo;');
    ast.corpo.push(new Decl.ChamadaModulo(1, { lexema: 'mostrar', linha: 1 }, [new Literal(1, 6)]));
    assert.deepEqual((await executar(ast)).saida, ['6']);
    assert.deepEqual(python(ast), ['6']);
});

for (const [comando, mensagem] of [
    ['v[2] <- 1;', /limites/],
    ['escrever v[-1];', /limites/],
    ['v[0.5] <- 1;', /limites/],
    ['v[0,0] <- 1;', /indices/],
    ['v[0] <- "texto";', /tipo/],
]) {
    test(`rejeita acesso invalido: ${comando}`, async () => {
        await assert.rejects(executar(parse(`variaveis v: vetor[2] de inteiro; inicio ${comando} fim`)), mensagem);
    });
}

test('rejeita indice incompleto de matriz e dimensao zero', async () => {
    await assert.rejects(executar(parse('variaveis m: vetor[2,2] de inteiro; inicio escrever m[0]; fim')), /indices/);
    const ast = parse('variaveis v: vetor[0] de inteiro; inicio fim');
    await assert.rejects(executar(ast), /Dimensao/);
    assert.throws(() => new TranspiladorPython().transpilar(ast), /Dimensao/);
});

test('Visitor completo para declaracoes; Var e Fim podem ser visitados diretamente', async () => {
    const motor = new Interpretador();
    const transpilador = new TranspiladorPython();
    for (const nome of Object.keys(Decl)) {
        assert.equal(typeof motor[`visitar${nome}`], 'function', nome);
        assert.equal(typeof transpilador[`visitar${nome}`], 'function', nome);
    }
    const variavel = new Decl.Var(1, { lexema: 'x', linha: 1 }, { tipo: 'TIPO_INTEIRO' });
    await variavel.aceitar(motor);
    assert.equal(motor.ambiente.obter(variavel.nome), null);
    variavel.aceitar(transpilador);
    assert.equal(transpilador.escritor.getResultado(), 'x = None\n');
    assert.equal(new Decl.Fim(1, {}).aceitar(motor), null);
    assert.equal(new Decl.Fim(1, {}).aceitar(transpilador), null);
});

test('ler respeita tipo declarado e acessa vetor no escopo externo', async () => {
    const ast = parse(`variaveis s: cadeia; r: real; v: vetor[2] de inteiro;
        inicio ler s; ler r; preencher; escrever s, ":", r, ":", v[0]; fim
        modulo preencher inicio ler v[0]; fim modulo;`);
    const entradas = ['0012', '2.5', '8'];
    assert.deepEqual((await executar(ast, entradas)).saida, ['0012:2.5:8']);
    assert.deepEqual(python(ast, entradas), ['0012:2.5:8']);
});

test('condicionais e repeticoes continuam funcionando', async () => {
    const ast = parse(`variaveis i, soma: inteiro;
        inicio soma <- 0;
        para i de 0 ate 2 faca soma <- soma + i; fim para;
        enquanto soma < 5 faca soma <- soma + 1; fim enquanto;
        repita soma <- soma + 1; ate soma = 6;
        se soma = 6 entao escrever soma; senao escrever 0; fim se;
        fim`);
    assert.deepEqual((await executar(ast)).saida, ['6']);
    assert.deepEqual(python(ast), ['6']);
});
