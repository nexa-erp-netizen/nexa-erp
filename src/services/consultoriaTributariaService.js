import api from "./api"

export async function simularConsultoriaTributaria(clienteId, dados) {
  if (!clienteId) throw new Error("Selecione um cliente para a simulação.")
  const resposta = await api.post(`/consultoria-tributaria/${clienteId}/simular`, dados)
  return resposta.data
}
