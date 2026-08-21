import NEXA_VERSION from "../config/version"

const enviados = new Map()
const URL_API = String(import.meta.env.VITE_API_PRIMARY_URL || "https://nexa-erp-api.onrender.com").replace(/\/+$/, "")

function texto(valor, limite = 1200) {
  return String(valor || "").replace(/Bearer\s+\S+/gi, "Bearer [PROTEGIDO]").replace(/\b\d{11,14}\b/g, "[DOCUMENTO PROTEGIDO]").slice(0, limite)
}

function podeEnviar(chave) {
  const agora = Date.now()
  const anterior = enviados.get(chave) || 0
  if (agora - anterior < 60000) return false
  enviados.set(chave, agora)
  if (enviados.size > 100) [...enviados.keys()].slice(0, 50).forEach(item => enviados.delete(item))
  return true
}

export async function registrarIncidenteWeb(dados = {}) {
  const token = localStorage.getItem("token")
  if (!token) return
  const chave = [dados.origem, dados.mensagem, dados.rota, dados.statusHttp, dados.componente].join("|")
  if (!podeEnviar(chave)) return
  try {
    await fetch(`${URL_API}/incidentes/capturar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        origem: dados.origem || "web", titulo: texto(dados.titulo || dados.mensagem, 250),
        mensagem: texto(dados.mensagem), rota: texto(dados.rota || window.location.pathname, 500),
        metodo: dados.metodo, statusHttp: dados.statusHttp, componente: texto(dados.componente, 200),
        versaoWeb: NEXA_VERSION.version,
        contexto: { pagina: window.location.pathname, navegador: navigator.userAgent.slice(0, 300) },
      }),
      keepalive: true,
    })
  } catch { /* a captura nunca pode interromper o uso do sistema */ }
}

export function iniciarMonitoramentoWeb() {
  window.addEventListener("error", evento => registrarIncidenteWeb({ origem: "web-runtime", titulo: "Erro de execução no Web", mensagem: evento.message, componente: `${evento.filename || "arquivo desconhecido"}:${evento.lineno || 0}:${evento.colno || 0}` }))
  window.addEventListener("unhandledrejection", evento => registrarIncidenteWeb({ origem: "web-runtime", titulo: "Falha assíncrona não tratada", mensagem: evento.reason?.message || evento.reason, componente: evento.reason?.stack?.split("\n")?.[1] }))
}
