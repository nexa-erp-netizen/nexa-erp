import { useEffect, useState } from "react"
import api from "../services/api"

export default function PlanoContas() {
  const [codigo, setCodigo] = useState("")
  const [conta, setConta] = useState("")
  const [tipo, setTipo] = useState("")
  const [natureza, setNatureza] = useState("")
  const [formasTexto, setFormasTexto] = useState("")
  const [editandoId, setEditandoId] = useState(null)
  const [contas, setContas] = useState([])

  useEffect(() => {
    carregarContas()
  }, [])

  async function carregarContas() {
    try {
      const resposta = await api.get("/plano-contas")
      setContas(resposta.data)
    } catch (error) {
      alert("Erro ao carregar plano de contas")
      console.error(error)
    }
  }

  function separarFormas(texto) {
    return String(texto || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  async function salvarConta() {
    if (!codigo || !conta || !tipo || !natureza) {
      alert("Preencha todos os campos")
      return
    }

    const dadosConta = {
      codigo,
      conta,
      tipo,
      natureza,
      formas: separarFormas(formasTexto),
    }

    try {
      if (editandoId !== null) {
        await api.put(`/plano-contas/${editandoId}`, dadosConta)
      } else {
        await api.post("/plano-contas", dadosConta)
      }

      await carregarContas()
      limparCampos()
    } catch (error) {
      alert("Erro ao salvar conta")
      console.error(error)
    }
  }

  function editarConta(item) {
    setCodigo(item.codigo)
    setConta(item.conta)
    setTipo(item.tipo)
    setNatureza(item.natureza)
    setFormasTexto(Array.isArray(item.formas) ? item.formas.join(", ") : "")
    setEditandoId(item.id)
  }

  async function excluirConta(id) {
    const confirmar = window.confirm("Deseja realmente excluir esta conta?")

    if (!confirmar) return

    try {
      await api.delete(`/plano-contas/${id}`)
      await carregarContas()
    } catch (error) {
      alert("Erro ao excluir conta")
      console.error(error)
    }
  }

  function limparCampos() {
    setCodigo("")
    setConta("")
    setTipo("")
    setNatureza("")
    setFormasTexto("")
    setEditandoId(null)
  }

  return (
    <div style={box}>
      <div style={form}>
        <input
          style={input}
          placeholder="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />

        <input
          style={input}
          placeholder="Nome da Conta"
          value={conta}
          onChange={(e) => setConta(e.target.value)}
        />

        <select
          style={input}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Selecione o Tipo</option>
          <option value="Sintética">Sintética</option>
          <option value="Analítica">Analítica</option>
        </select>

        <select
          style={input}
          value={natureza}
          onChange={(e) => setNatureza(e.target.value)}
        >
          <option value="">Selecione a Natureza</option>
          <option value="Devedora">Devedora</option>
          <option value="Credora">Credora</option>
        </select>

        <input
          style={inputFull}
          placeholder="Formas / Classe. Ex: PIX, Cartão, Dinheiro, Boleto"
          value={formasTexto}
          onChange={(e) => setFormasTexto(e.target.value)}
        />

        <button style={button} onClick={salvarConta}>
          {editandoId !== null ? "Salvar Correção" : "Salvar Conta"}
        </button>
      </div>

      <div style={tableWrapper}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Código</th>
              <th style={th}>Conta</th>
              <th style={th}>Tipo</th>
              <th style={th}>Natureza</th>
              <th style={th}>Formas</th>
              <th style={th}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {contas.map((item) => (
              <tr key={item.id}>
                <td style={td}>{item.codigo}</td>
                <td style={td}>{item.conta}</td>
                <td style={td}>{item.tipo}</td>
                <td style={td}>{item.natureza}</td>

                <td style={td}>
                  {Array.isArray(item.formas) && item.formas.length > 0 ? (
                    <div style={tags}>
                      {item.formas.map((forma) => (
                        <span key={forma} style={tag}>
                          {forma}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#a9b8cc" }}>Nenhuma</span>
                  )}
                </td>

                <td style={td}>
                  <div style={actions}>
                    <button style={editButton} onClick={() => editarConta(item)}>
                      Corrigir
                    </button>

                    <button
                      style={deleteButton}
                      onClick={() => excluirConta(item.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {contas.length === 0 && (
              <tr>
                <td style={td} colSpan="6">
                  Nenhuma conta cadastrada.
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

const topo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "25px",
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

const inputFull = {
  ...input,
  gridColumn: "1 / -1",
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

const tableWrapper = {
  width: "100%",
  overflowX: "auto",
}

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "760px",
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

const tags = {
  display: "flex",
  flexWrap: "wrap",
  gap: "7px",
}

const tag = {
  background: "#061f47",
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