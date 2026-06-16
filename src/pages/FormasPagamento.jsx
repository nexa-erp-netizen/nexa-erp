import { useEffect, useState } from "react"
import api from "../services/api"

export default function FormasPagamento() {
  const [formasPagamento, setFormasPagamento] = useState([])
  const [nome, setNome] = useState("")
  const [editandoId, setEditandoId] = useState(null)

  useEffect(() => {
    carregarFormasPagamento()
  }, [])

  async function carregarFormasPagamento() {
    try {
      const resposta = await api.get("/formas-pagamento")
      setFormasPagamento(resposta.data || [])
    } catch (error) {
      alert("Erro ao carregar formas de pagamento")
      console.error(error)
    }
  }

  async function salvarFormaPagamento() {
    const nomeTratado = nome.trim()

    if (!nomeTratado) {
      alert("Informe o nome da forma de pagamento")
      return
    }

    const dados = {
      nome: nomeTratado,
    }

    try {
      if (editandoId) {
        await api.put(`/formas-pagamento/${editandoId}`, dados)
      } else {
        await api.post("/formas-pagamento", dados)
      }

      limparCampos()
      await carregarFormasPagamento()
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Erro ao salvar forma de pagamento"
      )
      console.error(error)
    }
  }

  function editarFormaPagamento(formaPagamento) {
    setEditandoId(formaPagamento.id)
    setNome(formaPagamento.nome || "")
  }

  async function excluirFormaPagamento(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir esta forma de pagamento?"
    )

    if (!confirmar) return

    try {
      await api.delete(`/formas-pagamento/${id}`)
      await carregarFormasPagamento()
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Erro ao excluir forma de pagamento"
      )
      console.error(error)
    }
  }

  function limparCampos() {
    setEditandoId(null)
    setNome("")
  }

  return (
    <div style={box}>
      <h2>Formas de Pagamento</h2>

      <p style={subtitle}>
        Cadastre e mantenha as formas usadas nos lançamentos financeiros e contábeis.
      </p>

      <div style={form}>
        <input
          style={input}
          placeholder="Nome da forma de pagamento"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <button style={button} onClick={salvarFormaPagamento}>
          {editandoId ? "Salvar Alteração" : "Criar Forma"}
        </button>

        {editandoId && (
          <button style={cancelButton} onClick={limparCampos}>
            Cancelar Edição
          </button>
        )}
      </div>

      <div style={tableWrapper}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Forma de Pagamento</th>
              <th style={th}>Status</th>
              <th style={th}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {formasPagamento.map((formaPagamento) => (
              <tr key={formaPagamento.id}>
                <td style={td}>{formaPagamento.nome}</td>
                <td style={td}>
                  <span style={statusAtivo}>Ativo</span>
                </td>
                <td style={td}>
                  <div style={actions}>
                    <button
                      style={editButton}
                      onClick={() => editarFormaPagamento(formaPagamento)}
                    >
                      Corrigir
                    </button>

                    <button
                      style={deleteButton}
                      onClick={() => excluirFormaPagamento(formaPagamento.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {formasPagamento.length === 0 && (
              <tr>
                <td style={td} colSpan="3">
                  Nenhuma forma de pagamento cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const subtitle = {
  color: "#a9b8cc",
  marginBottom: "24px",
}

const form = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginBottom: "30px",
}

const input = {
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
}

const button = {
  padding: "15px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const cancelButton = {
  padding: "15px",
  borderRadius: "12px",
  border: "none",
  background: "#64748b",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const tableWrapper = {
  width: "100%",
  overflowX: "auto",
}

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "700px",
}

const th = {
  textAlign: "left",
  padding: "16px",
  color: "#a9b8cc",
  whiteSpace: "nowrap",
}

const td = {
  padding: "16px",
  verticalAlign: "middle",
}

const actions = {
  display: "flex",
  gap: "10px",
}

const statusAtivo = {
  background: "rgba(55,255,116,.12)",
  color: "#37ff74",
  border: "1px solid rgba(55,255,116,.25)",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "bold",
}

const editButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const deleteButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#ff4d4f",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}
