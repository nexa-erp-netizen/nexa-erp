import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function LancamentosContabeis() {
  const [lancamentos, setLancamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [servicos, setServicos] = useState([])
  const [clienteAtual, setClienteAtual] = useState(0)
  const [editandoId, setEditandoId] = useState(null)

  const [form, setForm] = useState({
    cliente: "",
    servicoId: "",
    descricao: "",
    tipo: "despesa",
    valor: "",
    data: "",
    categoria: "",
    origem: "manual",
  })

  useEffect(() => {
    carregarTudo()
  }, [])

  async function carregarTudo() {
    await Promise.all([
      carregarLancamentos(),
      carregarClientes(),
      carregarServicos(),
    ])
  }

  async function carregarLancamentos() {
    try {
      const resposta = await api.get("/lancamentos-contabeis")
      setLancamentos(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (erro) {
      console.error("Erro ao carregar lançamentos:", erro)
    }
  }

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientes(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (erro) {
      console.error("Erro ao carregar clientes:", erro)
    }
  }

  async function carregarServicos() {
    try {
      const resposta = await api.get("/servicos")
      setServicos(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (erro) {
      console.error("Erro ao carregar serviços:", erro)
    }
  }

  function valorSeguro(valor) {
    if (typeof valor === "number") return valor

    const limpo = String(valor || "0")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()

    const numero = Number(limpo)

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
    const d = new Date(data + "T00:00:00")
    return d.toLocaleDateString("pt-BR")
  }

  function nomeMes(data) {
    if (!data) return "Sem data"

    const meses = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ]

    const d = new Date(data + "T00:00:00")
    return `${meses[d.getMonth()]}/${d.getFullYear()}`
  }

  function selecionarServico(servicoId) {
    const servico = servicos.find(
      (item) => String(item.id) === String(servicoId)
    )

    if (!servico) {
      setForm({
        ...form,
        servicoId: "",
        descricao: "",
        valor: "",
        categoria: "",
        tipo: "despesa",
        origem: "servico",
      })
      return
    }

    const nomeServico =
      servico.nome ||
      servico.descricao ||
      servico.servico ||
      servico.titulo ||
      "Serviço"

    const valorServico =
      servico.valor ||
      servico.preco ||
      servico.valorPadrao ||
      servico.valor_padrao ||
      ""

    setForm({
      ...form,
      servicoId,
      descricao: nomeServico,
      valor: valorServico,
      categoria: "Serviços Contábeis",
      tipo: "despesa",
      origem: "servico",
    })
  }

  async function salvarLancamento(e) {
    e.preventDefault()

    if (!form.cliente || !form.descricao || !form.valor || !form.data) {
      alert("Preencha cliente, descrição, valor e data.")
      return
    }

    const valorNumerico = valorSeguro(form.valor)

    const dadosLancamento = {
      cliente: form.cliente,
      descricao: form.descricao,
      tipo: form.tipo,
      valor: valorNumerico,
      data: form.data,
      categoria: form.categoria,
      origem: form.origem,
      servicoId: form.servicoId || null,
    }

    try {
      if (editandoId) {
        await api.put(
          `/lancamentos-contabeis/${editandoId}`,
          dadosLancamento
        )
      } else {
        await api.post("/lancamentos-contabeis", dadosLancamento)

        if (form.origem === "servico") {
          await api.post("/financeiro", {
            descricao: form.descricao,
            cliente: form.cliente,
            tipo: "Receber",
            valor: formatarMoeda(valorNumerico),
            vencimento: form.data,
            status: "Pendente",
            anexos: [],
            origem: "Serviço",
          })
        }
      }

      limparFormulario()
      await carregarLancamentos()
    } catch (erro) {
      console.error("Erro ao salvar lançamento:", erro)
      alert("Erro ao salvar lançamento.")
    }
  }

  function limparFormulario() {
    setEditandoId(null)

    setForm({
      cliente: "",
      servicoId: "",
      descricao: "",
      tipo: "despesa",
      valor: "",
      data: "",
      categoria: "",
      origem: "manual",
    })
  }

  function editarLancamento(lancamento) {
    setEditandoId(lancamento.id)

    setForm({
      cliente: lancamento.cliente || "",
      servicoId: lancamento.servicoId || "",
      descricao: lancamento.descricao || "",
      tipo: String(lancamento.tipo || "despesa").toLowerCase(),
      valor: lancamento.valor || "",
      data: lancamento.data || "",
      categoria: lancamento.categoria || "",
      origem: lancamento.origem || "manual",
    })

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  async function excluirLancamento(id) {
    if (!window.confirm("Deseja excluir este lançamento?")) return

    try {
      await api.delete(`/lancamentos-contabeis/${id}`)
      await carregarLancamentos()
    } catch (erro) {
      console.error("Erro ao excluir lançamento:", erro)
    }
  }

  const clientesAgrupados = useMemo(() => {
    const grupos = {}

    lancamentos.forEach((lancamento) => {
      const cliente = lancamento.cliente || "Sem cliente"

      if (!grupos[cliente]) {
        grupos[cliente] = {
          cliente,
          lancamentos: [],
          totalReceitas: 0,
          totalDespesas: 0,
          saldo: 0,
          graficoMensal: {},
        }
      }

      const valor = valorSeguro(lancamento.valor)
      const tipo = String(lancamento.tipo || "").toLowerCase()
      const mes = nomeMes(lancamento.data)

      grupos[cliente].lancamentos.push(lancamento)

      if (!grupos[cliente].graficoMensal[mes]) {
        grupos[cliente].graficoMensal[mes] = {
          mes,
          receitas: 0,
          despesas: 0,
          saldo: 0,
        }
      }

      if (tipo === "receita") {
        grupos[cliente].totalReceitas += valor
        grupos[cliente].graficoMensal[mes].receitas += valor
      } else {
        grupos[cliente].totalDespesas += valor
        grupos[cliente].graficoMensal[mes].despesas += valor
      }

      grupos[cliente].saldo =
        grupos[cliente].totalReceitas -
        grupos[cliente].totalDespesas

      grupos[cliente].graficoMensal[mes].saldo =
        grupos[cliente].graficoMensal[mes].receitas -
        grupos[cliente].graficoMensal[mes].despesas
    })

    return Object.values(grupos).map((grupo) => ({
      ...grupo,
      graficoMensal: Object.values(grupo.graficoMensal),
    }))
  }, [lancamentos])

  const grupo = clientesAgrupados[clienteAtual]

  return (
    <div className="lc-page">
      <style>{`
        .lc-page {
          padding: 30px;
          color: white;
        }

        .lc-title {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .lc-subtitle {
          opacity: .8;
          margin-bottom: 25px;
        }

        .lc-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 25px;
        }

        .lc-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 18px;
        }

        .lc-tab {
          border: 1px solid rgba(255,255,255,.12);
          background: #061f47;
          color: white;
          padding: 13px 18px;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 800;
        }

        .lc-tab.active {
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          color: #00112b;
        }

        .lc-alert {
          background: rgba(23,184,255,.12);
          border: 1px solid rgba(23,184,255,.25);
          color: #8fdcff;
          border-radius: 14px;
          padding: 13px 16px;
          font-size: 14px;
          margin-bottom: 18px;
        }

        .lc-form {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 16px;
        }

        .lc-input,
        .lc-select {
          height: 58px !important;
          border: 1px solid rgba(255,255,255,.14) !important;
          border-radius: 16px !important;
          background: #061f47 !important;
          color: white !important;
          padding: 0 18px !important;
          font-size: 15px !important;
          outline: none !important;
          box-sizing: border-box !important;
        }

        .lc-input::placeholder {
          color: rgba(255,255,255,.55);
        }

        .lc-select option {
          background: #061f47;
          color: white;
        }

        input[type="date"] {
          color-scheme: dark;
        }

        .lc-button {
          grid-column: 1 / -1;
          height: 60px;
          border: none;
          border-radius: 16px;
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          font-size: 18px;
          font-weight: 900;
          cursor: pointer;
          color: #00112b;
        }

        .lc-button.cancel {
          background: #ff5c70;
          color: white;
        }

        .lc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          gap: 20px;
        }

        .lc-client-title {
          font-size: 22px;
          font-weight: 800;
        }

        .lc-summary {
          display: flex;
          gap: 12px;
        }

        .lc-box {
          background: rgba(255,255,255,.05);
          border-radius: 16px;
          padding: 14px 18px;
          min-width: 140px;
        }

        .lc-box span {
          display: block;
          opacity: .7;
          font-size: 13px;
          margin-bottom: 5px;
        }

        .lc-box strong {
          font-size: 15px;
        }

        .green { color: #32f06d; }
        .red { color: #ff5c70; }
        .blue { color: #3cbcff; }

        .lc-chart {
          background: rgba(0,0,0,.15);
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .lc-chart-title {
          font-size: 17px;
          margin-bottom: 20px;
          font-weight: 700;
        }

        .lc-chart-area {
          display: flex;
          align-items: flex-end;
          gap: 28px;
          min-height: 260px;
          overflow-x: auto;
        }

        .lc-month {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .lc-bars {
          height: 180px;
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .lc-bar {
          width: 18px;
          border-radius: 10px 10px 0 0;
          position: relative;
          cursor: pointer;
        }

        .receita {
          background: linear-gradient(180deg,#42ff90,#12b85b);
        }

        .despesa {
          background: linear-gradient(180deg,#ff7587,#d61f3d);
        }

        .saldo {
          background: linear-gradient(180deg,#57c8ff,#008cff);
        }

        .tooltip {
          display: none;
          position: absolute;
          bottom: 110%;
          left: 50%;
          transform: translateX(-50%);
          background: black;
          padding: 10px;
          border-radius: 12px;
          white-space: nowrap;
          font-size: 12px;
          z-index: 99;
        }

        .lc-bar:hover .tooltip {
          display: block;
        }

        .lc-table {
          width: 100%;
          border-collapse: collapse;
        }

        .lc-table th {
          color: #6bd8ff;
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          font-size: 14px;
        }

        .lc-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.05);
          font-size: 14px;
        }

        .lc-actions {
          display: flex;
          gap: 10px;
        }

        .btn-edit,
        .btn-delete {
          border: none;
          color: white;
          border-radius: 10px;
          padding: 8px 14px;
          cursor: pointer;
          font-weight: 700;
        }

        .btn-edit {
          background: #17b8ff;
        }

        .btn-delete {
          background: #ff5c70;
        }

        .lc-pagination {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 25px;
        }

        .lc-page-btn {
          width: 42px;
          height: 42px;
          border: none;
          border-radius: 12px;
          background: #061f47;
          color: white;
          cursor: pointer;
          font-weight: 700;
        }

        .lc-page-btn.active {
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          color: #00112b;
        }
      `}</style>

      <div className="lc-title">
        Lançamentos Contábeis
      </div>

      <div className="lc-subtitle">
        Sistema ERP Contábil Inteligente
      </div>

      <form
        onSubmit={salvarLancamento}
        className="lc-card"
      >
        <div className="lc-tabs">
          <button
            type="button"
            className={`lc-tab ${form.origem === "manual" ? "active" : ""}`}
            onClick={() =>
              setForm({
                ...form,
                origem: "manual",
                servicoId: "",
              })
            }
          >
            Lançamento Manual
          </button>

          <button
            type="button"
            className={`lc-tab ${form.origem === "servico" ? "active" : ""}`}
            onClick={() =>
              setForm({
                ...form,
                origem: "servico",
                tipo: "despesa",
                categoria: "Serviços Contábeis",
              })
            }
          >
            Serviços
          </button>
        </div>

        {form.origem === "servico" && (
          <div className="lc-alert">
            Serviços lançados entram como despesa no cliente e como receita no seu financeiro.
          </div>
        )}

        <div className="lc-form">
          <select
            className="lc-select"
            value={form.cliente}
            onChange={(e) =>
              setForm({
                ...form,
                cliente: e.target.value,
              })
            }
          >
            <option value="">Selecione o cliente</option>

            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.nome}>
                {cliente.nome}
              </option>
            ))}
          </select>

          {form.origem === "servico" ? (
            <select
              className="lc-select"
              value={form.servicoId}
              onChange={(e) => selecionarServico(e.target.value)}
            >
              <option value="">Selecione um serviço</option>

              {servicos.map((servico) => (
                <option key={servico.id} value={servico.id}>
                  {servico.nome ||
                    servico.descricao ||
                    servico.servico ||
                    servico.titulo}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="lc-input"
              placeholder="Descrição"
              value={form.descricao}
              onChange={(e) =>
                setForm({
                  ...form,
                  descricao: e.target.value,
                })
              }
            />
          )}

          <select
            className="lc-select"
            value={form.tipo}
            onChange={(e) =>
              setForm({
                ...form,
                tipo: e.target.value,
              })
            }
          >
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>

          <input
            className="lc-input"
            placeholder="Valor"
            value={form.valor}
            onChange={(e) =>
              setForm({
                ...form,
                valor: e.target.value,
              })
            }
          />

          <input
            className="lc-input"
            type="date"
            value={form.data}
            onChange={(e) =>
              setForm({
                ...form,
                data: e.target.value,
              })
            }
          />

          <input
            className="lc-input"
            placeholder="Categoria"
            value={form.categoria}
            onChange={(e) =>
              setForm({
                ...form,
                categoria: e.target.value,
              })
            }
          />

          <button className="lc-button">
            {editandoId ? "Atualizar Lançamento" : "Salvar Lançamento"}
          </button>

          {editandoId && (
            <button
              type="button"
              className="lc-button cancel"
              onClick={limparFormulario}
            >
              Cancelar Correção
            </button>
          )}
        </div>
      </form>

      {grupo && (
        <div className="lc-card">
          <div className="lc-header">
            <div className="lc-client-title">
              {grupo.cliente}
            </div>

            <div className="lc-summary">
              <div className="lc-box">
                <span>Receitas</span>
                <strong className="green">
                  {formatarMoeda(grupo.totalReceitas)}
                </strong>
              </div>

              <div className="lc-box">
                <span>Despesas</span>
                <strong className="red">
                  {formatarMoeda(grupo.totalDespesas)}
                </strong>
              </div>

              <div className="lc-box">
                <span>Saldo</span>
                <strong className="blue">
                  {formatarMoeda(grupo.saldo)}
                </strong>
              </div>
            </div>
          </div>

          <div className="lc-chart">
            <div className="lc-chart-title">
              Evolução Contábil
            </div>

            <div className="lc-chart-area">
              {grupo.graficoMensal.map((item) => {
                const maiorValor = Math.max(
                  item.receitas,
                  item.despesas,
                  Math.abs(item.saldo),
                  1
                )

                return (
                  <div className="lc-month" key={item.mes}>
                    <div className="lc-bars">
                      <div
                        className="lc-bar receita"
                        style={{
                          height: `${(item.receitas / maiorValor) * 170}px`,
                        }}
                      >
                        <div className="tooltip">
                          Receita: {formatarMoeda(item.receitas)}
                        </div>
                      </div>

                      <div
                        className="lc-bar despesa"
                        style={{
                          height: `${(item.despesas / maiorValor) * 170}px`,
                        }}
                      >
                        <div className="tooltip">
                          Despesa: {formatarMoeda(item.despesas)}
                        </div>
                      </div>

                      <div
                        className="lc-bar saldo"
                        style={{
                          height: `${(Math.abs(item.saldo) / maiorValor) * 170}px`,
                        }}
                      >
                        <div className="tooltip">
                          Saldo: {formatarMoeda(item.saldo)}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      {item.mes}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <table className="lc-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Origem</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {grupo.lancamentos.map((lancamento) => (
                <tr key={lancamento.id}>
                  <td>{formatarData(lancamento.data)}</td>
                  <td>{lancamento.descricao}</td>
                  <td>{lancamento.categoria || "-"}</td>
                  <td>{lancamento.tipo}</td>
                  <td>{formatarMoeda(lancamento.valor)}</td>
                  <td>{lancamento.origem || "manual"}</td>
                  <td>
                    <div className="lc-actions">
                      <button
                        className="btn-edit"
                        onClick={() => editarLancamento(lancamento)}
                      >
                        Corrigir
                      </button>

                      <button
                        className="btn-delete"
                        onClick={() => excluirLancamento(lancamento.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="lc-pagination">
            {clientesAgrupados.map((_, index) => (
              <button
                key={index}
                className={`lc-page-btn ${
                  clienteAtual === index ? "active" : ""
                }`}
                onClick={() => setClienteAtual(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}