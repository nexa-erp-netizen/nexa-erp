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
