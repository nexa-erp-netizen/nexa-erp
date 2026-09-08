import axios from "axios"
import NEXA_VERSION from "../config/version"
import { registrarIncidenteWeb } from "./incidentesNexaService"

const URL_PRINCIPAL = String(import.meta.env.VITE_API_PRIMARY_URL || "https://nexa-erp-api.onrender.com").replace(/\/+$/, "")
const URL_SECUNDARIA = String(import.meta.env.VITE_API_SECONDARY_URL || "").replace(/\/+$/, "")
const TEMPO_CACHE_SAUDE_MS = 30000
const TIMEOUT_HEALTH_MS = 5000
const STATUS_INFRAESTRUTURA = new Set([502, 503, 504])

let urlAtiva = URL_PRINCIPAL
let instanciaAtiva = "principal"
let contingenciaAtiva = false
let apiDisponivel = true
let verificacaoEmAndamento = null
let ultimaVerificacao = 0

function normalizarMetodo(valor) {
  return String(valor || "GET").toUpperCase()
}

function metodoSeguroParaRetry(metodo) {
  return ["GET", "HEAD", "OPTIONS"].includes(normalizarMetodo(metodo))
}

function secundariaConfigurada() {
  return Boolean(URL_SECUNDARIA && URL_SECUNDARIA !== URL_PRINCIPAL)
}

function avisarStatus(disponivel, extras = {}) {
  apiDisponivel = Boolean(disponivel)
  window.dispatchEvent(new CustomEvent("nexa-api-status", {
    detail: {
      disponivel,
      contingencia: contingenciaAtiva,
      instancia: instanciaAtiva,
      url: urlAtiva,
      secundariaConfigurada: secundariaConfigurada(),
      ...extras,
    },
  }))
}

async function consultarSaude(url) {
  if (!url) return { ok: false, motivo: "url-ausente" }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_HEALTH_MS)

  try {
    const resposta = await fetch(`${url}/health`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    if (!resposta.ok) return { ok: false, status: resposta.status, motivo: "health-http" }

    const dados = await resposta.json().catch(() => null)
    if (!dados || dados.banco !== "conectado") {
      return { ok: false, status: resposta.status, motivo: "banco-indisponivel", dados }
    }

    if (dados.versao && dados.versao !== NEXA_VERSION.version) {
      return {
        ok: false,
        status: resposta.status,
        motivo: "versao-incompativel",
        versao: dados.versao,
      }
    }

    return {
      ok: true,
      status: resposta.status,
      instancia: dados.instancia || "desconhecida",
      versao: dados.versao || null,
    }
  } catch (error) {
    return {
      ok: false,
      motivo: error?.name === "AbortError" ? "timeout" : "rede",
    }
  } finally {
    clearTimeout(timer)
  }
}

function ativarEndpoint(url, saude, { contingencia = false } = {}) {
  urlAtiva = url
  instanciaAtiva = saude?.instancia || (contingencia ? "contingencia" : "principal")
  contingenciaAtiva = contingencia
  apiDisponivel = true
  ultimaVerificacao = Date.now()
  avisarStatus(true, { motivo: contingencia ? "contingencia-ativa" : "principal-ok" })
  return urlAtiva
}

export async function selecionarApi({ forcar = false } = {}) {
  if (!forcar && Date.now() - ultimaVerificacao < TEMPO_CACHE_SAUDE_MS) return urlAtiva
  if (verificacaoEmAndamento) return verificacaoEmAndamento

  verificacaoEmAndamento = (async () => {
    const saudePrincipal = await consultarSaude(URL_PRINCIPAL)
    if (saudePrincipal.ok) {
      return ativarEndpoint(URL_PRINCIPAL, saudePrincipal, { contingencia: false })
    }

    if (secundariaConfigurada()) {
      const saudeSecundaria = await consultarSaude(URL_SECUNDARIA)
      if (saudeSecundaria.ok) {
        return ativarEndpoint(URL_SECUNDARIA, saudeSecundaria, { contingencia: true })
      }

      ultimaVerificacao = Date.now()
      avisarStatus(false, {
        motivo: "todas-indisponiveis",
        principal: saudePrincipal.motivo,
        secundaria: saudeSecundaria.motivo,
      })
      return urlAtiva
    }

    ultimaVerificacao = Date.now()
    contingenciaAtiva = false
    instanciaAtiva = "principal"
    urlAtiva = URL_PRINCIPAL
    avisarStatus(false, { motivo: "principal-indisponivel-sem-contingencia" })
    return urlAtiva
  })().finally(() => {
    verificacaoEmAndamento = null
  })

  return verificacaoEmAndamento
}

export function obterApiAtiva() {
  return {
    url: urlAtiva,
    instancia: instanciaAtiva,
    contingencia: contingenciaAtiva,
    secundariaConfigurada: secundariaConfigurada(),
    disponivel: apiDisponivel,
  }
}

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
  apiDisponivel = true
  avisarStatus(true)
  return resposta
}, async (erro) => {
  const status = Number(erro.response?.status || 0)
  const falhaDeRede = !erro.response || erro.code === "ECONNABORTED" || erro.code === "ERR_NETWORK"
  const falhaInfra = falhaDeRede || STATUS_INFRAESTRUTURA.has(status)

  if (!falhaInfra) {
    if (status >= 500) {
      registrarIncidenteWeb({
        origem: "web-api",
        titulo: `Falha ao acessar ${erro.config?.url || "a API"}`,
        mensagem: erro.response?.data?.message || erro.message,
        rota: erro.config?.url,
        metodo: erro.config?.method?.toUpperCase(),
        statusHttp: status,
        componente: "axios",
        apiBaseUrl: erro.config?.baseURL,
      })
    }
    return Promise.reject(erro)
  }

  const baseTentada = String(erro.config?.baseURL || "").replace(/\/+$/, "")
  ultimaVerificacao = 0

  const novaBase = await selecionarApi({ forcar: true }).catch(() => baseTentada || URL_PRINCIPAL)

  registrarIncidenteWeb({
    origem: "web-api",
    titulo: `Falha de infraestrutura ao acessar ${erro.config?.url || "a API"}`,
    mensagem: erro.response?.data?.message || erro.message,
    rota: erro.config?.url,
    metodo: erro.config?.method?.toUpperCase(),
    statusHttp: status,
    componente: "axios-failover",
    apiBaseUrl: novaBase || baseTentada,
  })

  const podeRepetir = metodoSeguroParaRetry(erro.config?.method)
  const mudouDeApi = Boolean(novaBase && baseTentada && novaBase !== baseTentada)
  const jaRepetiu = Boolean(erro.config?.__nexaFailoverRetry)

  if (podeRepetir && mudouDeApi && !jaRepetiu) {
    return api.request({
      ...erro.config,
      baseURL: novaBase,
      __nexaFailoverRetry: true,
    })
  }

  // Escritas nunca são repetidas automaticamente: a API principal pode ter
  // confirmado a gravação e a resposta ter se perdido. A próxima tentativa
  // manual do usuário já seguirá para a instância saudável selecionada.
  return Promise.reject(erro)
})

export default api
