import axios from "axios"

const URL_PRINCIPAL = String(import.meta.env.VITE_API_PRIMARY_URL || "https://nexa-erp-api.onrender.com").replace(/\/+$/, "")
let urlAtiva = URL_PRINCIPAL
let verificacaoEmAndamento = null
let ultimaVerificacao = 0

function avisarStatus(disponivel) {
  window.dispatchEvent(new CustomEvent("nexa-api-status", { detail: { disponivel } }))
}

async function estaSaudavel(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const resposta = await fetch(`${url}/health`, { cache: "no-store", signal: controller.signal })
    return resposta.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function selecionarApi({ forcar = false } = {}) {
  if (!forcar && Date.now() - ultimaVerificacao < 60000) return urlAtiva
  if (verificacaoEmAndamento) return verificacaoEmAndamento

  verificacaoEmAndamento = (async () => {
    if (await estaSaudavel(URL_PRINCIPAL)) {
      urlAtiva = URL_PRINCIPAL
      ultimaVerificacao = Date.now()
      avisarStatus(true)
      return urlAtiva
    }
    ultimaVerificacao = Date.now()
    avisarStatus(false)
    return urlAtiva
  })().finally(() => { verificacaoEmAndamento = null })

  return verificacaoEmAndamento
}

export function obterApiAtiva() { return urlAtiva }
export function montarUrlApi(caminho = "") {
  if (/^https?:\/\//i.test(caminho)) return caminho
  return `${urlAtiva}/${String(caminho).replace(/^\/+/, "")}`
}

const api = axios.create({ timeout: 30000 })

api.interceptors.request.use(async (config) => {
  config.baseURL = await selecionarApi()
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use((resposta) => {
  avisarStatus(true)
  return resposta
}, async (erro) => {
  const falhaDeRede = !erro.response || erro.code === "ECONNABORTED"
  const falhaDoServidor = Number(erro.response?.status || 0) >= 500
  if (falhaDeRede || falhaDoServidor) {
    ultimaVerificacao = 0
    avisarStatus(false)
  }
  return Promise.reject(erro)
})

export default api
