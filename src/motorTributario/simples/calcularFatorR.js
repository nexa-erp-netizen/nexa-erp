import { calcularAliquotaEfetivaSimples } from "./calcularAliquotaEfetiva"

export const LIMITE_FATOR_R = 0.28

const MODOS_FATOR_R = Object.freeze({
  NORMAL: "normal",
  MES_ABERTURA: "mes_abertura",
  INICIO_ATIVIDADE: "inicio_atividade",
})

function criarErro(mensagem, codigo) {
  const erro = new Error(mensagem)
  erro.codigo = codigo
  return erro
}

function numeroNaoNegativo(valor, campo) {
  const numero = Number(valor)

  if (!Number.isFinite(numero) || numero < 0) {
    throw criarErro(`${campo} deve ser um número igual ou maior que zero.`, "FATOR_R_ENTRADA_INVALIDA")
  }

  return numero
}

function truncar(valor, casas = 2) {
  const fator = 10 ** casas
  return Math.trunc(valor * fator) / fator
}

function arredondar(valor, casas = 8) {
  const fator = 10 ** casas
  return Math.round((valor + Number.EPSILON) * fator) / fator
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor)
}

function formatarPercentual(valor, casas = 2) {
  return `${(valor * 100).toFixed(casas).replace(".", ",")}%`
}

function resolverValores({ modo, fs12, rbt12, folhaPeriodo, receitaPeriodo, folhaAcumulada, receitaAcumulada }) {
  if (modo === MODOS_FATOR_R.MES_ABERTURA) {
    return {
      folha: numeroNaoNegativo(folhaPeriodo, "Folha do período de apuração (FSPA)"),
      receita: numeroNaoNegativo(receitaPeriodo, "Receita do período de apuração (RPA)"),
      rotuloFolha: "FSPA",
      rotuloReceita: "RPA",
    }
  }

  if (modo === MODOS_FATOR_R.INICIO_ATIVIDADE) {
    return {
      folha: numeroNaoNegativo(folhaAcumulada, "Folha acumulada desde a abertura"),
      receita: numeroNaoNegativo(receitaAcumulada, "Receita acumulada desde a abertura"),
      rotuloFolha: "Folha acumulada",
      rotuloReceita: "Receita acumulada",
    }
  }

  return {
    folha: numeroNaoNegativo(fs12, "Folha de salários dos 12 meses anteriores (FS12)"),
    receita: numeroNaoNegativo(rbt12, "Receita bruta dos 12 meses anteriores (RBT12)"),
    rotuloFolha: "FS12",
    rotuloReceita: "RBT12",
  }
}

function calcularRazaoComExcecoes(folha, receita) {
  if (folha === 0 && receita === 0) return { valor: 0.01, regraEspecial: "FOLHA_E_RECEITA_ZERO" }
  if (folha === 0 && receita > 0) return { valor: 0.01, regraEspecial: "FOLHA_ZERO" }
  if (folha > 0 && receita === 0) return { valor: 0.28, regraEspecial: "RECEITA_ZERO" }

  return { valor: folha / receita, regraEspecial: null }
}

/**
 * Calcula o Fator R para atividades sujeitas à comparação entre os Anexos III e V.
 *
 * O PGDAS-D considera duas casas decimais SEM arredondamento para definir o anexo.
 * Exemplo oficial: 0,2774 é considerado 0,27.
 *
 * modos:
 * - normal: FS12 / RBT12;
 * - mes_abertura: FSPA / RPA;
 * - inicio_atividade: soma da folha desde a abertura / soma das receitas desde a abertura.
 */
