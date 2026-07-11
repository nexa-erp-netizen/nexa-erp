import { calcularAliquotaEfetivaSimples } from "./calcularAliquotaEfetiva"

function criarErro(mensagem, codigo) {
  const erro = new Error(mensagem)
  erro.codigo = codigo
  return erro
}

function numeroPositivo(valor, campo) {
  const numero = Number(valor)

  if (!Number.isFinite(numero) || numero <= 0) {
    throw criarErro(`${campo} deve ser um número maior que zero.`, "DAS_ENTRADA_INVALIDA")
  }

  return numero
}

function arredondarMoeda(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor)
}

function formatarPercentual(valor, casas = 4) {
  return `${Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`
}

/**
 * Calcula o DAS-base estimado do Simples Nacional.
 *
 * Fórmula desta etapa:
 * receita tributável do período × alíquota efetiva.
 *
 * ATENÇÃO: o PGDAS-D calcula o valor definitivo após a segregação das receitas
 * e a aplicação de regras específicas (monofásico, ST, retenções, imunidades,
 * sublimites, ISS/ICMS, exportação, caixa/competência e demais particularidades).
 */
export function calcularDasSimples({
  anexo,
  rbt12,
  receitaPeriodo,
} = {}) {
  const receitaTributavel = numeroPositivo(
    receitaPeriodo,
    "Receita tributável do período",
  )
  const aliquota = calcularAliquotaEfetivaSimples(anexo, rbt12)
  const valorBruto = receitaTributavel * aliquota.aliquotaEfetiva
  const valorDasBase = arredondarMoeda(valorBruto)

  return Object.freeze({
    tipo: "DAS_BASE_ESTIMADO",
    status: "SIMULACAO_PARA_CONFERENCIA",
    anexo: aliquota.anexo,
    descricaoAnexo: aliquota.descricaoAnexo,
    faixa: aliquota.faixa,
    rbt12: aliquota.rbt12,
    receitaPeriodo: receitaTributavel,
    aliquotaNominal: aliquota.aliquotaNominal,
    aliquotaNominalPercentual: aliquota.aliquotaNominalPercentual,
    parcelaDeduzir: aliquota.parcelaDeduzir,
    aliquotaEfetiva: aliquota.aliquotaEfetiva,
    aliquotaEfetivaPercentual: aliquota.aliquotaEfetivaPercentual,
    valorBruto,
    valorDasBase,
    formula: "Receita tributável do período × alíquota efetiva",
    memoriaCalculo: Object.freeze({
      receitaTributavel,
      aliquotaEfetiva: aliquota.aliquotaEfetiva,
      multiplicacao: valorBruto,
      resultadoArredondado: valorDasBase,
      calculoAliquota: aliquota.memoriaCalculo,
    }),
    explicacao:
      `A RBT12 enquadrou o cenário na ${aliquota.faixa}ª faixa do Anexo ${aliquota.anexo}. ` +
      `A alíquota efetiva calculada foi ${formatarPercentual(aliquota.aliquotaEfetivaPercentual)}. ` +
      `Aplicando essa alíquota sobre a receita tributável do período de ` +
      `${formatarMoeda(receitaTributavel)}, o DAS-base estimado é ` +
      `${formatarMoeda(valorDasBase)}.`,
    avisos: Object.freeze([
      "Este resultado é uma estimativa interna para conferência do contador.",
      "O valor definitivo deve ser apurado e transmitido no PGDAS-D.",
      "A simulação não considera segregação de receitas, tributação monofásica, substituição tributária, retenções, exportação, sublimites, benefícios ou particularidades estaduais e municipais.",
      "No Anexo IV, a contribuição previdenciária patronal não integra o DAS e deve ser analisada separadamente.",
    ]),
  })
}
