# Motor Tributário da Nexa

## Princípio
Nenhuma tela deve realizar cálculo tributário diretamente. Regras, tabelas e cálculos ficam centralizados no Motor Tributário.

## v3.4.1 — DNA Empresarial
Registra regime, ramo, anexo, Fator R, ISS, datas tributárias e situação da empresa.

## v3.4.2 — Biblioteca Tributária do Simples Nacional
Inclui os Anexos I a V, cada um com as seis faixas de RBT12, alíquota nominal e parcela a deduzir.

### Funções disponíveis

```js
import {
  buscarAnexoSimples,
  buscarFaixaSimples,
  TABELAS_SIMPLES_NACIONAL,
} from "../motorTributario"
```

Exemplo:

```js
const resultado = buscarFaixaSimples("III", 420000)
```

Resultado esperado:

```js
{
  anexo: "III",
  faixa: 3,
  aliquotaNominal: 0.135,
  parcelaDeduzir: 17640
}
```

## Limites desta Sprint
Esta versão ainda não calcula:

- alíquota efetiva;
- Fator R;
- valor do DAS;
- partilha entre tributos;
- sublimites de ICMS/ISS;
- segregação de receitas;
- retenções, substituição tributária ou tributação monofásica.

## Base normativa
Lei Complementar nº 123/2006, Anexos I a V, na redação dada pela Lei Complementar nº 155/2016, com produção de efeitos a partir de 01/01/2018.

## Segurança
Todo resultado futuro deverá mostrar entradas, regra aplicada, memória de cálculo, vigência da tabela e aviso para revisão do contador. As tabelas devem ser revisadas quando houver mudança legislativa.
