import api from "./api"

const CLIENTE_ID_KEY = "nexaVoiceClienteId"
const CLIENTE_NOME_KEY = "nexaVoiceClienteNome"
const CONVERSA_ID_KEY = "nexaVoiceConversaId"

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

function extrairNomeClienteDoComando(comando) {
  const texto = normalizarTextoVoz(comando)
  if (!texto) return ""

  const correspondencia = texto.match(
    /^(?:(?:por favor|agora)\s+)*(?:(?:quero|pode|favor)\s+)*(?:abra|abre|abrir|acesse|acessar|entre|entrar|me leve(?: para)?|va para|vai para)\s+(?:(?:o|a)\s+)?(?:(?:cliente|empresa)\s+)?(.+)$/,
  )
  if (!correspondencia) return ""

  const alvo = String(correspondencia[1] || "")
    .replace(/\b(?:por favor|para mim|pra mim|agora)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const paginas = new Set([
    "cliente", "clientes", "cadastro de clientes", "lista de clientes",
    "fiscal", "financeiro", "dashboard", "painel", "movimentos",
    "movimentacoes", "documentos", "pendencias", "dre", "agenda",
    "whatsapp", "relatorios", "relatorio", "backup", "sobre",
  ])

  if (!alvo || paginas.has(alvo)) return ""
  return alvo
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
  const alvo = extrairNomeClienteDoComando(comando)
  if (!alvo) return null

  const resposta = await api.get("/clientes")
  const clientes = Array.isArray(resposta.data) ? resposta.data : []
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
    pagina: "Clientes",
    alvo: "central-cliente",
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
  if (conversaId) localStorage.setItem(CONVERSA_ID_KEY, String(conversaId))
}

export function registrarClienteVoz(cliente) {
  if (!cliente?.id) return
  localStorage.setItem(CLIENTE_ID_KEY, String(cliente.id))
  localStorage.setItem(CLIENTE_NOME_KEY, String(cliente.nome || ""))
}

export function limparContextoClienteVoz() {
  localStorage.removeItem(CLIENTE_ID_KEY)
  localStorage.removeItem(CLIENTE_NOME_KEY)
}

export function executarAcaoDeVoz({ acao, setPage }) {
  if (!acao || acao.tipo !== "navegar" || typeof setPage !== "function") return false

  const pagina = String(acao.pagina || "").trim()
  const cliente = acao.cliente || null
  const clienteNome = String(cliente?.nome || "").trim()
  const clienteId = cliente?.id ? String(cliente.id) : ""

  if (!pagina) return false
  if (clienteId) registrarClienteVoz(cliente)

  if (acao.alvo === "central-cliente" && clienteId) {
    localStorage.setItem("nexaAbrirClienteId", clienteId)
    localStorage.setItem("nexaAbrirClienteNome", clienteNome)

    // Primeiro garante que a tela de Clientes esteja montada. Depois repete o
    // evento por alguns instantes, cobrindo tanto a lista já aberta quanto a
    // navegação iniciada em outra página.
    setPage("Clientes")
    emitirAberturaCliente(clienteId, clienteNome)
    return true
  }
  if (pagina === "Fiscal" && clienteNome) localStorage.setItem("nexaFiltroFiscalCliente", clienteNome)
  if (pagina === "Documentos Digitais" && clienteNome) localStorage.setItem("nexaFiltroDocumentoCliente", clienteNome)
  if (pagina === "Pendências Clientes" && clienteNome) localStorage.setItem("nexaFiltroPendenciaCliente", clienteNome)
  if (pagina === "Movimentos Clientes" && clienteNome) localStorage.setItem("nexaFiltroMovimentosCliente", clienteNome)
  if (pagina === "Lançamentos Contábeis" && clienteNome) localStorage.setItem("nexaFiltroLancamentosCliente", clienteNome)
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
