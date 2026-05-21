import { useEffect, useState } from "react"
import api from "../services/api"

export default function Financeiro() {
  const [descricao, setDescricao] = useState("")
  const [cliente, setCliente] = useState("")
  const [tipo, setTipo] = useState("")
  const [valor, setValor] = useState("")
  const [vencimento, setVencimento] = useState("")
  const [status, setStatus] = useState("")
  const [editandoId, setEditandoId] = useState(null)

  const [lancamentos, setLancamentos] = useState([])
  const [clientesCadastrados, setClientesCadastrados] = useState([])

  useEffect(() => {
    carregarLancamentos()
    carregarClientes()
  }, [])

  async function carregarLancamentos() {
    try {
      const resposta = await api.get("/financeiro")
      setLancamentos(resposta.data)
    } catch (error) {
      alert("Erro ao carregar financeiro")
      console.error(error)
    }
  }

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientesCadastrados(resposta.data)
    } catch (error) {
      alert("Erro ao carregar clientes")
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

  function valorNumerico(valorFormatado) {
    return Number(
      String(valorFormatado)
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    )
  }

  function formatarMoeda(valor) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  async function salvarLancamento() {
    if (
      !descricao ||
      !cliente ||
      !tipo ||
      !valor ||
      !vencimento ||
      !status
    ) {
      alert("Preencha todos os campos")
      return
    }

    const novoLancamento = {
      descricao,
      cliente,
      tipo,
      valor,
      vencimento,
      status,
    }

    try {
      if (editandoId !== null) {
        await api.put(
          `/financeiro/${editandoId}`,
          novoLancamento
        )
      } else {
        await api.post(
          "/financeiro",
          novoLancamento
        )
      }

      await carregarLancamentos()
      limparCampos()
    } catch (error) {
      alert("Erro ao salvar lançamento financeiro")
      console.error(error)
    }
  }

  function editarLancamento(item) {
    setDescricao(item.descricao)
    setCliente(item.cliente)
    setTipo(item.tipo)
    setValor(item.valor)
    setVencimento(item.vencimento)
    setStatus(item.status)
    setEditandoId(item.id)
  }

  async function excluirLancamento(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este lançamento?"
    )

    if (!confirmar) {
      return
    }

    try {
      await api.delete(`/financeiro/${id}`)
      await carregarLancamentos()
    } catch (error) {
      alert("Erro ao excluir lançamento financeiro")
      console.error(error)
    }
  }

  function limparCampos() {
    setDescricao("")
    setCliente("")
    setTipo("")
    setValor("")
    setVencimento("")
    setStatus("")
    setEditandoId(null)
  }

  const totalReceber = lancamentos
    .filter((item) => item.tipo === "Receber")
    .reduce((total, item) => total + valorNumerico(item.valor), 0)

  const totalPagar = lancamentos
    .filter((item) => item.tipo === "Pagar")
    .reduce((total, item) => total + valorNumerico(item.valor), 0)

  const saldo = totalReceber - totalPagar

  return (
    <div style={box}>
      <h2>Financeiro</h2>

      <div style={cards}>
        <Card
          title="Total a Receber"
          value={formatarMoeda(totalReceber)}
        />

        <Card
          title="Total a Pagar"
          value={formatarMoeda(totalPagar)}
        />

        <Card
          title="Saldo Previsto"
          value={formatarMoeda(saldo)}
        />
      </div>

      <div style={form}>
        <input
          style={input}
          placeholder="Descrição"
          value={descricao}
          onChange={(e) =>
            setDescricao(e.target.value)
          }
        />

        <select
          style={input}
          value={cliente}
          onChange={(e) =>
            setCliente(e.target.value)
          }
        >
          <option value="">
            Cliente / Fornecedor
          </option>

          {clientesCadastrados.map((item) => (
            <option
              key={item.id}
              value={item.nome}
            >
              {item.nome}
            </option>
          ))}
        </select>

        <select
          style={input}
          value={tipo}
          onChange={(e) =>
            setTipo(e.target.value)
          }
        >
          <option value="">Tipo</option>
          <option value="Receber">
            Conta a Receber
          </option>
          <option value="Pagar">
            Conta a Pagar
          </option>
        </select>

        <input
          style={input}
          placeholder="R$ 0,00"
          value={valor}
          onChange={(e) =>
            setValor(
              formatarValor(e.target.value)
            )
          }
        />

        <input
          type="date"
          style={input}
          value={vencimento}
          onChange={(e) =>
            setVencimento(e.target.value)
          }
        />

        <select
          style={input}
          value={status}
          onChange={(e) =>
            setStatus(e.target.value)
          }
        >
          <option value="">Status</option>
          <option value="Pendente">
            Pendente
          </option>
          <option value="Pago">
            Pago
          </option>
          <option value="Recebido">
            Recebido
          </option>
          <option value="Atrasado">
            Atrasado
          </option>
        </select>

        <button
          style={button}
          onClick={salvarLancamento}
        >
          {editandoId !== null
            ? "Salvar Correção"
            : "Salvar Lançamento"}
        </button>
      </div>

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Descrição</th>
            <th style={th}>Cliente/Fornecedor</th>
            <th style={th}>Tipo</th>
            <th style={th}>Valor</th>
            <th style={th}>Vencimento</th>
            <th style={th}>Status</th>
            <th style={th}>Ações</th>
          </tr>
        </thead>

        <tbody>
          {lancamentos.map((item) => (
            <tr key={item.id}>
              <td style={td}>
                {item.descricao}
              </td>

              <td style={td}>
                {item.cliente}
              </td>

              <td style={td}>
                {item.tipo}
              </td>

              <td style={td}>
                {item.valor}
              </td>

              <td style={td}>
                {item.vencimento}
              </td>

              <td style={td}>
                {item.status}
              </td>

              <td style={td}>
                <div style={actions}>
                  <button
                    style={editButton}
                    onClick={() =>
                      editarLancamento(item)
                    }
                  >
                    Corrigir
                  </button>

                  <button
                    style={deleteButton}
                    onClick={() =>
                      excluirLancamento(item.id)
                    }
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

function Card({ title, value }) {
  return (
    <div style={card}>
      <span style={cardTitle}>
        {title}
      </span>

      <strong style={cardValue}>
        {value}
      </strong>
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginBottom: "25px",
}

const card = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "16px",
  padding: "20px",
}

const cardTitle = {
  display: "block",
  color: "#a9b8cc",
  marginBottom: "10px",
}

const cardValue = {
  color: "white",
  fontSize: "24px",
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