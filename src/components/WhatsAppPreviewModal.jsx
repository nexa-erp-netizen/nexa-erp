import { useEffect, useState } from "react"
import api from "../services/api"
import {
  abrirWhatsAppWeb,
  registrarHistoricoWhatsApp,
} from "../services/whatsappService"

export default function WhatsAppPreviewModal({ previa, onClose, onEnviado }) {
  const [mensagem, setMensagem] = useState(previa?.mensagem || "")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    setMensagem(previa?.mensagem || "")
  }, [previa])

  if (!previa) return null

  async function abrirWhatsApp() {
    setEnviando(true)
    try {
      const cliente = previa.cliente || {}
      const abriu = abrirWhatsAppWeb({ ...cliente, mensagem }, mensagem)
      if (!abriu) return

      try {
        if (cliente?.id) {
          await registrarHistoricoWhatsApp(api, cliente, previa.modelo?.titulo, mensagem)
        } else {
          await registrarHistoricoWhatsApp({
            cliente: previa.evento?.cliente,
            modelo: previa.modelo?.titulo,
            mensagem,
            usuario: "Nexa",
          })
        }
      } catch (error) {
        console.warn("WhatsApp aberto, mas não foi possível registrar no histórico", error)
      }

      onEnviado?.(previa.evento)
      onClose?.()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={topo}>
          <div>
            <h3 style={{ margin: 0 }}>Prévia do WhatsApp</h3>
            <p style={subtitulo}>{previa.evento?.cliente} • {previa.modelo?.titulo}</p>
          </div>
          <button type="button" style={fechar} onClick={onClose}>×</button>
        </div>

        <label style={label}>Mensagem</label>
        <textarea
          style={textarea}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
        />

        <div style={acoes}>
          <button type="button" style={cancelar} onClick={onClose}>Cancelar</button>
          <button type="button" style={enviar} onClick={abrirWhatsApp} disabled={enviando}>
            {enviando ? "Abrindo..." : "Abrir WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.62)",
  display: "grid",
  placeItems: "center",
  padding: 18,
  zIndex: 9999,
}
const modal = {
  width: "min(680px, 96vw)",
  background: "#061f47",
  border: "1px solid rgba(55,255,116,.35)",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 24px 70px rgba(0,0,0,.45)",
}
const topo = { display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 14 }
const subtitulo = { color: "#a9b8cc", margin: "6px 0 0" }
const fechar = { border: "none", borderRadius: 10, width: 34, height: 34, background: "rgba(255,255,255,.12)", color: "white", fontSize: 22, cursor: "pointer" }
const label = { display: "block", color: "#a9b8cc", marginBottom: 7, fontSize: 13 }
const textarea = { width: "100%", minHeight: 230, boxSizing: "border-box", resize: "vertical", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#001f45", color: "white", padding: 14, lineHeight: 1.5 }
const acoes = { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }
const cancelar = { border: "none", borderRadius: 10, padding: "11px 15px", background: "rgba(255,255,255,.12)", color: "white", cursor: "pointer" }
const enviar = { border: "none", borderRadius: 10, padding: "11px 15px", background: "#37ff74", color: "#00112b", fontWeight: "bold", cursor: "pointer" }
