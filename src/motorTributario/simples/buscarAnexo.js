import { TABELAS_SIMPLES_NACIONAL } from "../tabelas/simplesNacional"

const MAPA_ANEXOS = Object.freeze({
  "1": "I",
  "2": "II",
  "3": "III",
  "4": "IV",
  "5": "V",
  I: "I",
  II: "II",
  III: "III",
  IV: "IV",
  V: "V",
})

export function normalizarCodigoAnexo(anexo) {
  const valor = String(anexo ?? "").trim().toUpperCase().replace(/^ANEXO\s+/, "")
  const codigo = MAPA_ANEXOS[valor]

  if (!codigo) {
    const erro = new Error(`Anexo inválido: ${anexo ?? "não informado"}. Use I, II, III, IV ou V.`)
    erro.codigo = "ANEXO_SIMPLES_INVALIDO"
    throw erro
  }

  return codigo
}

export function buscarAnexoSimples(anexo) {
  const codigo = normalizarCodigoAnexo(anexo)
  return TABELAS_SIMPLES_NACIONAL[codigo]
}
