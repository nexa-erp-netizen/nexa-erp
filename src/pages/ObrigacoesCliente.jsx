import { useEffect, useState } from "react"
import api from "../services/api"

export default function ObrigacoesCliente() {
  const [obrigacoes, setObrigacoes] = useState([])

  useEffect(() => {
    carregarObrigacoes()
  }, [])

  async function carregarObrigacoes() {
    try {
      const [fiscalRes, pendenciasRes] = await Promise.all([
        api.get("/fiscal"),
        api.get("/solicitacoes-clientes"),
      ])

      const fiscal = (fiscalRes.data || []).map((item) => ({
        id: `fiscal-${item.id}`,
        idOriginal: item.id,
        origem: "Fiscal",
        titulo: item.descricao || item.tipo || "Obrigação fiscal",
        vencimento: item.vencimento || item.dataVencimento || "-",
        status: item.status || "Pendente",
      }))

      const pendencias = (pendenciasRes.data || []).map((item) => ({
        id: `pendencia-${item.id}`,
        idOriginal: item.id,
        origem: "Pendência",
        titulo: item.titulo || item.descricao || "Pendência",
        vencimento: item.vencimento || item.prazo || "-",
        status: item.status || "Pendente",
      }))

      setObrigacoes([...fiscal, ...pendencias])
    } catch (error) {
      alert("Erro ao carregar obrigações")
      console.error(error)
    }
  }

  async function marcarPago(item) {
    if (item.origem !== "Fiscal") return

    const confirmar = window.confirm(
      "Confirmar que esta obrigação foi paga?"
    )

    if (!confirmar) return

    try {
      await api.patch(`/fiscal/${item.idOriginal}/marcar-pago-cliente`)
      await carregarObrigacoes()
    } catch (error) {
      alert("Erro ao marcar como pago")
      console.error(error)
    }
  }

  function corStatus(status) {
    if (status === "Pago pelo cliente" || status === "Pago") {
      return "#37ff74"
    }

    if (status === "Atrasado") {
      return "#ff4d4f"
    }

    if (status === "Concluído") {
      return "#00a8ff"
    }

    return "#ffd166"
  }

  function podeMarcarPago(item) {
    return (
      item.origem === "Fiscal" &&
      item.status !== "Pago pelo cliente" &&
      item.status !== "Pago" &&
      item.status !== "Concluído"
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.titulo}>📋 Obrigações</h2>
        <p style={styles.subtitulo}>
          Fiscal e pendências reunidos em um único lugar.
        </p>
      </div>

      <div style={styles.card}>
        {obrigacoes.length === 0 ? (
          <p style={styles.vazio}>Nenhuma obrigação encontrada.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Descrição</th>
                <th style={styles.th}>Vencimento</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Pago</th>
              </tr>
            </thead>

            <tbody>
              {obrigacoes.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>{item.origem}</td>
                  <td style={styles.td}>{item.titulo}</td>
                  <td style={styles.td}>{item.vencimento}</td>

                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        background: corStatus(item.status),
                      }}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td style={styles.td}>
                    {podeMarcarPago(item) ? (
                      <button
                        style={styles.botaoCheck}
                        onClick={() => marcarPago(item)}
                        title="Marcar como pago"
                      >
                        ○
                      </button>
                    ) : item.status === "Pago pelo cliente" ||
                      item.status === "Pago" ||
                      item.status === "Concluído" ? (
                      <span style={styles.checkConcluido}>✅</span>
                    ) : (
                      <span style={styles.semAcao}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: "24px",
    padding: "28px",
  },

  header: {
    marginBottom: "22px",
  },

  titulo: {
    margin: 0,
    fontSize: "28px",
    color: "white",
  },

  subtitulo: {
    margin: "8px 0 0",
    color: "#a9b8cc",
  },

  card: {
    background: "#123d78",
    borderRadius: "18px",
    padding: "20px",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "14px",
    color: "#a9b8cc",
    borderBottom: "1px solid rgba(255,255,255,.12)",
  },

  td: {
    padding: "14px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    verticalAlign: "middle",
  },

  statusBadge: {
    color: "#00112b",
    padding: "6px 12px",
    borderRadius: "999px",
    fontWeight: "bold",
    fontSize: "13px",
    display: "inline-block",
    minWidth: "135px",
    textAlign: "center",
  },

  botaoCheck: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    border: "2px solid #37ff74",
    background: "transparent",
    color: "#37ff74",
    fontWeight: "bold",
    fontSize: "18px",
    cursor: "pointer",
  },

  checkConcluido: {
    fontSize: "22px",
  },

  semAcao: {
    color: "#a9b8cc",
    fontWeight: "bold",
  },

  vazio: {
    color: "#a9b8cc",
  },
}