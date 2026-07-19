import api from "./api"

const CLIENTE_ID_KEY = "nexaVoiceClienteId"
const CLIENTE_NOME_KEY = "nexaVoiceClienteNome"
const CONVERSA_ID_KEY = "nexaVoiceConversaId"

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

    // Quando a tela de Clientes já está aberta, setPage("Clientes") não remonta
    // o componente. O evento força a troca imediata para o cliente correto.
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("nexa:abrir-cliente", {
        detail: { id: clienteId, nome: clienteNome },
      }))
    }, 0)
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
