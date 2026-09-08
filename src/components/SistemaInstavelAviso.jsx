import { useEffect, useState } from "react"
import { obterApiAtiva, selecionarApi } from "../services/api"

const ESTADO_INICIAL = {
  disponivel: true,
  contingencia: false,
  instancia: "principal",
  secundariaConfigurada: false,
}

export default function SistemaInstavelAviso() {
  const [estado, setEstado] = useState(ESTADO_INICIAL)
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    const atualizar = (evento) => {
      setEstado(anterior => ({ ...anterior, ...(evento.detail || {}) }))
    }
    const semInternet = () => setEstado(anterior => ({ ...anterior, disponivel: false, motivo: "sem-internet" }))
    const comInternet = () => testarNovamente()

    window.addEventListener("nexa-api-status", atualizar)
    window.addEventListener("offline", semInternet)
    window.addEventListener("online", comInternet)

    selecionarApi({ forcar: true })
      .then(() => {
        const atual = obterApiAtiva()
        setEstado(anterior => ({ ...anterior, ...atual }))
      })
      .catch(() => setEstado(anterior => ({ ...anterior, disponivel: false })))

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
      const atual = obterApiAtiva()
      setEstado(anterior => ({ ...anterior, ...atual }))
    } catch {
      setEstado(anterior => ({ ...anterior, disponivel: false }))
    } finally {
      setVerificando(false)
    }
  }

  if (estado.disponivel && !estado.contingencia) return null

  const emContingencia = estado.disponivel && estado.contingencia
  const estilos = emContingencia ? styles.contingencia : styles.indisponivel

  return (
    <div style={{ ...styles.faixa, ...estilos.faixa }} role="alert" aria-live="assertive">
      <div style={styles.conteudo}>
        <div>
          <strong style={styles.titulo}>
            {emContingencia ? "Modo de contingência ativo" : "Sistema temporariamente instável"}
          </strong>
          <div style={styles.texto}>
            {emContingencia
              ? "A API principal está indisponível, mas a Nexa continua operando pela API secundária."
              : estado.secundariaConfigurada
                ? "A Nexa não conseguiu se comunicar com a API principal nem com a secundária. Aguarde antes de enviar ou salvar informações."
                : "A Nexa não conseguiu se comunicar com o servidor. A API secundária ainda não está configurada neste ambiente."}
          </div>
        </div>
        <button
          type="button"
          onClick={testarNovamente}
          disabled={verificando}
          style={{ ...styles.botao, ...estilos.botao }}
        >
          {verificando ? "Verificando..." : emContingencia ? "Testar principal" : "Tentar novamente"}
        </button>
      </div>
    </div>
  )
}

const styles = {
  faixa: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100000,
    color: "#fff",
    boxShadow: "0 4px 16px rgba(0,0,0,.35)",
    fontFamily: "Arial, sans-serif",
    padding: "12px 16px",
  },
  conteudo: {
    maxWidth: "1180px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
    flexWrap: "wrap",
  },
  titulo: { display: "block", fontSize: "16px", marginBottom: "3px" },
  texto: { fontSize: "14px", lineHeight: 1.4 },
  botao: {
    border: "1px solid rgba(255,255,255,.7)",
    borderRadius: "8px",
    background: "#fff",
    fontWeight: 700,
    padding: "9px 14px",
    cursor: "pointer",
  },
  contingencia: {
    faixa: { background: "#9a6700" },
    botao: { color: "#7a4f00" },
  },
  indisponivel: {
    faixa: { background: "#7f1d1d" },
    botao: { color: "#7f1d1d" },
  },
}
