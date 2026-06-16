import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { FaTrash, FaEdit } from "react-icons/fa"

export default function MovimentosCliente() {
  const linhaVazia = () => ({
    editandoId: null,
    data: "",
    tipo: "Receita",
    planoContaId: "",
    planoContaNome: "",
    forma: "",
    descricao: "",
    valor: "",
  })

  const [movimentos, setMovimentos] = useState([])
  const [planos, setPlanos] = useState([])
  const [formasPagamento, setFormasPagamento] = useState([])
  const [linhas, setLinhas] = useState([
    linhaVazia(),
    linhaVazia(),
    linhaVazia(),
    linhaVazia(),
    linhaVazia(),
  ])

  useEffect(() => {
    carregarTudo()
  }, [])

  async function carregarTudo() {
    await Promise.all([
      carregarMovimentos(),
      carregarPlanos(),
      carregarFormasPagamento(),
    ])
  }

  async function carregarMovimentos() {
    try {
      const resposta = await api.get("/movimentos-cliente")
      setMovimentos(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("ERRO AO CARREGAR MOVIMENTOS:", error)
      setMovimentos([])
    }
  }

  async function carregarPlanos() {
    try {
      const resposta = await api.get("/plano-contas")
      setPlanos(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("ERRO AO CARREGAR PLANO DE CONTAS:", error)
      setPlanos([])
    }
  }

  async function carregarFormasPagamento() {
    try {
      const resposta = await api.get("/formas-pagamento")
      setFormasPagamento(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("ERRO AO CARREGAR FORMAS DE PAGAMENTO:", error)
      setFormasPagamento([])
    }
  }

  function valorSeguro(valor) {
    if (valor === null || valor === undefined || valor === "") return 0

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

  function atualizarLinha(index, campo, valor) {
    const novas = [...linhas]

    if (campo === "planoContaId") {
      const plano = planos.find((p) => String(p.id) === String(valor))

      novas[index].planoContaId = valor
      novas[index].planoContaNome =
        plano?.nome || plano?.descricao || plano?.conta || ""
    } else {
      novas[index][campo] = valor
    }

    setLinhas(novas)
  }

  function formatarValorLinha(index) {
    const novas = [...linhas]
    const valor = valorSeguro(novas[index].valor)

    novas[index].valor = valor > 0 ? formatarMoeda(valor) : ""

    setLinhas(novas)
  }

  function adicionarLinha() {
    setLinhas([...linhas, linhaVazia()])
  }

  function corrigirMovimento(item) {
    setLinhas([
      {
        editandoId: item.id,
        data: item.data || "",
        tipo: item.tipo || "Receita",
        planoContaId: item.planoContaId || "",
        planoContaNome: item.planoContaNome || "",
        forma: item.forma || item.formaPagamento || "",
        descricao: item.descricao || "",
        valor: formatarMoeda(item.valor),
      },
    ])

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  async function salvarLancamentos() {
    try {
      const linhasValidas = linhas.filter(
        (linha) =>
          linha.data &&
          linha.descricao &&
          valorSeguro(linha.valor) > 0
      )

      if (linhasValidas.length === 0) {
        alert("Preencha pelo menos uma linha com data, descrição e valor.")
        return
      }

      const novosMovimentos = []

      for (const linha of linhasValidas) {
        const dados = {
          tipo: linha.tipo,
          data: linha.data,
          planoContaId: linha.planoContaId || null,
          planoContaNome: linha.planoContaNome,
          forma: linha.forma || "",
          formaPagamento: linha.forma || "",
          descricao: linha.descricao,
          valor: valorSeguro(linha.valor),
          comprovante: "",
          status: "Pendente",
        }

        if (linha.editandoId) {
          await api.put(`/movimentos-cliente/${linha.editandoId}`, dados)
        } else {
          novosMovimentos.push(dados)
        }
      }

      if (novosMovimentos.length > 0) {
        await api.post("/movimentos-cliente/massa", {
          movimentos: novosMovimentos,
        })
      }

      setLinhas([
        linhaVazia(),
        linhaVazia(),
        linhaVazia(),
        linhaVazia(),
        linhaVazia(),
      ])

      await carregarMovimentos()
      alert("Lançamentos salvos com sucesso.")
    } catch (erro) {
      console.error("Erro ao salvar lançamentos:", erro)
      alert("Erro ao salvar lançamentos.")
    }
  }

  async function excluirMovimento(id) {
    if (!window.confirm("Deseja excluir este movimento?")) return

    await api.delete(`/movimentos-cliente/${id}`)
    await carregarMovimentos()
  }

  const resumo = useMemo(() => {
    const receitas = movimentos
      .filter((m) => m.tipo === "Receita")
      .reduce((t, m) => t + valorSeguro(m.valor), 0)

    const despesas = movimentos
      .filter((m) => m.tipo === "Despesa")
      .reduce((t, m) => t + valorSeguro(m.valor), 0)

    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
      total: movimentos.length,
    }
  }, [movimentos])

  return (
    <div className="mv-page">
      <style>{`
        .mv-page { padding: 30px; color: white; }

        .mv-title {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .mv-subtitle {
          opacity: .8;
          margin-bottom: 25px;
        }

        .mv-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }

        .mv-box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 18px;
        }

        .mv-box span {
          display: block;
          opacity: .7;
          margin-bottom: 8px;
        }

        .mv-box strong { font-size: 20px; }

        .green { color: #32f06d; }
        .red { color: #ff5c70; }
        .blue { color: #3cbcff; }

        .mv-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 25px;
        }

        .mv-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .mv-card-title {
          font-size: 22px;
          font-weight: 900;
        }

        .mv-actions-top {
          display: flex;
          gap: 12px;
        }

        .mv-btn {
          border: none;
          border-radius: 12px;
          padding: 12px 18px;
          font-weight: 900;
          cursor: pointer;
        }

        .mv-btn-add {
          background: #061f47;
          color: white;
          border: 1px solid rgba(255,255,255,.15);
        }

        .mv-btn-save {
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          color: #00112b;
        }

        .mv-grid-wrap {
          overflow-x: hidden;
          border-radius: 16px;
          width: 100%;
          max-width: 100%;
        }

        .mv-grid,
        .mv-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 0;
          table-layout: auto;
        }

        .mv-grid th {
          background: #061f47;
          color: #9edfff;
          text-align: left;
          font-size: 13px;
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.12);
        }

        .mv-grid td {
          background: rgba(6,31,71,.72);
          padding: 8px;
          border-bottom: 1px solid rgba(255,255,255,.07);
          border-right: 1px solid rgba(255,255,255,.05);
        }

        .mv-grid th:nth-child(1),
        .mv-grid td:nth-child(1) { width: 110px; }

        .mv-grid th:nth-child(2),
        .mv-grid td:nth-child(2) { width: 90px; }

        .mv-grid th:nth-child(3),
        .mv-grid td:nth-child(3) { width: 140px; }

        .mv-grid th:nth-child(4),
        .mv-grid td:nth-child(4) { width: 120px; }

        .mv-grid th:nth-child(6),
        .mv-grid td:nth-child(6) { width: 110px; }

        .mv-input,
        .mv-select {
          width: 100%;
          height: 42px;
          background: #0b2855;
          border: 1px solid rgba(255,255,255,.12);
          color: white;
          border-radius: 9px;
          padding: 0 10px;
          outline: none;
          box-sizing: border-box;
        }

        .valor-input {
          max-width: 120px;
          text-align: right;
          font-weight: 700;
        }

        .mv-input::placeholder {
          color: rgba(255,255,255,.45);
        }

        .mv-select option {
          background: #061f47;
          color: white;
        }

        input[type="date"] { color-scheme: dark; }

        .mv-edit,
        .mv-delete {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 800;
        }

        .mv-edit {
          background: #17b8ff;
          color: #00112b;
        }

        .mv-delete {
          background: #ff5c70;
          color: white;
        }

        .mv-row-actions {
          display: flex;
          gap: 8px;
        }

        .mv-table th {
          color: #6bd8ff;
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .mv-table td {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,.05);
          line-height: 18px;
        }

        .mv-table th:nth-child(1),
        .mv-table td:nth-child(1) { width: 130px; }

        .mv-table th:nth-child(2),
        .mv-table td:nth-child(2) { width: 110px; }

        .mv-table th:nth-child(3),
        .mv-table td:nth-child(3) { width: 170px; }

        .mv-table th:nth-child(4),
        .mv-table td:nth-child(4) { width: 130px; }

        .mv-table th:nth-child(6),
        .mv-table td:nth-child(6) { width: 130px; }

        .mv-table th:nth-child(7),
        .mv-table td:nth-child(7) { width: 95px; }

        .tipo-receita {
          color: #32f06d;
          font-weight: 900;
        }

        .tipo-despesa {
          color: #ff5c70;
          font-weight: 900;
        }

        .valor-coluna {
          text-align: right;
          font-weight: 700;
          white-space: nowrap;
        }

        @media (max-width: 768px) {

          .mv-table td {
            padding: 6px 8px !important;
            line-height: 16px !important;
            font-size: 13px !important;
          }

          .mv-table th {
            padding: 8px !important;
            font-size: 12px !important;
          }

          .mv-page {
            padding: 16px !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: hidden !important;
          }

          .mv-title {
            font-size: 34px !important;
            line-height: 1.05 !important;
          }

          .mv-subtitle { font-size: 16px !important; }
          .mv-summary { grid-template-columns: 1fr !important; }
          .mv-box { padding: 16px !important; }

          .mv-card {
            padding: 16px !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }

          .mv-card-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }

          .mv-card-title {
            font-size: 24px !important;
            line-height: 1.1 !important;
          }

          .mv-actions-top {
            flex-direction: column !important;
            width: 100% !important;
          }

          .mv-btn { width: 100% !important; }

          .mv-grid-wrap {
            overflow-x: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            -webkit-overflow-scrolling: touch;
          }

          .mv-grid {
            min-width: 980px !important;
            width: 980px !important;
            table-layout: fixed !important;
          }

          .mv-table {
            min-width: 900px !important;
            width: 900px !important;
            table-layout: fixed !important;
          }

          .mv-input,
          .mv-select { min-width: 0 !important; }
          .valor-input { max-width: 100% !important; }
        }
      `}</style>

      <div className="mv-title">Movimentação da Empresa</div>

      <div className="mv-subtitle">
        Controle simplificado de receitas e despesas
      </div>

      <div className="mv-summary">
        <div className="mv-box">
          <span>Total de Crédito</span>
          <strong className="green">
            {formatarMoeda(resumo.receitas)}
          </strong>
        </div>

        <div className="mv-box">
          <span>Total de Débito</span>
          <strong className="red">
            {formatarMoeda(resumo.despesas)}
          </strong>
        </div>

        <div className="mv-box">
          <span>Saldo Atual</span>
          <strong className={resumo.saldo >= 0 ? "green" : "red"}>
            {formatarMoeda(resumo.saldo)}
          </strong>
        </div>

        <div className="mv-box">
          <span>Lançamentos</span>
          <strong>{resumo.total}</strong>
        </div>
      </div>

      <div className="mv-card">
        <div className="mv-card-header">
          <div className="mv-card-title">Lançamentos em Massa</div>

          <div className="mv-actions-top">
            <button
              type="button"
              className="mv-btn mv-btn-add"
              onClick={adicionarLinha}
            >
              + Adicionar linha
            </button>

            <button
              type="button"
              className="mv-btn mv-btn-save"
              onClick={salvarLancamentos}
            >
              Salvar Lançamentos
            </button>
          </div>
        </div>

        <div className="mv-grid-wrap">
          <table className="mv-grid">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Plano de contas</th>
                <th>Forma</th>
                <th>Descrição / Histórico</th>
                <th>Valor</th>
              </tr>
            </thead>

            <tbody>
              {linhas.map((linha, index) => (
                <tr key={index}>
                  <td>
                    <input
                      className="mv-input"
                      type="date"
                      value={linha.data}
                      onChange={(e) =>
                        atualizarLinha(index, "data", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <select
                      className="mv-select"
                      value={linha.tipo}
                      onChange={(e) =>
                        atualizarLinha(index, "tipo", e.target.value)
                      }
                    >
                      <option value="Receita">Receita</option>
                      <option value="Despesa">Despesa</option>
                    </select>
                  </td>

                  <td>
                    <select
                      className="mv-select"
                      value={linha.planoContaId}
                      onChange={(e) =>
                        atualizarLinha(index, "planoContaId", e.target.value)
                      }
                    >
                      <option value="">Selecione</option>

                      {planos.map((plano) => (
                        <option key={plano.id} value={plano.id}>
                          {plano.nome || plano.descricao || plano.conta}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <select
                      className="mv-select"
                      value={linha.forma}
                      onChange={(e) =>
                        atualizarLinha(index, "forma", e.target.value)
                      }
                    >
                      <option value="">Selecione</option>

                      {formasPagamento
                        .filter((forma) => forma.ativo !== false)
                        .map((forma) => (
                          <option key={forma.id} value={forma.nome}>
                            {forma.nome}
                          </option>
                        ))}
                    </select>
                  </td>

                  <td>
                    <input
                      className="mv-input"
                      placeholder="Ex: venda balcão, aluguel, energia..."
                      value={linha.descricao}
                      onChange={(e) =>
                        atualizarLinha(index, "descricao", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="mv-input valor-input"
                      placeholder="0,00"
                      value={linha.valor}
                      onChange={(e) =>
                        atualizarLinha(index, "valor", e.target.value)
                      }
                      onBlur={() => formatarValorLinha(index)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mv-card">
        <div className="mv-card-header">
          <div className="mv-card-title">Lançamentos Salvos</div>
        </div>

        <div className="mv-grid-wrap">
          <table className="mv-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Plano de contas</th>
                <th>Forma</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {movimentos.map((item) => (
                <tr key={item.id}>
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
                  <td>{item.forma || item.formaPagamento || "-"}</td>
                  <td>{item.descricao}</td>

                  <td className="valor-coluna">
                    {formatarMoeda(item.valor)}
                  </td>

                  <td>
                    <div className="mv-row-actions">
                      <button
                        className="mv-edit"
                        onClick={() => corrigirMovimento(item)}
                        title="Corrigir"
                      >
                        <FaEdit />
                      </button>

                      <button
                        className="mv-delete"
                        onClick={() => excluirMovimento(item.id)}
                        title="Excluir"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {movimentos.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ opacity: .7 }}>
                    Nenhum lançamento cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
