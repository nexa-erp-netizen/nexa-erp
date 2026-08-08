import api from "./api"

const CLIENTE_ID_KEY = "nexaVoiceClienteId"
const CLIENTE_NOME_KEY = "nexaVoiceClienteNome"
const CONVERSA_ID_KEY = "nexaVoiceConversaId"

export function formatarCodigoCliente(clienteOuId) {
  const id = typeof clienteOuId === "object" ? clienteOuId?.id : clienteOuId
  const numero = Number(id)
  if (!Number.isInteger(numero) || numero <= 0) return ""
  return `CLI-${String(numero).padStart(4, "0")}`
}

function normalizarTextoVoz(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function distanciaLevenshtein(a, b) {
  const origem = normalizarTextoVoz(a)
  const destino = normalizarTextoVoz(b)
  if (!origem) return destino.length
  if (!destino) return origem.length

  const linha = Array.from({ length: destino.length + 1 }, (_, indice) => indice)
  for (let i = 1; i <= origem.length; i += 1) {
    let diagonal = linha[0]
    linha[0] = i
    for (let j = 1; j <= destino.length; j += 1) {
      const anterior = linha[j]
      const custo = origem[i - 1] === destino[j - 1] ? 0 : 1
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, diagonal + custo)
      diagonal = anterior
    }
  }
  return linha[destino.length]
}

function similaridade(a, b) {
  const origem = normalizarTextoVoz(a)
  const destino = normalizarTextoVoz(b)
  const maior = Math.max(origem.length, destino.length)
  if (!maior) return 1
  return 1 - (distanciaLevenshtein(origem, destino) / maior)
}

export function resolverEscolhaClientePendente(texto, selecao) {
  const candidatos = Array.isArray(selecao?.candidatos) ? selecao.candidatos : []
  if (!candidatos.length) return null

  const normalizado = normalizarTextoVoz(texto)
  if (!normalizado) return null

  const ordinais = [
    [/(?:^|\s)(?:primeiro|primeira|um|uma)(?:\s|$)/, 0],
    [/(?:^|\s)(?:segundo|segunda|dois|duas)(?:\s|$)/, 1],
    [/(?:^|\s)(?:terceiro|terceira|tres)(?:\s|$)/, 2],
    [/(?:^|\s)(?:quarto|quarta|quatro)(?:\s|$)/, 3],
  ]
  for (const [padrao, indice] of ordinais) {
    if (padrao.test(normalizado) && candidatos[indice]) return candidatos[indice]
  }

  const numeros = [...normalizado.matchAll(/\d+/g)].map((item) => Number(item[0]))
  for (const numero of numeros) {
    const porId = candidatos.find((item) => Number(item.id) === numero)
    if (porId) return porId
  }

  const correspondencias = candidatos.filter((item) => {
    const nome = normalizarTextoVoz(item.nome)
    const codigo = normalizarTextoVoz(item.codigo || formatarCodigoCliente(item.id))
    return Boolean(
      (codigo && normalizado.includes(codigo))
      || (nome && (normalizado === nome || normalizado.includes(nome))),
    )
  })

  return correspondencias.length === 1 ? correspondencias[0] : null
}

const CACHE_CLIENTES_TTL_MS = 5 * 60 * 1000
let cacheClientesVoz = []
let cacheClientesVozAte = 0
let carregamentoClientesVoz = null

const DESTINOS_COM_CLIENTE = [
  {
    pagina: "Movimentos Clientes",
    aliases: ["movimentos dos clientes", "movimentacoes dos clientes", "movimentos clientes", "movimentacoes clientes", "movimentacao", "movimentacoes", "movimento", "movimentos"],
  },
  { pagina: "Lançamentos Contábeis", aliases: ["lancamentos contabeis", "lancamento contabil", "contabilidade", "contabil"] },
  { pagina: "Clientes", alvo: "central-cliente", secao: "servicos", aliases: ["servicos e cobrancas", "servico e cobranca", "servicos avulsos", "servico avulso", "lancar servico avulso", "lancamento de servico avulso"] },
  { pagina: "Documentos Digitais", aliases: ["documentos digitais", "documentos", "documento"] },
  { pagina: "Pendências Clientes", aliases: ["pendencias dos clientes", "pendencias clientes", "pendencias", "pendencia"] },
  { pagina: "DRE Gerencial", aliases: ["dre gerencial", "demonstracao do resultado", "dre"] },
  { pagina: "Fiscal", aliases: ["modulo fiscal", "area fiscal", "parte fiscal", "fiscal"] },
  { pagina: "Financeiro", aliases: ["financeiro do escritorio", "modulo financeiro", "financeiro"] },
]

