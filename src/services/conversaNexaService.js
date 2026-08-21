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
    .slice(-24)
    .map((item) => ({
      autor: item?.autor === "Você" ? "usuario" : "nexa",
      texto: String(item?.texto || "").slice(0, 1200),
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

  return `Você é a Nexa, colega digital de um escritório contábil brasileiro.
Converse em português do Brasil com a naturalidade de uma colega experiente: direta, contextual, cordial e sem frases de robô.
Responda perguntas gerais normalmente. Quando a pergunta estiver incompleta, faça uma pergunta curta para obter o dado essencial.
Use os dados do ERP apenas quando forem relevantes e nunca invente clientes, valores, datas, pagamentos ou pendências.
O cliente aberto é apenas contexto de tela; pronomes devem seguir principalmente o assunto recente da conversa.
Você pode usar humor leve quando couber, mas nunca em valores, prazos, obrigações ou riscos.
Não diga “não consegui confirmar” para uma pergunta geral. Quando um dado atual exigir validação online, explique isso de forma útil.
Não use JSON nem se apresente a cada resposta.

INSTRUÇÃO:
${String(instrucoes || "").slice(0, 1000)}

HISTÓRICO RECENTE:
${conversaAnterior || "Sem histórico relevante."}

DADOS DISPONÍVEIS:
${JSON.stringify(contextoCompacto)}

PERGUNTA:
${String(mensagem || "").slice(0, 1200)}

RESPOSTA:`
}

async function buscarContexto({ mensagem, clienteId, historico, conversaId, tipoContexto, interessadoNome, paginaAtual = "", origem = "texto" }) {
  const resposta = await api.post("/conversa/contexto", {
    mensagem,
    clienteId,
    conversaId,
    tipoContexto,
    interessadoNome,
    paginaAtual,
    origem,
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
          temperature: 0.35,
          num_ctx: 2048,
          num_predict: 220,
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
      provedor: "ollama",
      modelo,
      fallback: true,
      respondidoEm: new Date().toISOString(),
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("O Ollama demorou mais de 3 minutos para responder. Confirme se o modelo está carregado.")
    }

    if (String(error?.message || "").includes("Failed to fetch")) {
      throw new Error("Não consegui acessar o Ollama local. Confirme se ele está aberto em http://localhost:11434.")
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function permiteFallbackLocal(error) {
  const status = Number(error?.response?.status || 0)
  const falhaProvedor = Boolean(error?.response?.data?.providerFailure)
  return !status || falhaProvedor || [429, 500, 502, 503, 504].includes(status)
}

export async function conversarComNexa({
  mensagem,
  clienteId = null,
  historico = [],
  conversaId = null,
  tipoContexto = "geral",
  interessadoNome = "",
  origem = "texto",
  paginaAtual = "",
  selecaoClientePendente = null,
  selecaoClienteId = null,
  cancelarSelecaoCliente = false,
}) {
  let erroGroq = null

  try {
    const resposta = await api.post("/conversa", {
      mensagem,
      clienteId,
      conversaId,
      tipoContexto,
      interessadoNome,
      origem,
      paginaAtual,
      selecaoClientePendente,
      selecaoClienteId,
      cancelarSelecaoCliente,
      historico: normalizarHistorico(historico),
    })

    return {
      ...resposta.data,
      provedor: resposta.data?.provedor || "groq",
      fallback: false,
    }
  } catch (error) {
    if (!permiteFallbackLocal(error)) throw error
    erroGroq = error
    console.warn("[Nexa/Groq] Provedor online indisponível. Tentando Ollama local.", error)
  }

  try {
    const conversaIdFallback = erroGroq?.response?.data?.conversaId || conversaId
    const contextoResposta = await buscarContexto({
      mensagem,
      clienteId,
      historico,
      conversaId: conversaIdFallback,
      tipoContexto,
      interessadoNome,
      paginaAtual,
      origem,
    })
    const prompt = montarPrompt({
      instrucoes: contextoResposta.instrucoes,
      contexto: contextoResposta.contexto,
      mensagem,
      historico: contextoResposta.historico || historico,
    })

    return {
      ...(await gerarComOllama({ prompt })),
      avisoFallback: "A Groq ficou indisponível e a resposta foi gerada pelo Ollama local.",
      conversaId: contextoResposta.conversaId || conversaIdFallback || null,
      tipoContexto,
    }
  } catch (erroOllama) {
    console.warn("[Nexa/IA] Provedores indisponíveis.", {
      groq: erroGroq?.response?.data?.message || erroGroq?.message || "indisponível",
      ollama: erroOllama?.message || "indisponível",
    })
    const erroAmigavel = new Error("A conversa geral está temporariamente indisponível. As consultas e navegações da Nexa continuam funcionando normalmente.")
    erroAmigavel.providerFailure = true
    throw erroAmigavel
  }
}

export async function analisarTelaComNexa({
  imagem,
  mensagem,
  paginaAtual = "",
  contextoVisivel = "",
  conversaId = null,
  clienteId = null,
}) {
  const form = new FormData()
  form.append("imagem", imagem, `tela-nexa-${Date.now()}.jpg`)
  form.append("mensagem", String(mensagem || "Analise esta tela."))
  form.append("paginaAtual", String(paginaAtual || ""))
  form.append("contextoVisivel", String(contextoVisivel || "").slice(0, 14000))
  if (conversaId) form.append("conversaId", String(conversaId))
  if (clienteId) form.append("clienteId", String(clienteId))

  const resposta = await api.post("/conversa/visao/analisar", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 100000,
  })
  return resposta.data
}

export async function registrarAnaliseProativaProduto({ paginaAtual = "", clienteId = null } = {}) {
  const resposta = await api.post("/melhorias-nexa/proativa", { paginaAtual, clienteId })
  return resposta.data
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

export async function verificarProvedores() {
  const [groqResultado, ollamaResultado] = await Promise.allSettled([
    api.get("/conversa/status"),
    verificarOllama(),
  ])

  const groq = groqResultado.status === "fulfilled"
    ? groqResultado.value.data?.groq || {}
    : { configurada: false, online: false, modelo: "", mensagem: "Não foi possível verificar a Groq" }

  const ollama = ollamaResultado.status === "fulfilled"
    ? ollamaResultado.value
    : { online: false, instalado: false, modelo: configuracaoLocal().modelo, modelos: [] }

  return { groq, ollama }
}

export async function baixarRelatorioNexa(configuracao) {
  const resposta = await api.post("/conversa/ferramentas/relatorio", configuracao, { responseType: "blob" })
  const disposicao = String(resposta.headers?.["content-disposition"] || "")
  const nome = disposicao.match(/filename="?([^";]+)"?/i)?.[1] || `relatorio-nexa.${configuracao.formato || "pdf"}`
  const url = URL.createObjectURL(resposta.data)
  const link = document.createElement("a")
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function analisarDocumentoNexa({ arquivo, pergunta = "", conversaId = null, clienteId = null }) {
  const dados = new FormData()
  dados.append("arquivo", arquivo)
  if (pergunta) dados.append("pergunta", pergunta)
  if (conversaId) dados.append("conversaId", String(conversaId))
  if (clienteId) dados.append("clienteId", String(clienteId))
  const resposta = await api.post("/conversa/ferramentas/documento", dados, { headers: { "Content-Type": "multipart/form-data" } })
  return resposta.data
}


export async function listarConversasNexa() {
  const resposta = await api.get("/conversa/sessoes")
  return Array.isArray(resposta.data) ? resposta.data : []
}

export async function criarConversaNexa({ titulo = "Nova conversa", tipoContexto = "geral", clienteId = null, interessadoNome = "" } = {}) {
  const resposta = await api.post("/conversa/sessoes", {
    titulo,
    tipoContexto,
    clienteId,
    interessadoNome,
  })
  return resposta.data
}

export async function abrirConversaNexa(id) {
  const resposta = await api.get(`/conversa/sessoes/${id}/mensagens`)
  return resposta.data
}

export async function abrirConversaRecenteNexa() {
  const resposta = await api.get("/conversa/sessoes-recente")
  return resposta.data
}

export async function ativarConversaNexa(id) {
  const resposta = await api.patch(`/conversa/sessoes/${id}/ativa`)
  return resposta.data
}

export async function atualizarConversaNexa(id, alteracoes) {
  const resposta = await api.patch(`/conversa/sessoes/${id}`, alteracoes)
  return resposta.data
}

export async function excluirConversaNexa(id) {
  const resposta = await api.delete(`/conversa/sessoes/${id}`)
  return resposta.data
}

export async function listarMemoriasNexa(filtros = {}) {
  const resposta = await api.get("/conversa/memorias", { params: filtros })
  return Array.isArray(resposta.data) ? resposta.data : []
}

export async function excluirMemoriaNexa(id) {
  const resposta = await api.delete(`/conversa/memorias/${id}`)
  return resposta.data
}
