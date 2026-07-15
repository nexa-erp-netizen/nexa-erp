import api from "./api"

export async function conversarComNexa({ mensagem, clienteId = null }) {
  const resposta = await api.post("/conversa", { mensagem, clienteId })
  return resposta.data
}
