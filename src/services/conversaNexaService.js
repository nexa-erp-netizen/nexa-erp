import api from "./api"

const OLLAMA_URL_PADRAO = "http://localhost:11434"
const OLLAMA_MODEL_PADRAO = "llama3.2:3b"

function configuracaoLocal() {
  return {
    ollamaUrl: String(
      localStorage.getItem("nexaOllamaUrl") || OLLAMA_URL_PADRAO
    ).replace(/\/$/, ""),
    modelo: String(
      localStorage.getItem("nexaOllamaModel") || OLLAMA_MODEL_PADRAO
    ),
  }
}

function normalizarHistorico(historico) {
  if (!Array.isArray(historico)) return []

  return historico
    .slice(-4)
    .map((item) => ({
      autor: item?.autor === "Você" ? "usuario" : "nexa",
      texto: String(item?.texto || "").slice(0, 500),
    }))
    .filter((item) => item.texto)
}

function textoNormalizado(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function mensagemSimples(mensagem) {
  const texto = textoNormalizado(mensagem)
  return [
    "oi",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "tudo bem",
    "como vai",
  ].includes(texto)
}

function compactarContexto(valor, profundidade = 0) {
  if (valor === null || valor === undefined) return valor
  if (profundidade > 5) return undefined

  if (typeof valor === "string") return valor.slice(0, 500)
  if (typeof valor === "number" || typeof valor === "boolean") return valor

  if (Array.isArray(valor)) {
    return valor
      .slice(0, 20)
      .map((item) => compactarContexto(item, profundidade + 1))
      .filter((item) => item !== undefined)
  }

  if (typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor)
        .slice(0, 30)
        .map(([chave, item]) => [
          chave,
          compactarContexto(item, profundidade + 1),
        ])
        .filter(([, item]) => item !== undefined)
    )
  }

  return String(valor).slice(0, 500)
}

function montarPrompt({ instrucoes, contexto, mensagem, historico }) {
  const conversaAnterior = normalizarHistorico(historico)
    .map((item) => `${item.autor === "usuario" ? "USUÁRIO" : "NEXA"}: ${item.texto}`)
    .join("\n")

  const contextoNecessario = mensagemSimples(mensagem)
    ? { observacao: "Saudação simples. Responda naturalmente sem analisar dados do ERP." }
    : compactarContexto(contexto)

  return `Você é a Nexa, assistente de um escritório contábil brasileiro.
Responda em português do Brasil, de forma natural, objetiva e profissional.
Não invente clientes, datas, valores ou pendências.
Não use JSON, markdown ou blocos de código.
Responda em no máximo 5 frases.

INSTRUÇÕES ADICIONAIS:
${String(instrucoes || "").slice(0, 1200)}

HISTÓRICO RECENTE:
${conversaAnterior || "Sem conversa anterior."}

CONTEXTO NEXA:
${JSON.stringify(contextoNecessario)}

PERGUNTA ATUAL:
${String(mensagem || "").slice(0, 1000)}

RESPOSTA DA NEXA:`
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
  const timeout = setTimeout(() => controller.abort(), 90000)

  try {
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
          temperature: 0.2,
          num_ctx: 2048,
          num_predict: 140,
          num_thread: 6,
        },
      }),
    })

    const dados = await resposta.json().catch(() => ({}))

    if (!resposta.ok) {
      throw new Error(
        dados?.error || `O Ollama respondeu com status ${resposta.status}`
      )
    }

    const texto = String(dados?.response || "").trim()
    if (!texto) throw new Error("O Ollama não retornou uma resposta.")

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
      throw new Error("O Ollama demorou mais de 90 segundos para responder.")
    }

    if (String(error?.message || "").includes("Failed to fetch")) {
      throw new Error(
        "Não consegui acessar o Ollama local. Confirme se ele está aberto em http://localhost:11434."
      )
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function conversarComNexa({
  mensagem,
  clienteId = null,
  historico = [],
}) {
  const contextoResposta = await buscarContexto({
    mensagem,
    clienteId,
    historico,
  })

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
  const resposta = await fetch(`${ollamaUrl}/api/tags`)

  if (!resposta.ok) throw new Error("Ollama indisponível")

  const dados = await resposta.json()
  const modelos = Array.isArray(dados?.models)
    ? dados.models.map((item) => item.name)
    : []

  return {
    online: true,
    modelo,
    instalado: modelos.some(
      (nome) => nome === modelo || nome.startsWith(`${modelo}:`)
    ),
    modelos,
  }
}