const ALVOS_NAO_CLIENTE = new Set([
  "cliente", "clientes", "cadastro de clientes", "lista de clientes",
  "fiscal", "financeiro", "dashboard", "painel", "movimentos", "movimento",
  "movimentacoes", "movimentacao", "documentos", "documento", "pendencias",
  "pendencia", "dre", "agenda", "whatsapp", "relatorios", "relatorio",
  "backup", "sobre", "ferramentas", "configuracoes", "atendimento",
])

async function obterClientesVoz({ forcar = false } = {}) {
  const agora = Date.now()
  if (!forcar && cacheClientesVoz.length && agora < cacheClientesVozAte) return cacheClientesVoz
  if (!forcar && carregamentoClientesVoz) return carregamentoClientesVoz

  carregamentoClientesVoz = api.get("/clientes")
    .then((resposta) => {
      cacheClientesVoz = Array.isArray(resposta.data) ? resposta.data : []
      cacheClientesVozAte = Date.now() + CACHE_CLIENTES_TTL_MS
      return cacheClientesVoz
    })
    .finally(() => {
      carregamentoClientesVoz = null
    })

  return carregamentoClientesVoz
}

export async function precarregarClientesVoz() {
  try {
    return await obterClientesVoz()
  } catch (error) {
    console.warn("[Nexa Voice] Não foi possível pré-carregar os clientes:", error)
    return []
  }
}

function extrairDestinoEClienteDoComando(comando) {
  let texto = normalizarTextoVoz(comando)
  if (!texto) return null

  texto = texto
    .replace(/^(?:(?:por favor|agora)\s+)*/g, "")
    .replace(/^(?:(?:quero|pode|favor)\s+)*/g, "")

  const correspondencia = texto.match(
    /^(?:abra|abre|abrir|acesse|acessar|entre|entrar|me leve(?: para)?|va para|vai para|ir para|navegue(?: para)?|mostre|mostrar|exiba)\s+(.+)$/,
  )
  if (!correspondencia) return null

  let alvoCompleto = String(correspondencia[1] || "")
    .replace(/^(?:o|a)\s+/, "")
    .replace(/\b(?:por favor|para mim|pra mim|agora)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!alvoCompleto || ALVOS_NAO_CLIENTE.has(alvoCompleto)) return null

  const destinos = DESTINOS_COM_CLIENTE
    .flatMap((item) => item.aliases.map((alias) => ({ ...item, alias: normalizarTextoVoz(alias) })))
    .sort((a, b) => b.alias.length - a.alias.length)

  for (const destino of destinos) {
    if (!alvoCompleto.startsWith(`${destino.alias} `)) continue

    const nomeCliente = alvoCompleto
      .slice(destino.alias.length)
      .trim()
      .replace(/^(?:(?:do|da|de|no|na)\s+)?(?:cliente|empresa)\s+/, "")
      .trim()

    if (!nomeCliente || ALVOS_NAO_CLIENTE.has(nomeCliente)) return null
    return { pagina: destino.pagina, alvo: destino.alvo || "pagina", secao: destino.secao || "", nomeCliente }
  }

  alvoCompleto = alvoCompleto
    .trim()
    .replace(/^(?:(?:do|da|de|no|na)\s+)?(?:cliente|empresa)\s+/, "")
    .trim()

  if (!alvoCompleto || ALVOS_NAO_CLIENTE.has(alvoCompleto)) return null
  return { pagina: "Clientes", alvo: "central-cliente", nomeCliente: alvoCompleto }
}

