import { useEffect, useState } from "react"
import { selecionarApi } from "../services/api"

export default function SistemaInstavelAviso() {
  const [instavel, setInstavel] = useState(false)
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    const atualizar = (evento) => setInstavel(evento.detail?.disponivel === false)
    const semInternet = () => setInstavel(true)
    const comInternet = () => testarNovamente()

    window.addEventListener("nexa-api-status", atualizar)
    window.addEventListener("offline", semInternet)
    window.addEventListener("online", comInternet)

    selecionarApi({ forcar: true }).then(() => {}).catch(() => setInstavel(true))

    return () => {
      window.removeEventListener("nexa-api-status", atualizar)
      window.removeEventListener("offline", semInternet)
      window.removeEventListener("online", comInternet)
    }
  }, [])

  async function testarNovamente() {
    setVerificando(true)
    try {
      await selecionarApi({ forcar: true })
    } finally {
      setVerificando(false)
    }
  }

  if (!instavel) return null

  return (
    <div style={styles.faixa} role="alert" aria-live="assertive">
      <div style={styles.conteudo}>
        <div>
          <strong style={styles.titulo}>Sistema temporariamente instável</strong>
          <div style={styles.texto}>
            A Nexa não conseguiu se comunicar com o servidor neste momento. Aguarde alguns instantes antes de enviar ou salvar informações.
          </div>
        </div>
        <button type="button" onClick={testarNovamente} disabled={verificando} style={styles.botao}>
          {verificando ? "Verificando..." : "Tentar novamente"}
        </button>
      </div>
    </div>
  )
}

const styles = {
  faixa: {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 100000,
    background: "#7f1d1d", color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,.35)",
    fontFamily: "Arial, sans-serif", padding: "12px 16px",
  },
  conteudo: {
    maxWidth: "1180px", margin: "0 auto", display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: "18px", flexWrap: "wrap",
  },
  titulo: { display: "block", fontSize: "16px", marginBottom: "3px" },
  texto: { fontSize: "14px", lineHeight: 1.4 },
  botao: {
    border: "1px solid rgba(255,255,255,.7)", borderRadius: "8px", background: "#fff",
    color: "#7f1d1d", fontWeight: 700, padding: "9px 14px", cursor: "pointer",
  },
}
