import { useEffect, useState } from "react"
import api from "../services/api"

export default function Servicos() {
  const [nome, setNome] = useState("")
  const [categoria, setCategoria] = useState("")
  const [prazo, setPrazo] = useState("")
  const [valor, setValor] = useState("")
  const [editandoId, setEditandoId] = useState(null)

  const [servicos, setServicos] = useState([])

  const categorias = [
    "Contábil",
    "Fiscal",
    "Departamento Pessoal",
    "Societário",
    "Financeiro",
  ]

  useEffect(() => {
    carregarServicos()
  }, [])

  async function carregarServicos() {
    try {
      const resposta = await api.get("/servicos")
      setServicos(resposta.data)
    } catch (error) {
      alert("Erro ao carregar serviços")
      console.error(error)
    }
  }

  function formatarValor(valorDigitado) {
    const somenteNumeros = valorDigitado.replace(/\D/g, "")
    const numero = Number(somenteNumeros) / 100

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  async function salvarServico() {
    if (!nome || !categoria || !prazo || !valor) {
      alert("Preencha todos os campos")
      return
    }

    const dadosServico = {
      nome,
      categoria,
      prazo,
      valor,
    }

    try {
      if (editandoId !== null) {
        await api.put(`/servicos/${editandoId}`, dadosServico)
      } else {
        await api.post("/servicos", dadosServico)
      }

      await carregarServicos()
      limparCampos()
    } catch (error) {
      alert("Erro ao salvar serviço")
      console.error(error)
    }
  }

  function editarServico(servico) {
    setNome(servico.nome)
    setCategoria(servico.categoria)
    setPrazo(servico.prazo)
    setValor(servico.valor)
    setEditandoId(servico.id)
  }

  async function excluirServico(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este serviço?"
    )

    if (!confirmar) {
      return
    }

    try {
      await api.delete(`/servicos/${id}`)
      await carregarServicos()
    } catch (error) {
      alert("Erro ao excluir serviço")
      console.error(error)
    }
  }

  function limparCampos() {
    setNome("")
    setCategoria("")
    setPrazo("")
    setValor("")
    setEditandoId(null)
  }

  return (
    <div style={box}>
      <h2>Cadastro de Serviços</h2>

      <div style={form}>
        <input
          style={input}
          placeholder="Nome do Serviço"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <select
          style={input}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          <option value="">
            Selecione uma categoria
          </option>

          {categorias.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          style={input}
          placeholder="Prazo"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
        />

        <input
          style={input}
          placeholder="R$ 0,00"
          value={valor}
          onChange={(e) => setValor(formatarValor(e.target.value))}
        />

        <button style={button} onClick={salvarServico}>
          {editandoId !== null
            ? "Salvar Correção"
            : "Salvar Serviço"}
        </button>
      </div>

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Serviço</th>
            <th style={th}>Categoria</th>
            <th style={th}>Prazo</th>
            <th style={th}>Valor</th>
            <th style={th}>Ações</th>
          </tr>
        </thead>

        <tbody>
          {servicos.map((servico) => (
            <tr key={servico.id}>
              <td style={td}>{servico.nome}</td>
              <td style={td}>{servico.categoria}</td>
              <td style={td}>{servico.prazo}</td>
              <td style={td}>{servico.valor}</td>

              <td style={td}>
                <div style={actions}>
                  <button
                    style={editButton}
                    onClick={() => editarServico(servico)}
                  >
                    Corrigir
                  </button>

                  <button
                    style={deleteButton}
                    onClick={() => excluirServico(servico.id)}
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
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

const table = {
  width: "100%",
  borderCollapse: "collapse",
}

const th = {
  textAlign: "left",
  padding: "16px",
  color: "#a9b8cc",
}

const td = {
  padding: "16px",
}

const actions = {
  display: "flex",
  gap: "10px",
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