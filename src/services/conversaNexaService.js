import api from "./api"

export async function conversarComNexa({ mensagem, clienteId = null, historico = [] }) {
  const historicoCompacto = Array.isArray(historico)
    ? historico.slice(-14).map((item) => ({ autor: item.autor, texto: item.texto }))
    : []

  const resposta = await api.post("/conversa", {
    mensagem,
    clienteId,
    historico: historicoCompacto,
  })

  return resposta.data
}
