/**
 * Nexa Core — Motor Tributário
 * Ponto único de entrada da biblioteca tributária no frontend.
 */

export const REGIMES_TRIBUTARIOS = Object.freeze([
  "MEI",
  "Simples Nacional",
  "Lucro Presumido",
  "Lucro Real",
])

export const RAMOS_ATIVIDADE = Object.freeze(["Serviços", "Comércio", "Indústria", "Misto"])
export const ANEXOS_SIMPLES = Object.freeze(["I", "II", "III", "IV", "V"])

export {
  CODIGOS_ANEXOS_SIMPLES,
  LIMITE_GERAL_SIMPLES,
  METADADOS_BIBLIOTECA_SIMPLES,
  TABELAS_SIMPLES_NACIONAL,
} from "./tabelas/simplesNacional"

export { buscarAnexoSimples, normalizarCodigoAnexo } from "./simples/buscarAnexo"
export { buscarFaixaSimples } from "./simples/buscarFaixa"

export function normalizarDnaTributario(cliente = {}) {
  const simples = cliente.regime === "Simples Nacional"

  return {
    regime: cliente.regime || "",
    ramoAtividade: cliente.ramoAtividade || "",
    anexoSimples: simples ? cliente.anexoSimples || "" : "",
    utilizaFatorR: simples ? cliente.utilizaFatorR || "" : "",
    aliquotaIss: cliente.aliquotaIss ?? null,
    municipio: cliente.cidade || "",
    estado: cliente.estado || "",
    cnaePrincipal: cliente.cnaePrincipal || "",
    dataOpcaoRegime: cliente.dataOpcaoRegime || null,
    dataInicioAtividades: cliente.dataInicioAtividades || null,
    situacaoEmpresa: cliente.situacaoEmpresa || "Ativa",
  }
}
