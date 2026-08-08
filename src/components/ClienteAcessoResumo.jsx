import { useEffect, useState } from "react"
import api from "../services/api"

const dataHora = (valor) => valor ? new Date(valor).toLocaleString("pt-BR") : "Nunca acessou"

export default function ClienteAcessoResumo({ clienteId, compacto = false }) {
  const [eventos, setEventos] = useState([])

  useEffect(() => {
    if (!clienteId) return
    let ativo = true
    const carregar = () => api.get(`/acessos-clientes?clienteId=${clienteId}&limite=${compacto ? 1 : 30}`)
      .then(({ data }) => ativo && setEventos(Array.isArray(data) ? data : []))
      .catch(() => ativo && setEventos([]))
    carregar()
    const timer = setInterval(carregar, 60000)
    return () => { ativo = false; clearInterval(timer) }
  }, [clienteId, compacto])

  const ultimo = eventos[0]
  return (
    <div style={styles.box}>
      <div style={styles.topo}>
        <div><strong>Acesso ao Portal</strong><div style={styles.muted}>Último acesso: {dataHora(ultimo?.updatedAt || ultimo?.createdAt)}</div></div>
        <span style={{ ...styles.status, ...(ultimo?.online ? styles.online : styles.offline) }}>
          {ultimo?.online ? "Online agora" : "Offline"}
        </span>
      </div>
      {!compacto && eventos.length > 0 && (
        <div style={styles.lista}>
          {eventos.map((item) => (
            <div key={item.id} style={styles.item}>
              <span>{item.descricao || item.pagina || "Atividade no Portal"}</span>
              <small>{dataHora(item.updatedAt || item.createdAt)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  box: { background: "rgba(0,18,45,.55)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 16, padding: 16, margin: "14px 0", color: "white" },
  topo: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 },
  muted: { color: "#a9b8cc", fontSize: 13, marginTop: 5 },
  status: { borderRadius: 999, padding: "7px 11px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" },
  online: { background: "rgba(55,255,116,.16)", color: "#37ff74" },
  offline: { background: "rgba(148,163,184,.16)", color: "#cbd5e1" },
  lista: { marginTop: 14, maxHeight: 310, overflowY: "auto" },
  item: { display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 2px", borderTop: "1px solid rgba(255,255,255,.08)", color: "#dce8f8" },
}