function pontuarCliente(cliente, alvo) {
  const nome = normalizarTextoVoz(cliente?.nome)
  if (!nome || !alvo) return 0
  if (nome === alvo) return 1000
  if (nome.includes(alvo)) return 900 + alvo.length
  if (alvo.includes(nome)) return 850 + nome.length

  const tokensAlvo = alvo.split(" ").filter((item) => item.length >= 3)
  const tokensNome = nome.split(" ").filter((item) => item.length >= 3)
  const encontrados = tokensAlvo.filter((token) => tokensNome.some((nomeToken) => nomeToken === token || similaridade(nomeToken, token) >= 0.82))
  const cobertura = tokensAlvo.length ? encontrados.length / tokensAlvo.length : 0
  const semelhanca = similaridade(alvo, nome)
  return Math.max(cobertura * 800, semelhanca * 700)
}

export async function resolverAcaoAbrirClientePorVoz(comando) {
  const destino = extrairDestinoEClienteDoComando(comando)
  if (!destino?.nomeCliente) return null

  const clientes = await obterClientesVoz()
  const alvo = normalizarTextoVoz(destino.nomeCliente)
  const candidatos = clientes
    .map((cliente) => ({ cliente, pontos: pontuarCliente(cliente, alvo) }))
    .filter((item) => item.pontos >= 560)
    .sort((a, b) => b.pontos - a.pontos)

  const melhor = candidatos[0]
  const segundo = candidatos[1]
  if (!melhor) return null
  if (segundo && melhor.pontos - segundo.pontos < 45) return null

  return {
    tipo: "navegar",
    pagina: destino.pagina,
    alvo: destino.alvo,
    secao: destino.secao || "",
    segura: true,
    cliente: {
      id: melhor.cliente.id,
      nome: melhor.cliente.nome,
    },
  }
}

function emitirAberturaCliente(clienteId, clienteNome) {
  const detalhe = { id: clienteId, nome: clienteNome }
  ;[0, 100, 300, 700].forEach((atraso) => {
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("nexa:abrir-cliente", { detail: detalhe }))
    }, atraso)
  })
}

export function obterContextoVoz() {
  return {
    clienteId: localStorage.getItem(CLIENTE_ID_KEY) || "",
    clienteNome: localStorage.getItem(CLIENTE_NOME_KEY) || "",
    conversaId: localStorage.getItem(CONVERSA_ID_KEY) || "",
  }
}

export function registrarConversaVoz(conversaId) {
  if (!conversaId) return
  localStorage.setItem(CONVERSA_ID_KEY, String(conversaId))
  window.dispatchEvent(new CustomEvent("nexa:conversa-atualizada", {
    detail: { conversaId: String(conversaId) },
  }))
}

export function limparConversaVoz() {
  localStorage.removeItem(CONVERSA_ID_KEY)
  window.dispatchEvent(new CustomEvent("nexa:conversa-atualizada", {
    detail: { conversaId: "" },
  }))
}

export function registrarClienteVoz(cliente) {
  if (!cliente?.id) return
  localStorage.setItem(CLIENTE_ID_KEY, String(cliente.id))
  localStorage.setItem(CLIENTE_NOME_KEY, String(cliente.nome || ""))
  window.dispatchEvent(new CustomEvent("nexa:contexto-cliente-atualizado", {
    detail: { id: String(cliente.id), nome: String(cliente.nome || "") },
  }))
}

export function limparContextoClienteVoz() {
  localStorage.removeItem(CLIENTE_ID_KEY)
  localStorage.removeItem(CLIENTE_NOME_KEY)
}

