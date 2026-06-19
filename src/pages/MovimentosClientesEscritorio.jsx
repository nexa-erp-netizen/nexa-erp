import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function MovimentosClientesEscritorio() {
  const [movimentos, setMovimentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [clienteFiltro, setClienteFiltro] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState("")
  const [dataInicial, setDataInicial] = useState("")
  const [dataFinal, setDataFinal] = useState("")

  useEffect(() => {
    definirPeriodoMesAtual()
    carregarDados()
  }, [])

  function definirPeriodoMesAtual() {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = hoje.getMonth()

    const primeiroDia = new Date(ano, mes, 1)
    const ultimoDia = new Date(ano, mes + 1, 0)

    setDataInicial(formatarDataInput(primeiroDia))
    setDataFinal(formatarDataInput(ultimoDia))
  }

  function formatarDataInput(data) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, "0")
    const dia = String(data.getDate()).padStart(2, "0")
    return `${ano}-${mes}-${dia}`
  }

  async function carregarDados() {
    const [movimentosResp, clientesResp] = await Promise.all([
      api.get("/movimentos-cliente"),
      api.get("/clientes"),
    ])

    setMovimentos(Array.isArray(movimentosResp.data) ? movimentosResp.data : [])
    setClientes(Array.isArray(clientesResp.data) ? clientesResp.data : [])
  }

  function valorSeguro(valor) {
    if (!valor) return 0

    let texto = String(valor).replace("R$", "").trim()

    if (texto.includes(",")) {
      texto = texto.replace(/\./g, "").replace(",", ".")
    }

    const numero = Number(texto)
    return Number.isFinite(numero) ? numero : 0
  }

  function formatarMoeda(valor) {
    return valorSeguro(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function formatarData(data) {
    if (!data) return "-"
    return new Date(data + "T00:00:00").toLocaleDateString("pt-BR")
  }

  const clienteSelecionado = Boolean(clienteFiltro)

  const movimentosFiltrados = useMemo(() => {
    if (!clienteSelecionado) return []

    return movimentos.filter((item) => {
      if (item.cliente !== clienteFiltro) return false
      if (tipoFiltro && item.tipo !== tipoFiltro) return false
      if (dataInicial && item.data < dataInicial) return false
      if (dataFinal && item.data > dataFinal) return false

      return true
    })
  }, [
    movimentos,
    clienteFiltro,
    tipoFiltro,
    dataInicial,
    dataFinal,
    clienteSelecionado,
  ])

  const resumo = useMemo(() => {
    if (!clienteSelecionado) {
      return {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        total: 0,
      }
    }

    const receitas = movimentosFiltrados
      .filter((item) => item.tipo === "Receita")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const despesas = movimentosFiltrados
      .filter((item) => item.tipo === "Despesa")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
      total: movimentosFiltrados.length,
    }
  }, [movimentosFiltrados, clienteSelecionado])

  return (
    <div className="me-page">
      <style>{`
        .me-page {
          padding: 30px;
          color: white;
        }

        .me-title {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .me-subtitle {
          opacity: .8;
          margin-bottom: 25px;
        }

        .me-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }

        .me-box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 18px;
        }

        .me-box span {
          display: block;
          opacity: .7;
          margin-bottom: 8px;
        }

        .me-box strong {
          font-size: 20px;
        }

        .green { color: #32f06d; }
        .red { color: #ff5c70; }
        .blue { color: #3cbcff; }

        .me-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 25px;
        }

        .me-filtros {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 14px;
        }

        .me-input,
        .me-select {
          width: 100%;
          height: 48px;
          background: #061f47;
          border: 1px solid rgba(255,255,255,.14);
          color: white;
          border-radius: 12px;
          padding: 0 14px;
          box-sizing: border-box;
          outline: none;
        }

        .me-select option {
          background: #061f47;
          color: white;
        }

        input[type="date"] {
          color-scheme: dark;
        }

        .me-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .me-table th {
          color: #6bd8ff;
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          font-size: 13px;
        }

        .me-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.05);
          font-size: 14px;
        }

        .me-table th:nth-child(1),
        .me-table td:nth-child(1) {
          width: 210px;
        }

        .me-table th:nth-child(2),
        .me-table td:nth-child(2) {
          width: 110px;
        }

        .me-table th:nth-child(3),
        .me-table td:nth-child(3) {
          width: 100px;
        }

        .me-table th:nth-child(6),
        .me-table td:nth-child(6) {
          width: 130px;
        }

        .tipo-receita {
          color: #32f06d;
          font-weight: 900;
        }

        .tipo-despesa {
          color: #ff5c70;
          font-weight: 900;
        }

        .valor {
          text-align: right;
          font-weight: 800;
          white-space: nowrap;
        }

        .empty {
          opacity: .7;
          padding: 18px;
        }

        @media (max-width: 900px) {
          .me-summary,
          .me-filtros {
            grid-template-columns: 1fr;
          }

          .me-page {
            padding: 18px;
          }

          .me-card {
            overflow-x: auto;
          }
        }
      `}</style>

      <div className="me-card">
        <div className="me-filtros">
          <select
            className="me-select"
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
          >
            <option value="">Selecione um cliente</option>

            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.nome}>
                {cliente.nome}
              </option>
            ))}
          </select>

          <select
            className="me-select"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            disabled={!clienteSelecionado}
          >
            <option value="">Todos os tipos</option>
            <option value="Receita">Receitas</option>
            <option value="Despesa">Despesas</option>
          </select>

          <input
            className="me-input"
            type="date"
            value={dataInicial}
            onChange={(e) => setDataInicial(e.target.value)}
            disabled={!clienteSelecionado}
          />

          <input
            className="me-input"
            type="date"
            value={dataFinal}
            onChange={(e) => setDataFinal(e.target.value)}
            disabled={!clienteSelecionado}
          />
        </div>
      </div>

      {clienteSelecionado && (
        <>
          <div className="me-summary">
            <div className="me-box">
              <span>Receitas</span>
              <strong className="green">{formatarMoeda(resumo.receitas)}</strong>
            </div>

            <div className="me-box">
              <span>Despesas</span>
              <strong className="red">{formatarMoeda(resumo.despesas)}</strong>
            </div>

            <div className="me-box">
              <span>Saldo</span>
              <strong className={resumo.saldo >= 0 ? "green" : "red"}>
                {formatarMoeda(resumo.saldo)}
              </strong>
            </div>

            <div className="me-box">
              <span>Lançamentos</span>
              <strong className="blue">{resumo.total}</strong>
            </div>
          </div>

          <div className="me-card">
            <table className="me-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Plano de contas</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>

              <tbody>
                {movimentosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td>{item.cliente}</td>
                    <td>{formatarData(item.data)}</td>

                    <td
                      className={
                        item.tipo === "Receita"
                          ? "tipo-receita"
                          : "tipo-despesa"
                      }
                    >
                      {item.tipo}
                    </td>

                    <td>{item.planoContaNome || "-"}</td>
                    <td>{item.descricao}</td>

                    <td className="valor">{formatarMoeda(item.valor)}</td>
                  </tr>
                ))}

                {movimentosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty">
                      Nenhum movimento encontrado para este cliente no período
                      selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}