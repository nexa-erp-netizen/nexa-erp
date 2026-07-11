# Motor Tributário da Nexa

## Princípio
Nenhuma tela deve realizar cálculo tributário diretamente. Regras, tabelas e cálculos ficam centralizados no Motor Tributário.

## v3.4.1 — DNA Empresarial
Registra regime, ramo, anexo, Fator R, ISS, datas tributárias e situação da empresa.

## v3.4.2 — Biblioteca Tributária do Simples Nacional
Inclui os Anexos I a V, cada um com as seis faixas de RBT12, alíquota nominal e parcela a deduzir.

## v3.4.3 — Alíquota Efetiva
Calcula a alíquota efetiva pela fórmula legal:

```text
[(RBT12 × alíquota nominal) − parcela a deduzir] ÷ RBT12
```

### Funções disponíveis

```js
import {
  buscarAnexoSimples,
  buscarFaixaSimples,
  calcularAliquotaEfetivaSimples,
  TABELAS_SIMPLES_NACIONAL,
} from "../motorTributario"
```

Exemplo:

```js
const resultado = calcularAliquotaEfetivaSimples("III", 580000)

console.log(resultado.faixa)
console.log(resultado.aliquotaEfetivaPercentual)
console.log(resultado.memoriaCalculo)
console.log(resultado.explicacao)
```

## Limites atuais
Esta versão ainda não calcula:

- Fator R;
- valor do DAS;
- partilha entre tributos;
- sublimites de ICMS/ISS;
- segregação de receitas;
- retenções, substituição tributária ou tributação monofásica;
- regra proporcionalizada para empresas em início de atividade.

## Base normativa
Lei Complementar nº 123/2006 e materiais oficiais do Simples Nacional.

## Segurança
Todo resultado deve mostrar entradas, regra aplicada, memória de cálculo, vigência da tabela e aviso para revisão do contador. As tabelas devem ser revisadas quando houver mudança legislativa.

## v3.4.4 — Fator R e Consultoria Tributária

Calcula o Fator R conforme o contexto da empresa e sugere o Anexo III ou V apenas para atividades legalmente sujeitas à regra.

```js
import {
  calcularFatorR,
  compararAnexosFatorR,
} from "../motorTributario"

const fator = calcularFatorR({
  fs12: 100000,
  rbt12: 500000,
})

console.log(fator.fatorRConsiderado) // 0.20
console.log(fator.anexoSugerido) // V
console.log(fator.folhaAdicionalNecessaria) // 40000

const comparacao = compararAnexosFatorR({
  rbt12: 500000,
  receitaPeriodo: 10000,
})
```

### Regras implementadas

- Regra geral: `FS12 ÷ RBT12`.
- Mês de abertura: `FSPA ÷ RPA`.
- Início de atividade antes de completar 13 meses: folha acumulada desde a abertura dividida pela receita acumulada no mesmo período.
- Se folha e receita forem zero: fator considerado `0,01`.
- Se folha for zero e receita positiva: fator considerado `0,01`.
- Se folha for positiva e receita zero: fator considerado `0,28`.
- O resultado usado para enquadramento considera duas casas decimais sem arredondamento.
- Resultado igual ou superior a `0,28`: Anexo III.
- Resultado inferior a `0,28`: Anexo V.

### Limites da simulação

A função não decide se um CNAE está sujeito ao Fator R e não recomenda automaticamente aumento de pró-labore ou salários. Qualquer cenário deve considerar encargos, caixa, legislação trabalhista, substância econômica e validação profissional.

## Sprint 05 — Motor do DAS

O Nexa Core passou a calcular o **DAS-base estimado** pela aplicação da alíquota efetiva sobre a receita tributável do período.

A função não substitui o PGDAS-D. O valor definitivo depende da segregação das receitas e das regras específicas da operação, do estabelecimento, do estado e do município.