export function executarAcaoDeVoz({ acao, setPage }) {
  if (!acao) return false

  if (acao.tipo === "abrir-url") {
    try {
      const url = new URL(String(acao.url || ""))
      const hostPermitido = url.protocol === "https:"
        && (url.hostname === "drive.google.com" || url.hostname.endsWith(".googleusercontent.com"))
      if (!hostPermitido) return false
      const janelaPendente = acao.janelaPendente
      if (janelaPendente && !janelaPendente.closed) {
        janelaPendente.opener = null
        janelaPendente.location.href = url.toString()
        return true
      }
      const novaJanela = window.open(url.toString(), "_blank", "noopener,noreferrer")
      return Boolean(novaJanela)
    } catch {
      return false
    }
  }

  if (acao.tipo === "abrir-grupo") {
    const grupo = String(acao.grupo || "").trim()
    if (!grupo) return false
    window.dispatchEvent(new CustomEvent("nexa:abrir-grupo-menu", { detail: { grupo } }))
    return true
  }

  if (acao.tipo !== "navegar" || typeof setPage !== "function") return false

  const pagina = String(acao.pagina || "").trim()
  const cliente = acao.cliente || null
  const clienteNome = String(cliente?.nome || "").trim()
  const clienteId = cliente?.id ? String(cliente.id) : ""

  if (!pagina) return false
  if (clienteId) registrarClienteVoz(cliente)

  if (acao.alvo === "central-cliente" && clienteId) {
    localStorage.setItem("nexaAbrirClienteId", clienteId)
    localStorage.setItem("nexaAbrirClienteNome", clienteNome)
    if (acao.secao) localStorage.setItem("nexaAbrirSecaoCliente", String(acao.secao))

    // Primeiro garante que a tela de Clientes esteja montada. Depois repete o
    // evento por alguns instantes, cobrindo tanto a lista já aberta quanto a
    // navegação iniciada em outra página.
    setPage("Clientes")
    emitirAberturaCliente(clienteId, clienteNome)
    return true
  }
  if (pagina === "Fiscal") {
    if (clienteNome) localStorage.setItem("nexaFiltroFiscalCliente", clienteNome)
    else localStorage.removeItem("nexaFiltroFiscalCliente")
    window.dispatchEvent(new CustomEvent("nexa:filtro-fiscal-atualizado", {
      detail: { clienteId, clienteNome },
    }))
  }
  if (pagina === "Documentos Digitais" && clienteNome) localStorage.setItem("nexaFiltroDocumentoCliente", clienteNome)
  if (pagina === "Pendências Clientes" && clienteNome) localStorage.setItem("nexaFiltroPendenciaCliente", clienteNome)
  if (pagina === "Movimentos Clientes" && clienteNome) localStorage.setItem("nexaFiltroMovimentosCliente", clienteNome)
  if (pagina === "Movimentos Clientes" && clienteId) localStorage.setItem("nexaFiltroMovimentosClienteId", clienteId)
  if (pagina === "Lançamentos Contábeis") {
    if (clienteNome) localStorage.setItem("nexaFiltroLancamentosCliente", clienteNome)
    else localStorage.removeItem("nexaFiltroLancamentosCliente")
    window.dispatchEvent(new CustomEvent("nexa:filtro-lancamentos-atualizado", {
      detail: { clienteId, clienteNome },
    }))
  }
  if (pagina === "DRE Gerencial" && clienteNome) localStorage.setItem("nexaFiltroDreCliente", clienteNome)
  if (pagina === "Certificados Digitais" && clienteId) localStorage.setItem("nexaCertificadoClienteId", clienteId)
  if (pagina === "Procurações e-CAC" && clienteId) localStorage.setItem("nexaProcuracaoClienteId", clienteId)
  if (pagina === "Memória da Nexa" && clienteId) localStorage.setItem("nexaMemoriaClienteId", clienteId)
  if (pagina === "Segundo Contador" && clienteId) localStorage.setItem("nexaSegundoContadorClienteId", clienteId)
  if (pagina === "Consultora Tributária" && clienteId) localStorage.setItem("nexaConsultoraClienteId", clienteId)

  setPage(pagina)
  return true
}

export async function listarVocabularioVoz(clienteId = null) {
  const resposta = await api.get("/conversa/vocabulario-voz", {
    params: clienteId ? { clienteId } : {},
  })
  return Array.isArray(resposta.data) ? resposta.data : []
}

export async function aprenderVocabularioVoz({ termoOuvido, termoCorreto, clienteId = null, origem = "confirmacao_voz" }) {
  const resposta = await api.post("/conversa/vocabulario-voz", {
    termoOuvido,
    termoCorreto,
    clienteId,
    origem,
  })
  return resposta.data
}

export async function excluirVocabularioVoz(id) {
  const resposta = await api.delete(`/conversa/vocabulario-voz/${id}`)
  return resposta.data
}
