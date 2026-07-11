# Sprint 05 — Motor do DAS

## Objetivo

Criar o primeiro cálculo centralizado do DAS-base estimado no Nexa Core, reutilizando a Biblioteca Tributária e o cálculo da alíquota efetiva.

## Fórmula implementada

`DAS-base estimado = receita tributável do período × alíquota efetiva`

## Entregas

- função `calcularDasSimples` no Motor Tributário;
- validações de RBT12 e receita do período;
- memória completa da alíquota e do DAS-base;
- explicação textual da Nexa;
- integração com o Laboratório Tributário;
- nomenclatura explícita de **DAS-base estimado**, evitando confundir a simulação com a apuração definitiva do PGDAS-D.

## Limites desta Sprint

A apuração definitiva continua sendo feita no PGDAS-D. Esta Sprint ainda não contempla:

- segregação por atividade e estabelecimento;
- substituição tributária;
- tributação monofásica;
- retenções;
- exportação;
- sublimites estaduais;
- benefícios fiscais;
- particularidades municipais de ISS;
- composição/partilha definitiva de cada tributo;
- CPP fora do DAS para o Anexo IV.

## Segurança

O resultado é destinado à simulação e conferência do contador. Nenhuma informação é transmitida nem salva em cliente real.
