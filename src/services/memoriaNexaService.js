import api from "./api"

export async function carregarMemoriaCliente(clienteId) {
  if (!clienteId) {
    throw new Error("Selecione um cliente para carregar a memória.")
  }

  const resposta = await api.get(`/memoria/${clienteId}`)
  return resposta.data
}
