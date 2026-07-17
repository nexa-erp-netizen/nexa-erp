import api from "./api"

const OLLAMA_URL_PADRAO = "http://localhost:11434"
const OLLAMA_MODEL_PADRAO = "llama3.2:3b"

function configuracaoLocal() {
  return {
    ollamaUrl: String(localStorage.getItem("nexaOllamaUrl") || OLLAMA_URL_PADRAO).replace(/\/$/, ""),
    modelo: String(localStorage.getItem("nexaOllamaModel") || OLLAMA_MODEL_PADRAO),
  }
}

function normalizarHistorico(historico) {
  if (!Array.isArray(historico)) return []

  return historico
    .slice(-3)
    .map((item) => ({
      autor: item?.autor === "Você" ? "usuario" : "nexa",
      texto: String(item?.texto || "").slice(0, 350),
    }))
    .filter((item) => item.texto)
}

function compactarContexto(valor, profundidade = 0) {
  if (valor === null || valor === undefined) return valor
  if (profundidade > 4) return undefined
  if (typeof valor === "string") return valor.slice(0, 280)
  if (typeof valor === "number" || typeof valor === "boolean") return valor

  if (Array.isArray(valor)) {
    return valor
      .slice(0, 12)
      .map((item) => compactarContexto(item, profundidade + 1))
      .filter((item) => item !== undefined)
  }

  if (typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor)
        .slice(0, 20)
        .map(([chave, item]) => [chave, compactarContexto(item, profundidade + 1)])
        .filter(([, item]) => item !== undefined)
    )
  }

  return String(valor).slice(0, 280)
}

function montarPrompt({ instrucoes, contexto, mensagem, historico }) {
  const conversaAnterior = normalizarHistorico(historico)
    .map((item) => `${item.autor === "usuario" ? "USUÁRIO" : "NEXA"}: ${item.texto}`)
    .join("\n")

  const contextoCompacto = compactarContexto(contexto)

  return `Você é a Nexa, assistente de um escritório contábil brasileiro.
Responda em português do Brasil, com naturalidade, objetividade e profissionalismo.
Não invente nomes, datas, valores ou pendências.
Não use JSON, markdown, listas longas ou blocos de código.
Responda em até 4 frases, salvo quando o usuário pedir detalhes.

INSTRUÇÃO:
${String(instrucoes || "").slice(0, 700)}

HISTÓRICO RECENTE:
${conversaAnterior || "Sem histórico relevante."}

DADOS DISPONÍVEIS:
${JSON.stringify(contextoCompacto)}

PERGUNTA:
${String(mensagem || "").slice(0, 700)}

RESPOSTA:`
}

async function buscarContexto({ mensagem, clienteId, historico }) {
  const resposta = await api.post("/conversa/contexto", {
    mensagem,
    clienteId,
    historico: normalizarHistorico(historico),
  })

  return resposta.data
}

async function gerarComOllama({ prompt }) {
  const { ollamaUrl, modelo } = configuracaoLocal()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180000)
  const inicio = performance.now()

  try {
    console.info("[Nexa/Ollama] Iniciando geração", {
      modelo,
      caracteresPrompt: prompt.length,
    })

    const resposta = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelo,
        prompt,
        stream: false,
        keep_alive: "30m",
        options: {
          temperature: 0.15,
          num_ctx: 1024,
          num_predict: 90,
        },
      }),
    })

    const dados = await resposta.json().catch(() => ({}))
    const segundos = ((performance.now() - inicio) / 1000).toFixed(1)

    if (!resposta.ok) {
      throw new Error(dados?.error || `O Ollama respondeu com status ${resposta.status}`)
    }

    const texto = String(dados?.response || "").trim()
    if (!texto) throw new Error("O Ollama não retornou uma resposta.")

    console.info(`[Nexa/Ollama] Resposta concluída em ${segundos}s`, {
      tokensPrompt: dados?.prompt_eval_count,
      tokensResposta: dados?.eval_count,
      duracaoTotalNs: dados?.total_duration,
    })

    return {
      resposta: texto,
      pontos: [],
      recomendacao: "",
      fundamentos: [],
      modo: "ollama-local-generate",
      modelo,
      respondidoEm: new Date().toISOString(),
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("O Ollama demorou mais de 3 minutos para responder. Confirme se o modelo está carregado e se a aceleração Vulkan continua desativada.")
    }

    if (String(error?.message || "").includes("Failed to fetch")) {
      throw new Error("Não consegui acessar o Ollama local. Confirme se ele está aberto em http://localhost:11434.")
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function conversarComNexa({ mensagem, clienteId = null, historico = [] }) {
  const contextoResposta = await buscarContexto({ mensagem, clienteId, historico })

  const prompt = montarPrompt({
    instrucoes: contextoResposta.instrucoes,
    contexto: contextoResposta.contexto,
    mensagem,
    historico: contextoResposta.historico || historico,
  })

  return gerarComOllama({ prompt })
}

export async function verificarOllama() {
  const { ollamaUrl, modelo } = configuracaoLocal()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const resposta = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal })
    if (!resposta.ok) throw new Error("Ollama indisponível")

    const dados = await resposta.json()
    const modelos = Array.isArray(dados?.models) ? dados.models.map((item) => item.name) : []

    return {
      online: true,
      modelo,
      instalado: modelos.some((nome) => nome === modelo || nome.startsWith(`${modelo}:`)),
      modelos,
    }
  } finally {
    clearTimeout(timeout)
  }
}
