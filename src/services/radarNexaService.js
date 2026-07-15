import api from "./api"

export async function carregarRadarNexa() {
  const resposta = await api.get("/radar-nexa")
  return resposta.data
}
