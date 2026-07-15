import api from "./api"

export async function carregarRecomendacoesCliente(clienteId) {
  if (!clienteId) throw new Error("Selecione um cliente para a análise.")
  const resposta = await api.get(`/recomendacoes/${clienteId}`)
  return resposta.data
}
