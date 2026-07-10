import { METADADOS_BIBLIOTECA_SIMPLES } from "../tabelas/simplesNacional"
import { buscarFaixaSimples } from "./buscarFaixa"

function validarRbt12ParaCalculo(rbt12) {
  const valor = Number(rbt12)

  if (!Number.isFinite(valor) || valor <= 0) {
    const erro = new Error(
      "Para calcular a alíquota efetiva, a RBT12 deve ser um número maior que zero.",
    )
    erro.codigo = "RBT12_CALCULO_INVALIDA"
    throw erro
  }

  return valor
}

function arredondar(valor, casas = 8) {
  const fator = 10 ** casas
  return Math.round((valor + Number.EPSILON) * fator) / fator
}

/**
 * Calcula a alíquota efetiva do Simples Nacional.
 *
 * Fórmula legal:
 * [(RBT12 × alíquota nominal) − parcela a deduzir] ÷ RBT12
 *
 * Esta função NÃO calcula o DAS, não faz segregação de receitas,
 * não trata Fator R, sublimites, retenções, monofásicos ou substituição tributária.
 */
export function calcularAliquotaEfetivaSimples(anexo, rbt12) {
  const receita = validarRbt12ParaCalculo(rbt12)
  const faixa = buscarFaixaSimples(anexo, receita)
  const produtoRbtAliquota = receita * faixa.aliquotaNominal
  const baseAposDeducao = produtoRbtAliquota - faixa.parcelaDeduzir
  const aliquotaEfetiva = baseAposDeducao / receita

  if (!Number.isFinite(aliquotaEfetiva) || aliquotaEfetiva < 0) {
    const erro = new Error("O cálculo produziu uma alíquota efetiva inválida.")
    erro.codigo = "ALIQUOTA_EFETIVA_INVALIDA"
    throw erro
  }

  const aliquotaEfetivaPercentual = aliquotaEfetiva * 100

  return Object.freeze({
    anexo: faixa.anexo,
    descricaoAnexo: faixa.descricaoAnexo,
    faixa: faixa.faixa,
    rbt12: receita,
    limiteInferior: faixa.limiteInferior,
    limiteSuperior: faixa.limiteSuperior,
    aliquotaNominal: faixa.aliquotaNominal,
    aliquotaNominalPercentual: faixa.aliquotaNominal * 100,
    parcelaDeduzir: faixa.parcelaDeduzir,
    aliquotaEfetiva,
    aliquotaEfetivaPercentual,
    aliquotaEfetivaArredondada: arredondar(aliquotaEfetiva, 8),
    aliquotaEfetivaPercentualArredondada: arredondar(aliquotaEfetivaPercentual, 6),
    formula: "[(RBT12 × alíquota nominal) − parcela a deduzir] ÷ RBT12",
    memoriaCalculo: Object.freeze({
      rbt12: receita,
      aliquotaNominal: faixa.aliquotaNominal,
      produtoRbtAliquota,
      parcelaDeduzir: faixa.parcelaDeduzir,
      baseAposDeducao,
      divisor: receita,
      resultado: aliquotaEfetiva,
    }),
    explicacao:
      `A RBT12 de R$ ${receita.toFixed(2)} enquadra a empresa na faixa ${faixa.faixa} ` +
      `do Anexo ${faixa.anexo}. Aplicando a alíquota nominal de ` +
      `${(faixa.aliquotaNominal * 100).toFixed(2)}% e a parcela a deduzir de ` +
      `R$ ${faixa.parcelaDeduzir.toFixed(2)}, a alíquota efetiva é ` +
      `${aliquotaEfetivaPercentual.toFixed(6)}%.`,
    biblioteca: METADADOS_BIBLIOTECA_SIMPLES,
    avisos: Object.freeze([
      "Resultado destinado à conferência do contador.",
      "O valor do DAS ainda não é calculado nesta Sprint.",
      "Empresas em início de atividade exigem regra própria de receita proporcionalizada e não devem usar RBT12 igual a zero nesta função.",
    ]),
  })
}
