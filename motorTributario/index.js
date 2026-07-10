/**
 * Fundação do Motor Tributário da Nexa.
 * Nesta versão o módulo apenas normaliza o DNA tributário da empresa.
 * Cálculos serão adicionados em versões futuras e nunca ficarão nas telas.
 */
export const REGIMES_TRIBUTARIOS = ["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real"]
export const RAMOS_ATIVIDADE = ["Serviços", "Comércio", "Indústria", "Misto"]
export const ANEXOS_SIMPLES = ["I", "II", "III", "IV", "V"]

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
