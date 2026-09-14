# Testes do motor Mapler

Execute `npm test` na pasta `backend`.

Requisitos: Node.js 18 ou superior e Python 3 disponível como `python` no PATH.
Não são necessárias dependências extras. Os testes usam `node:test` e executam
o Python gerado em subprocessos com limite de dez segundos.

A suíte percorre léxico, parser e interpretador, e compara saídas de programas
válidos com a execução do Python gerado. Cobre vetores, matrizes, três dimensões,
entrada, módulos, retorno, condicionais, repetições e visita direta de nós.
Os testes de rejeição de índices e tipos inválidos verificam o interpretador;
o Python gerado usa as regras nativas de listas e tipos do Python.

Vetores usam índices a partir de zero. Exemplo: `vetor[2,3] de inteiro`
possui dois conjuntos de três elementos, acessados como `m[0,2]` em Mapler.
