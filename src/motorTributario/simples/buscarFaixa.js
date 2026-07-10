import { LIMITE_GERAL_SIMPLES } from "../tabelas/simplesNacional"
import { buscarAnexoSimples } from "./buscarAnexo"

function validarRbt12(rbt12) {
  const valor = Number(rbt12)

  if (!Number.isFinite(valor) || valor < 0) {
    const erro = new Error("RBT12 deve ser um número igual ou maior que zero.")
    erro.codigo = "RBT12_INVALIDA"
    throw erro
  }

  if (valor > LIMITE_GERAL_SIMPLES) {
    const erro = new Error(
      `RBT12 de R$ ${valor.toFixed(2)} ultrapassa o limite geral de R$ ${LIMITE_GERAL_SIMPLES.toFixed(2)} desta biblioteca.`,
    )
    erro.codigo = "RBT12_ACIMA_LIMITE_SIMPLES"
    throw erro
  }

  return valor
}

/**
 * Localiza a faixa pela RBT12.
 * Regra de fronteira: o limite superior pertence à faixa atual.
 * Ex.: R$ 180.000,00 = faixa 1; R$ 180.000,01 = faixa 2.
 */
export function buscarFaixaSimples(anexo, rbt12) {
  const tabela = buscarAnexoSimples(anexo)
  const receita = validarRbt12(rbt12)
  const encontrada = tabela.faixas.find((item) => receita <= item.limiteSuperior)

  if (!encontrada) {
    const erro = new Error("Não foi possível localizar a faixa do Simples Nacional.")
    erro.codigo = "FAIXA_SIMPLES_NAO_ENCONTRADA"
    throw erro
  }

  return Object.freeze({
    anexo: tabela.codigo,
    descricaoAnexo: tabela.descricao,
    rbt12: receita,
    faixa: encontrada.numero,
    limiteInferior: encontrada.limiteInferior,
    limiteSuperior: encontrada.limiteSuperior,
    aliquotaNominal: encontrada.aliquotaNominal,
    parcelaDeduzir: encontrada.parcelaDeduzir,
  })
}
