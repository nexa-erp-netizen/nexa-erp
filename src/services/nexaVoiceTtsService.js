import api from "./api"

export async function verificarVozNeural() {
  try {
    const resposta = await api.get("/conversa/voz/status", { timeout: 7000 })
    return {
      neuralDisponivel: Boolean(resposta.data?.neuralDisponivel),
      vozNeural: resposta.data?.vozNeural || "pt-BR-FranciscaNeural",
      fallback: resposta.data?.fallback || "Microsoft Maria (pt-BR)",
    }
  } catch {
    return {
      neuralDisponivel: false,
      vozNeural: "pt-BR-FranciscaNeural",
      fallback: "Microsoft Maria (pt-BR)",
    }
  }
}

export async function sintetizarVozNeural(texto) {
  const resposta = await api.post(
    "/conversa/voz/sintetizar",
    { texto },
    {
      responseType: "blob",
      timeout: 25000,
      headers: { Accept: "audio/mpeg" },
    },
  )

  return resposta.data
}