export function calcularFatorR({
  modo = MODOS_FATOR_R.NORMAL,
  fs12 = 0,
  rbt12 = 0,
  folhaPeriodo = 0,
  receitaPeriodo = 0,
  folhaAcumulada = 0,
  receitaAcumulada = 0,
} = {}) {
  if (!Object.values(MODOS_FATOR_R).includes(modo)) {
    throw criarErro(`Modo de cálculo do Fator R inválido: ${modo}.`, "FATOR_R_MODO_INVALIDO")
  }

  const valores = resolverValores({
    modo,
    fs12,
    rbt12,
    folhaPeriodo,
    receitaPeriodo,
    folhaAcumulada,
    receitaAcumulada,
  })

  const razao = calcularRazaoComExcecoes(valores.folha, valores.receita)
  const fatorRBruto = razao.valor
  const fatorRConsiderado = truncar(fatorRBruto, 2)
  const anexoSugerido = fatorRConsiderado >= LIMITE_FATOR_R ? "III" : "V"
  const atingiuLimite = anexoSugerido === "III"

  const folhaMinimaParaLimite = valores.receita * LIMITE_FATOR_R
  const folhaAdicionalNecessaria = Math.max(0, folhaMinimaParaLimite - valores.folha)
  const pontosPercentuaisParaLimite = Math.max(0, (LIMITE_FATOR_R - fatorRConsiderado) * 100)

  const explicacao = atingiuLimite
    ? `O Fator R considerado é ${formatarPercentual(fatorRConsiderado)}. Como ele é igual ou superior a 28%, a atividade sujeita ao Fator R deve ser analisada pelo Anexo III.`
    : `O Fator R considerado é ${formatarPercentual(fatorRConsiderado)}. Como ele é inferior a 28%, a atividade sujeita ao Fator R deve ser analisada pelo Anexo V.`

  return Object.freeze({
    modo,
    folha: valores.folha,
    receita: valores.receita,
    rotuloFolha: valores.rotuloFolha,
    rotuloReceita: valores.rotuloReceita,
    fatorRBruto,
    fatorRBrutoArredondado: arredondar(fatorRBruto, 8),
    fatorRConsiderado,
    fatorRPercentual: fatorRConsiderado * 100,
    limite: LIMITE_FATOR_R,
    limitePercentual: 28,
    atingiuLimite,
    anexoSugerido,
    regraEspecial: razao.regraEspecial,
    folhaMinimaParaLimite,
    folhaAdicionalNecessaria,
    pontosPercentuaisParaLimite,
    memoriaCalculo: Object.freeze({
      dividendo: valores.folha,
      divisor: valores.receita,
      resultadoBruto: fatorRBruto,
      criterioPgdas: "Duas casas decimais sem arredondamento",
      resultadoConsiderado: fatorRConsiderado,
    }),
    explicacao,
    recomendacao: atingiuLimite
      ? "O limite de 28% foi alcançado. Confirme se a atividade realmente está sujeita ao Fator R antes de aplicar o Anexo III."
      : `Faltam ${formatarMoeda(folhaAdicionalNecessaria)} de folha acumulada, mantida a mesma receita-base, para alcançar matematicamente 28%. Antes de qualquer alteração de pró-labore ou folha, avalie custos previdenciários, trabalhistas, caixa e substância econômica.`,
    avisos: Object.freeze([
      "O Fator R somente define Anexo III ou V para atividades legalmente sujeitas a essa regra.",
      "A composição da folha deve ser conferida com os valores pagos e informados nos sistemas previdenciários aplicáveis.",
      "A simulação de folha adicional não constitui recomendação automática de aumento de pró-labore ou salários.",
      "A decisão final e a validação da atividade pertencem ao contador.",
    ]),
  })
}

/**
 * Compara, para a mesma RBT12 e receita do período, o efeito matemático dos
 * Anexos III e V. Não valida CNAE nem elegibilidade da atividade.
 */
export function compararAnexosFatorR({ rbt12, receitaPeriodo }) {
  const receita12 = numeroNaoNegativo(rbt12, "RBT12")
  const receitaPA = numeroNaoNegativo(receitaPeriodo, "Receita do período")

  if (receita12 <= 0) {
    throw criarErro("A RBT12 deve ser maior que zero para comparar os Anexos III e V.", "RBT12_COMPARACAO_INVALIDA")
  }

  const anexoIII = calcularAliquotaEfetivaSimples("III", receita12)
  const anexoV = calcularAliquotaEfetivaSimples("V", receita12)
  const valorIII = receitaPA * anexoIII.aliquotaEfetiva
  const valorV = receitaPA * anexoV.aliquotaEfetiva
  const diferencaPeriodo = valorV - valorIII

  return Object.freeze({
    rbt12: receita12,
    receitaPeriodo: receitaPA,
    anexoIII: Object.freeze({
      aliquotaEfetiva: anexoIII.aliquotaEfetiva,
      aliquotaEfetivaPercentual: anexoIII.aliquotaEfetivaPercentual,
      valorEstimado: valorIII,
    }),
    anexoV: Object.freeze({
      aliquotaEfetiva: anexoV.aliquotaEfetiva,
      aliquotaEfetivaPercentual: anexoV.aliquotaEfetivaPercentual,
      valorEstimado: valorV,
    }),
    diferencaPeriodo,
    diferencaAnualLinear: diferencaPeriodo * 12,
    anexoMenorNesteCenario: valorIII <= valorV ? "III" : "V",
    explicacao:
      `Para uma receita do período de ${formatarMoeda(receitaPA)}, a estimativa matemática é ` +
      `${formatarMoeda(valorIII)} no Anexo III e ${formatarMoeda(valorV)} no Anexo V. ` +
      `A diferença do período é ${formatarMoeda(Math.abs(diferencaPeriodo))}.`,
    avisos: Object.freeze([
      "Comparação meramente estimativa, sem segregação de receitas, retenções, ISS fixo, sublimites ou particularidades do PGDAS-D.",
      "A comparação não confirma que o CNAE ou a receita são elegíveis ao Fator R.",
      "A projeção anual linear pressupõe receita e parâmetros constantes por 12 meses.",
    ]),
  })
}

export { MODOS_FATOR_R }
