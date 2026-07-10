/**
 * Biblioteca Tributária do Simples Nacional — Nexa
 *
 * Fonte normativa principal:
 * - Lei Complementar nº 123/2006, com tabelas na redação da LC nº 155/2016.
 * - Vigência das tabelas: 01/01/2018.
 *
 * IMPORTANTE:
 * Esta biblioteca armazena somente faixa, alíquota nominal e parcela a deduzir.
 * Ela ainda NÃO calcula alíquota efetiva, Fator R, partilha ou DAS.
 */

export const LIMITE_GERAL_SIMPLES = 4_800_000

export const METADADOS_BIBLIOTECA_SIMPLES = Object.freeze({
  nome: "Biblioteca Tributária do Simples Nacional",
  versao: "2026.07",
  vigenciaInicio: "2018-01-01",
  vigenciaFim: null,
  verificadoEm: "2026-07-10",
  fonteLegal: "Lei Complementar nº 123/2006, Anexos I a V, redação da LC nº 155/2016",
  observacao:
    "Revisar a legislação antes de liberar cálculos em produção, especialmente durante a transição da reforma tributária.",
})

function faixa(numero, limiteInferior, limiteSuperior, aliquotaNominal, parcelaDeduzir) {
  return Object.freeze({
    numero,
    limiteInferior,
    limiteSuperior,
    aliquotaNominal,
    parcelaDeduzir,
  })
}

export const TABELAS_SIMPLES_NACIONAL = Object.freeze({
  I: Object.freeze({
    codigo: "I",
    descricao: "Comércio",
    faixas: Object.freeze([
      faixa(1, 0, 180_000, 0.04, 0),
      faixa(2, 180_000, 360_000, 0.073, 5_940),
      faixa(3, 360_000, 720_000, 0.095, 13_860),
      faixa(4, 720_000, 1_800_000, 0.107, 22_500),
      faixa(5, 1_800_000, 3_600_000, 0.143, 87_300),
      faixa(6, 3_600_000, 4_800_000, 0.19, 378_000),
    ]),
  }),

  II: Object.freeze({
    codigo: "II",
    descricao: "Indústria",
    faixas: Object.freeze([
      faixa(1, 0, 180_000, 0.045, 0),
      faixa(2, 180_000, 360_000, 0.078, 5_940),
      faixa(3, 360_000, 720_000, 0.10, 13_860),
      faixa(4, 720_000, 1_800_000, 0.112, 22_500),
      faixa(5, 1_800_000, 3_600_000, 0.147, 85_500),
      faixa(6, 3_600_000, 4_800_000, 0.30, 720_000),
    ]),
  }),

  III: Object.freeze({
    codigo: "III",
    descricao: "Serviços — Anexo III",
    faixas: Object.freeze([
      faixa(1, 0, 180_000, 0.06, 0),
      faixa(2, 180_000, 360_000, 0.112, 9_360),
      faixa(3, 360_000, 720_000, 0.135, 17_640),
      faixa(4, 720_000, 1_800_000, 0.16, 35_640),
      faixa(5, 1_800_000, 3_600_000, 0.21, 125_640),
      faixa(6, 3_600_000, 4_800_000, 0.33, 648_000),
    ]),
  }),

  IV: Object.freeze({
    codigo: "IV",
    descricao: "Serviços — Anexo IV",
    faixas: Object.freeze([
      faixa(1, 0, 180_000, 0.045, 0),
      faixa(2, 180_000, 360_000, 0.09, 8_100),
      faixa(3, 360_000, 720_000, 0.102, 12_420),
      faixa(4, 720_000, 1_800_000, 0.14, 39_780),
      faixa(5, 1_800_000, 3_600_000, 0.22, 183_780),
      faixa(6, 3_600_000, 4_800_000, 0.33, 828_000),
    ]),
  }),

  V: Object.freeze({
    codigo: "V",
    descricao: "Serviços — Anexo V",
    faixas: Object.freeze([
      faixa(1, 0, 180_000, 0.155, 0),
      faixa(2, 180_000, 360_000, 0.18, 4_500),
      faixa(3, 360_000, 720_000, 0.195, 9_900),
      faixa(4, 720_000, 1_800_000, 0.205, 17_100),
      faixa(5, 1_800_000, 3_600_000, 0.23, 62_100),
      faixa(6, 3_600_000, 4_800_000, 0.305, 540_000),
    ]),
  }),
})

export const CODIGOS_ANEXOS_SIMPLES = Object.freeze(Object.keys(TABELAS_SIMPLES_NACIONAL))
