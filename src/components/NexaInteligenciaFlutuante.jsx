import { useEffect, useState } from "react"
import ConversaNexa from "../pages/ConversaNexa"
import { verificarProvedores } from "../services/conversaNexaService"

export default function NexaInteligenciaFlutuante({ usuario, setPage }) {
  const [aberta, setAberta] = useState(false)
  const [piloto, setPiloto] = useState(null)

  useEffect(() => {
    if (!aberta) return
    verificarProvedores().then((dados) => setPiloto(dados.piloto || null)).catch(() => {})
  }, [aberta])

  function navegarPelaNexa(pagina) {
    if (typeof setPage !== "function") return
    setPage(pagina)
    setAberta(false)
  }

  if (usuario?.perfil !== "Administrador") return null
  return <>
    <button type="button" style={styles.launcher} onClick={() => setAberta(true)} aria-label="Abrir Nexa Inteligência"><span style={styles.spark}>✦</span><span>Nexa</span></button>
    {aberta && <section style={styles.panel} aria-label="Nexa Inteligência">
      <header style={styles.header}>
        <div><strong style={styles.title}>Nexa Inteligência</strong><span style={styles.subtitle}>Piloto de 30 dias • exclusivo do administrador</span></div>
        <div style={styles.headerActions}>
          {piloto?.permitido && <span style={styles.budget}>US$ {Number(piloto.consumidoUsd || 0).toFixed(2)} / US$ {Number(piloto.limiteUsd || 10).toFixed(2)}</span>}
          <button type="button" style={styles.close} onClick={() => setAberta(false)} aria-label="Fechar">×</button>
        </div>
      </header>
      <div style={styles.content}><ConversaNexa usuario={usuario} setPage={navegarPelaNexa} flutuante /></div>
    </section>}
  </>
}

const styles = {
  launcher: { position: "fixed", right: 22, bottom: 22, zIndex: 1200, display: "flex", alignItems: "center", gap: 9, border: "1px solid rgba(255,255,255,.2)", borderRadius: 999, padding: "12px 18px", background: "linear-gradient(135deg,#0b57d0,#00a884)", color: "#fff", fontWeight: 800, fontSize: 14, boxShadow: "0 14px 35px rgba(0,0,0,.35)", cursor: "pointer" },
  spark: { fontSize: 20 }, panel: { position: "fixed", right: 20, bottom: 20, zIndex: 1300, width: "min(760px,calc(100vw - 28px))", height: "min(820px,calc(100vh - 28px))", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 20, border: "1px solid rgba(255,255,255,.16)", background: "#0b1728", boxShadow: "0 28px 90px rgba(0,0,0,.58)" },
  header: { minHeight: 66, boxSizing: "border-box", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(255,255,255,.1)", background: "#101d2f" },
  title: { display: "block", color: "#f7fafc", fontSize: 15 }, subtitle: { display: "block", marginTop: 3, color: "#91a3b8", fontSize: 11 }, headerActions: { display: "flex", alignItems: "center", gap: 10 },
  budget: { padding: "7px 10px", borderRadius: 999, background: "rgba(0,168,132,.13)", color: "#7ee7c9", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }, close: { width: 34, height: 34, border: 0, borderRadius: 10, background: "rgba(255,255,255,.08)", color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer" }, content: { flex: 1, minHeight: 0, overflow: "hidden" },
}
