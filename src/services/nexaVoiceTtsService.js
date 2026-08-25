import api from "./api"

export async function verificarVozNeural() {
  try {
    const resposta = await api.get("/conversa/voz/status", { timeout: 7000 })
    return {
      neuralDisponivel: Boolean(resposta.data?.neuralDisponivel),
      provedor: resposta.data?.provedor || "voz-neural",
      vozNeural: resposta.data?.vozNeural || "pt-BR-FranciscaNeural",
      fallback: resposta.data?.fallback || "Microsoft Maria (pt-BR)",
      transcricaoDisponivel: Boolean(resposta.data?.transcricaoDisponivel),
      transcricaoProvedor: resposta.data?.transcricaoProvedor || "transcrição da API",
      transcricaoModelo: resposta.data?.transcricaoModelo || "",
      transcricaoReserva: resposta.data?.transcricaoReserva || null,
    }
  } catch {
    return {
      neuralDisponivel: false,
      provedor: "windows",
      vozNeural: "pt-BR-FranciscaNeural",
      fallback: "Microsoft Maria (pt-BR)",
      transcricaoDisponivel: false,
      transcricaoProvedor: "indisponível",
      transcricaoModelo: "",
      transcricaoReserva: null,
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

export async function transcreverVoz(audioBlob, { prompt = "" } = {}) {
  if (!(audioBlob instanceof Blob) || !audioBlob.size) {
    throw new Error("Áudio vazio.")
  }

  const formulario = new FormData()
  const tipo = String(audioBlob.type || "audio/webm")
  const extensao = tipo.includes("ogg") ? "ogg" : tipo.includes("wav") ? "wav" : "webm"
  formulario.append("audio", audioBlob, `nexa-voz.${extensao}`)
  if (prompt) formulario.append("prompt", String(prompt).slice(0, 700))

  const resposta = await api.post("/conversa/voz/transcrever", formulario, {
    timeout: 35000,
    headers: { Accept: "application/json" },
  })

  return {
    texto: String(resposta.data?.texto || "").trim(),
    provedor: resposta.data?.provedor || "transcrição da API",
    modelo: resposta.data?.modelo || "",
  }
}

// Compatibilidade temporária com componentes antigos.
export const transcreverVozGroq = transcreverVoz
