import { useEffect, useState } from "react"
import api from "../services/api"

import "./ContasReceber.css"

export default function ContasReceber() {
  const [contas, setContas] = useState([])
  const [servicos, setServicos] = useState([])

  const [novaConta, setNovaConta] = useState({
    descricao: "",
    valor: "",
    vencimento: "",
  })

  async function carregarContas() {
    try {
      const response = await api.get("/contas-receber")

      const contasAtualizadas = response.data.map((conta) => {
        if (
          conta.status !== "Recebido" &&
          new Date(conta.vencimento) < new Date()
        ) {
          return {
            ...conta,
            status: "Atrasado",
          }
        }

        return conta
      })

      setContas(contasAtualizadas)
    } catch (error) {
      console.error("Erro ao carregar contas:", error)
    }
  }

  async function carregarServicos() {
    try {
      const response = await api.get("/servicos")

      setServicos(response.data)
    } catch (error) {
      console.error("Erro ao carregar serviços:", error)
    }
  }

  async function criarConta() {
    try {
      if (
        !novaConta.descricao ||
        !novaConta.valor ||
        !novaConta.vencimento
      ) {
        alert("Preencha serviço, valor e vencimento.")
        return
      }

      await api.post("/contas-receber", {
        ...novaConta,
        status: "Pendente",
      })

      setNovaConta({
        descricao: "",
        valor: "",
        vencimento: "",
      })

      carregarContas()
    } catch (error) {
      console.error("Erro ao salvar conta:", error)
    }
  }

  async function receberConta(id) {
    try {
      await api.put(`/contas-receber/${id}/receber`)

      carregarContas()
    } catch (error) {
      console.error("Erro ao receber conta:", error)
    }
  }

  useEffect(() => {
    carregarContas()
    carregarServicos()
  }, [])

  function formatarMoeda(valor) {

  if (!valor) {
    return "R$ 0,00"
  }

  const numero = Number(
    String(valor)
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  )

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

  function pegarValorServico(servico) {
    return (
      servico.valor ||
      servico.preco ||
      servico.valorServico ||
      servico.valor_servico ||
      ""
    )
  }

  function selecionarServico(nomeServico) {
    const servicoSelecionado = servicos.find(
      (servico) => servico.nome === nomeServico
    )

    const valorServico = servicoSelecionado
      ? pegarValorServico(servicoSelecionado)
      : ""

    setNovaConta({
      ...novaConta,
      descricao: nomeServico,
      valor: valorServico,
    })
  }

  const totalReceber = contas
  .filter((conta) => conta.status !== "Recebido")
  .reduce((total, conta) => {

    const valor = Number(
      String(conta.valor)
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    )

    return total + valor

  }, 0)

  const totalRecebido = contas
  .filter((conta) => conta.status === "Recebido")
  .reduce((total, conta) => {

    const valor = Number(
      String(conta.valor)
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    )

    return total + valor

  }, 0)

  const inadimplentes = contas.filter(
    (conta) => conta.status === "Atrasado"
  ).length

  function badgeStatus(status) {
    switch (status) {
      case "Recebido":
        return "badge recebido"

      case "Atrasado":
        return "badge atrasado"

      case "Parcial":
        return "badge parcial"

      default:
        return "badge pendente"
    }
  }

  return (
    <div className="contas-container">
      <div className="cards-financeiros">
        <div className="card-fin">
          <span>Receber</span>
          <strong>{formatarMoeda(totalReceber)}</strong>
        </div>

        <div className="card-fin">
          <span>Recebido</span>
          <strong>{formatarMoeda(totalRecebido)}</strong>
        </div>

        <div className="card-fin">
          <span>Inadimplentes</span>
          <strong>{inadimplentes}</strong>
        </div>
      </div>

      <div className="nova-conta">
        <select
          value={novaConta.descricao}
          onChange={(e) => selecionarServico(e.target.value)}
        >
          <option value="">Selecionar Serviço</option>

          {servicos.map((servico) => (
            <option key={servico.id} value={servico.nome}>
              {servico.nome}
            </option>
          ))}
        </select>

        <input
          placeholder="R$ 0,00"
          value={
            novaConta.valor
              ? formatarMoeda(novaConta.valor)
              : ""
          }
          readOnly
        />

        <input
          type="date"
          value={novaConta.vencimento}
          onChange={(e) =>
            setNovaConta({
              ...novaConta,
              vencimento: e.target.value,
            })
          }
        />

        <button onClick={criarConta}>
          Salvar Conta
        </button>
      </div>

      <div className="tabela-wrapper">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {contas.map((conta) => (
              <tr key={conta.id}>
                <td>{conta.descricao}</td>

                <td>{formatarMoeda(conta.valor)}</td>

                <td>{conta.vencimento}</td>

                <td>
                  <span className={badgeStatus(conta.status)}>
                    {conta.status}
                  </span>
                </td>

                <td>
                  {conta.status !== "Recebido" && (
                    <button
                      className="btn-receber"
                      onClick={() => receberConta(conta.id)}
                    >
                      Receber
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {contas.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: "center" }}>
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
