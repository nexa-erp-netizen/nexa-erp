# Sprint 02 — Biblioteca Tributária

## Objetivo
Criar a fonte única de faixas, alíquotas nominais e parcelas a deduzir do Simples Nacional.

## Escopo entregue
- Anexos I a V.
- Seis faixas de RBT12 por anexo.
- Busca de anexo por número romano ou arábico.
- Busca de faixa com tratamento correto das fronteiras.
- Metadados de versão, vigência e fonte normativa.

## Casos de teste mínimos
- RBT12 180.000,00 → faixa 1.
- RBT12 180.000,01 → faixa 2.
- RBT12 4.800.000,00 → faixa 6.
- RBT12 superior a 4.800.000,00 → erro controlado.
- Anexo inexistente → erro controlado.

## Próxima Sprint
Cálculo da alíquota efetiva com memória de cálculo auditável.
