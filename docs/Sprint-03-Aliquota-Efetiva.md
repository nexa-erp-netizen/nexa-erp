# Sprint 03 — Alíquota Efetiva do Simples Nacional

## Objetivo
Aplicar a fórmula legal da alíquota efetiva usando a RBT12, a alíquota nominal e a parcela a deduzir da faixa correta.

## Fórmula

```text
[(RBT12 × alíquota nominal) − parcela a deduzir] ÷ RBT12
```

## Função pública

```js
import { calcularAliquotaEfetivaSimples } from "../motorTributario"

const resultado = calcularAliquotaEfetivaSimples("III", 580000)
```

A resposta contém:

- anexo e descrição;
- faixa encontrada;
- RBT12;
- alíquota nominal;
- parcela a deduzir;
- alíquota efetiva em decimal e percentual;
- memória completa do cálculo;
- explicação em linguagem clara;
- vigência e fonte da biblioteca;
- avisos de segurança.

## Segurança

- RBT12 deve ser maior que zero.
- Receita acima do limite geral da biblioteca é rejeitada.
- O cálculo não arredonda internamente antes do resultado final.
- A função ainda não calcula DAS, Fator R, segregação de receitas, partilha, sublimites, retenções, receitas monofásicas ou substituição tributária.
- Empresas em início de atividade exigem tratamento próprio de receita proporcionalizada e não devem ser calculadas informando RBT12 igual a zero.

## Base normativa
Lei Complementar nº 123/2006 e materiais oficiais do Simples Nacional, que definem a alíquota efetiva como o resultado de `[(RBT12 × alíquota nominal) − parcela a deduzir] ÷ RBT12`.
