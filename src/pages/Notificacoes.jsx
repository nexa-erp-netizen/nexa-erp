import { useEffect, useState } from "react"

const API_URL = "https://nexa-erp-api.onrender.com"

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([])
  const usuarioSalvo = JSON.parse(localStorage.getItem("usuario"))
  const token = localStorage.getItem("token") || usuarioSalvo?.token

  async function carregarNotificacoes() {
    try {
      const resposta = await fetch(`${API_URL}/notificacoes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const dados = await resposta.json()
      setNotificacoes(Array.isArray(dados) ? dados : [])
    } catch (error) {
      console.error("Erro ao carregar notificações:", error)
    }
  }

  async function marcarComoLida(id) {
    await fetch(`${API_URL}/notificacoes/${id}/lida`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    carregarNotificacoes()
  }

  async function marcarTodasComoLidas() {
    await fetch(`${API_URL}/notificacoes/marcar-todas/lidas`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    carregarNotificacoes()
  }

  useEffect(() => {
    carregarNotificacoes()
  }, [])

  const naoLidas = notificacoes.filter((item) => !item.lida)
  const lidas = notificacoes.filter((item) => item.lida)

  function iconePorTipo(tipo) {
    if (tipo?.includes("documento")) return "📄"
    if (tipo?.includes("pendencia")) return "⚠️"
    if (tipo?.includes("fiscal")) return "💰"
    if (tipo?.includes("mensagem")) return "💬"
    return "🔔"
  }

  function renderNotificacao(item) {
    return (
      <div
        key={item.id}
        style={{
          ...styles.cardNotificacao,
          ...(item.lida ? styles.cardLido : styles.cardNaoLido),
        }}
      >
        <div style={styles.cardTopo}>
          <div style={styles.iconeBox}>
            {iconePorTipo(item.tipo)}
          </div>

          <div style={{ flex: 1 }}>
            <div style={styles.tituloLinha}>
              <h3 style={styles.tituloCard}>{item.titulo}</h3>

              <span
                style={{
                  ...styles.badge,
                  ...(item.lida ? styles.badgeLida : styles.badgeNova),
                }}
              >
                {item.lida ? "Lida" : "Nova"}
              </span>
            </div>

            <p style={styles.mensagem}>{item.mensagem}</p>

            <small style={styles.data}>
              {new Date(item.criado_em).toLocaleString("pt-BR")}
            </small>
          </div>
        </div>

        <div style={styles.acoes}>
          {!item.lida ? (
            <button
              style={styles.botaoSecundario}
              onClick={() => marcarComoLida(item.id)}
            >
              Marcar como lida
            </button>
          ) : (
            <span style={styles.textoLida}>Notificação já lida</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>🔔 Central de Notificações</h1>
          <p style={styles.subtitulo}>
            Acompanhe as interações recentes dos clientes.
          </p>
        </div>

        <button style={styles.botaoPrincipal} onClick={marcarTodasComoLidas}>
          Marcar todas como lidas
        </button>
      </div>

      <div style={styles.resumoGrid}>
        <div style={styles.resumoCard}>
          <span style={styles.resumoLabel}>Não lidas</span>
          <strong style={styles.resumoNumero}>{naoLidas.length}</strong>
        </div>

        <div style={styles.resumoCard}>
          <span style={styles.resumoLabel}>Total</span>
          <strong style={styles.resumoNumero}>{notificacoes.length}</strong>
        </div>
      </div>

      {notificacoes.length === 0 ? (
        <div style={styles.vazio}>
          <h3>Nenhuma notificação encontrada.</h3>
          <p>As novas interações dos clientes aparecerão aqui.</p>
        </div>
      ) : (
        <>
          <section style={styles.secao}>
            <h2 style={styles.secaoTitulo}>
              Novas Interações ({naoLidas.length})
            </h2>

            {naoLidas.length === 0 ? (
              <p style={styles.textoAuxiliar}>
                Nenhuma notificação nova no momento.
              </p>
            ) : (
              <div style={styles.lista}>
                {naoLidas.map(renderNotificacao)}
              </div>
            )}
          </section>

          {lidas.length > 0 && (
            <section style={styles.secao}>
              <h2 style={styles.secaoTitulo}>
                Notificações Lidas ({lidas.length})
              </h2>

              <div style={styles.lista}>
                {lidas.map(renderNotificacao)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

const styles = {
  container: {
    width: "100%",
  },

  header: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "24px",
    padding: "26px",
    marginBottom: "22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
  },

  h1: {
    margin: 0,
    fontSize: "32px",
    color: "white",
  },

  subtitulo: {
    margin: "8px 0 0",
    color: "#a9b8cc",
    fontSize: "16px",
  },

  botaoPrincipal: {
    padding: "13px 18px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(90deg, #00a8ff, #37ff74)",
    color: "#00112b",
    fontWeight: "bold",
    cursor: "pointer",
  },

  resumoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "15px",
    marginBottom: "24px",
  },

  resumoCard: {
    background: "#123d78",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: "18px",
    padding: "20px",
  },

  resumoLabel: {
    display: "block",
    color: "#a9b8cc",
    fontSize: "14px",
    marginBottom: "8px",
  },

  resumoNumero: {
    color: "#37ff74",
    fontSize: "30px",
  },

  secao: {
    marginTop: "24px",
  },

  secaoTitulo: {
    fontSize: "22px",
    marginBottom: "14px",
  },

  lista: {
    display: "grid",
    gap: "14px",
  },

  cardNotificacao: {
    borderRadius: "20px",
    padding: "20px",
    border: "1px solid rgba(255,255,255,.12)",
    background: "#123d78",
  },

  cardNaoLido: {
    boxShadow: "0 0 0 1px rgba(55,255,116,.25)",
  },

  cardLido: {
    opacity: 0.72,
  },

  cardTopo: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
  },

  iconeBox: {
    width: "46px",
    height: "46px",
    borderRadius: "14px",
    background: "#061f47",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    flexShrink: 0,
  },

  tituloLinha: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },

  tituloCard: {
    margin: 0,
    fontSize: "19px",
  },

  badge: {
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "bold",
  },

  badgeNova: {
    background: "rgba(55,255,116,.16)",
    color: "#37ff74",
  },

  badgeLida: {
    background: "rgba(255,255,255,.10)",
    color: "#a9b8cc",
  },

  mensagem: {
    margin: "8px 0",
    color: "white",
    lineHeight: 1.4,
  },

  data: {
    color: "#a9b8cc",
  },

  acoes: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "14px",
  },

  botaoSecundario: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,.15)",
    background: "#061f47",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  },

  textoLida: {
    color: "#a9b8cc",
    fontSize: "13px",
  },

  vazio: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "20px",
    padding: "28px",
    color: "#a9b8cc",
  },

  textoAuxiliar: {
    color: "#a9b8cc",
  },
}