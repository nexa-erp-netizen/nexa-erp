import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function LancamentosContabeis() {
  const [lancamentos, setLancamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [servicos, setServicos] = useState([])
  const [planoContas, setPlanoContas] = useState([])
  const [clienteAtual, setClienteAtual] = useState(0)
  const [clienteFiltro, setClienteFiltro] = useState("")
  const competenciaAtual = new Date().toISOString().slice(0, 7)
  const [competenciaFiltro, setCompetenciaFiltro] = useState(competenciaAtual)
  const [editandoId, setEditandoId] = useState(null)

  const [form, setForm] = useState({
    cliente: "",
    servicoId: "",
    descricao: "",
    tipo: "despesa",
    quantidade: 1,
    valor: "",
    data: "",
    categoria: "",
    planoConta: "",
    origem: "manual",
  })

  useEffect(() => {
    const clienteVoz = localStorage.getItem("nexaFiltroLancamentosCliente") || ""
    if (clienteVoz) {
      setClienteFiltro(clienteVoz)
      setForm((atual) => ({ ...atual, cliente: clienteVoz }))
      localStorage.removeItem("nexaFiltroLancamentosCliente")
    }
    carregarTudo()
  }, [])

  async function carregarTudo() {
    await Promise.all([
      carregarLancamentos(),
      carregarClientes(),
      carregarServicos(),
      carregarPlanoContas(),
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

  async function carregarPlanoContas() {
    try {
      const resposta = await api.get("/plano-contas")
      setPlanoContas(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (erro) {
      console.error("Erro ao carregar plano de contas:", erro)
    }
  }

  function naturezaCompativel(conta, tipoLancamento) {
    const natureza = String(conta?.natureza || "").toLowerCase()
    const nomeConta = String(conta?.conta || "").toLowerCase()

    if (tipoLancamento === "receita") {
      return (
        natureza.includes("credora") ||
        nomeConta.includes("receita") ||
        nomeConta.includes("faturamento")
      )
    }

    return (
      natureza.includes("devedora") ||
      nomeConta.includes("despesa") ||
      nomeConta.includes("custo") ||
      nomeConta.includes("imposto") ||
      nomeConta.includes("taxa")
    )
  }

  function selecionarPlanoConta(valor) {
    const conta = planoContas.find(
      (item) => String(item.conta || item.nome || item.descricao || "") === String(valor)
    )

    setForm({
      ...form,
      planoConta: valor,
      categoria: valor,
    })
  }

  function valorSeguro(valor) {
    if (typeof valor === "number") return valor

    if (valor === null || valor === undefined || valor === "") {
      return 0
    }

    let texto = String(valor)
      .replace("R$", "")
      .replace(/\s/g, "")
      .trim()

    if (texto.includes(",")) {
      texto = texto.replace(/\./g, "").replace(",", ".")
    } else {
      texto = texto.replace(/[^0-9.-]/g, "")
    }

    const numero = Number(texto)

    return Number.isFinite(numero) ? numero : 0
  }

  function formatarCampoMoeda(valor) {
    const apenasNumeros = String(valor || "").replace(/\D/g, "")
    const numero = Number(apenasNumeros || 0) / 100

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function formatarMoeda(valor) {
    return valorSeguro(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function quantidadeSegura(valor) {
    const quantidade = Math.trunc(Number(valor))
    return Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1
  }

  function valorUnitarioLancamento(lancamento) {
    const quantidade = quantidadeSegura(lancamento?.quantidade)

    if (lancamento?.valorUnitario !== null && lancamento?.valorUnitario !== undefined && lancamento?.valorUnitario !== "") {
      return valorSeguro(lancamento.valorUnitario)
    }

    return valorSeguro(lancamento?.valor) / quantidade
  }

  function totalFormulario() {
    return quantidadeSegura(form.quantidade) * valorSeguro(form.valor)
  }

  function formatarData(data) {
    if (!data) return "-"
    const d = new Date(data + "T00:00:00")
    return d.toLocaleDateString("pt-BR")
  }

  function obterCompetenciaValor(data) {
    if (!data) return ""

    const d = new Date(data + "T00:00:00")
    const ano = d.getFullYear()
    const mes = String(d.getMonth() + 1).padStart(2, "0")

    return `${ano}-${mes}`
  }

  function obterCompetenciaBR(data) {
    const competencia = obterCompetenciaValor(data)

    if (!competencia) return "-"

    const [ano, mes] = competencia.split("-")

    return `${mes}/${ano}`
  }

  function tipoNormalizado(tipo) {
    const texto = String(tipo || "").toLowerCase()

    if (
      texto === "receita" ||
      texto === "crédito" ||
      texto === "credito" ||
      texto === "entrada"
    ) {
      return "receita"
    }

    return "despesa"
  }

  function competenciaDentroDoFiltro(data) {
    const competencia = obterCompetenciaValor(data)

    if (!competencia) return false

    return competencia === competenciaFiltro
  }

  function limparFiltrosCompetencia() {
    setCompetenciaFiltro(competenciaAtual)
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
        quantidade: 1,
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
      quantidade: quantidadeSegura(form.quantidade),
      valor: formatarMoeda(valorServico),
      categoria: "Serviços Contábeis",
      planoConta: "Serviços Contábeis",
      tipo: "despesa",
      origem: "servico",
    })
  }

  async function salvarLancamento(e) {
    e.preventDefault()

    if (!form.cliente || !form.descricao || !form.valor || !form.data) {
      alert("Preencha cliente, descrição, quantidade, valor unitário e data.")
      return
    }

    const quantidade = quantidadeSegura(form.quantidade)
    const valorUnitario = valorSeguro(form.valor)
    const valorTotal = quantidade * valorUnitario

    const dadosLancamento = {
      cliente: form.cliente,
      descricao: form.descricao,
      tipo: form.tipo,
      quantidade,
      valorUnitario,
      valor: valorTotal,
      data: form.data,
      categoria: form.planoConta || form.categoria,
      planoConta: form.planoConta || form.categoria,
      origem: "manual",
    }

    try {
      if (editandoId) {
        await api.put(
          `/lancamentos-contabeis/${editandoId}`,
          dadosLancamento
        )
      } else {
        await api.post("/lancamentos-contabeis", dadosLancamento)

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
      quantidade: 1,
      valor: "",
      data: "",
      categoria: "",
      planoConta: "",
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
      quantidade: quantidadeSegura(lancamento.quantidade),
      valor: formatarMoeda(valorUnitarioLancamento(lancamento)),
      data: lancamento.data || "",
      categoria: lancamento.planoConta || lancamento.categoria || "",
      planoConta: lancamento.planoConta || lancamento.categoria || "",
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
      const tipo = tipoNormalizado(lancamento.tipo)
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

    const meses = {
      Jan: 0,
      Fev: 1,
      Mar: 2,
      Abr: 3,
      Mai: 4,
      Jun: 5,
      Jul: 6,
      Ago: 7,
      Set: 8,
      Out: 9,
      Nov: 10,
      Dez: 11,
    }

    return Object.values(grupos).map((grupo) => ({
      ...grupo,
      lancamentos: grupo.lancamentos.sort((a, b) => {
        return new Date(`${b.data || "1900-01-01"}T00:00:00`) - new Date(`${a.data || "1900-01-01"}T00:00:00`)
      }),
      graficoMensal: Object.values(grupo.graficoMensal).sort((a, b) => {
        const [mesA, anoA] = a.mes.split("/")
        const [mesB, anoB] = b.mes.split("/")

        return new Date(Number(anoA), meses[mesA], 1) - new Date(Number(anoB), meses[mesB], 1)
      }),
    }))
  }, [lancamentos])

  const gruposFiltrados = clienteFiltro
    ? clientesAgrupados.filter((grupo) => grupo.cliente === clienteFiltro)
    : []

  const grupo = gruposFiltrados[clienteAtual]

  const planosContasFiltrados = useMemo(() => {
    const filtrados = planoContas.filter((conta) =>
      naturezaCompativel(conta, form.tipo)
    )

    return filtrados.length > 0 ? filtrados : planoContas
  }, [planoContas, form.tipo])

  return (
    <div className="lc-page">
      <style>{`
        .lc-page {
          padding: 30px;
          color: white;
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

        .lc-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .lc-field > span {
          color: #a9b8cc;
          font-size: 12px;
          font-weight: 700;
          padding-left: 4px;
        }

        .lc-total-preview {
          min-height: 77px;
          border: 1px solid rgba(55,255,116,.28);
          border-radius: 16px;
          background: rgba(55,255,116,.08);
          padding: 9px 18px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
        }

        .lc-total-preview span {
          color: #a9b8cc;
          font-size: 12px;
        }

        .lc-total-preview strong {
          color: #37ff74;
          font-size: 17px;
        }

        .lc-select option {
          background: #061f47;
          color: white;
        }

        input[type="date"],
        input[type="month"] {
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


      <form
        onSubmit={salvarLancamento}
        className="lc-card"
      >
        <div className="lc-alert">
          Esta tela registra somente receitas e despesas da empresa do cliente. Serviços prestados pelo escritório devem ser lançados em <strong>Serviços Avulsos</strong>.
        </div>

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

          <input
            className="lc-input"
            placeholder="Descrição"
            value={form.descricao}
            onChange={(e) =>
              setForm({
                ...form,
                origem: "manual",
                servicoId: "",
                descricao: e.target.value,
              })
            }
          />

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

          <label className="lc-field">
            <span>Quantidade</span>
            <input
              className="lc-input"
              type="number"
              min="1"
              step="1"
              value={form.quantidade}
              onChange={(e) =>
                setForm({
                  ...form,
                  quantidade: e.target.value,
                })
              }
            />
          </label>

          <label className="lc-field">
            <span>Valor unitário</span>
            <input
              className="lc-input"
              placeholder="R$ 0,00"
              value={form.valor}
              onChange={(e) =>
                setForm({
                  ...form,
                  valor: formatarCampoMoeda(e.target.value),
                })
              }
            />
          </label>

          <div className="lc-total-preview">
            <span>Valor total</span>
            <strong>{formatarMoeda(totalFormulario())}</strong>
          </div>

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

          <select
            className="lc-select"
            value={form.planoConta}
            onChange={(e) => selecionarPlanoConta(e.target.value)}
          >
            <option value="">Selecione o plano de contas</option>

            {planosContasFiltrados.map((conta) => (
              <option key={conta.id} value={conta.conta}>
                {conta.codigo ? `${conta.codigo} - ` : ""}{conta.conta}
              </option>
            ))}

            {form.planoConta &&
              !planosContasFiltrados.some((conta) => conta.conta === form.planoConta) && (
                <option value={form.planoConta}>
                  {form.planoConta}
                </option>
              )}
          </select>

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

      <div className="lc-card">
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
    }}
  >
    <strong
      style={{
        color: "#c9d6e6",
        fontSize: "15px",
      }}
    >
      Visualizar cliente
    </strong>

    <select
      className="lc-select"
      style={{
        maxWidth: "320px",
      }}
      value={clienteFiltro}
      onChange={(e) => {
        setClienteFiltro(e.target.value)
        setClienteAtual(0)
        limparFiltrosCompetencia()
      }}
    >
      <option value="">
        Selecione um cliente
      </option>

      {clientes.map((cliente) => (
        <option
          key={cliente.id}
          value={cliente.nome}
        >
          {cliente.nome}
        </option>
      ))}
    </select>
  </div>
</div>

      {!clienteFiltro && (
        <div className="lc-card" style={{ color: "#c9d6e6" }}>
          Selecione um cliente para visualizar o gráfico, resumo e histórico contábil.
        </div>
      )}

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

          <div className="lc-card" style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: "#c9d6e6", fontSize: "15px" }}>
                Filtrar histórico
              </strong>

              <label style={{ color: "#c9d6e6", fontSize: "13px" }}>
                Competência
              </label>

              <input
                className="lc-input"
                style={{ maxWidth: "190px" }}
                type="month"
                value={competenciaFiltro}
                onChange={(e) => setCompetenciaFiltro(e.target.value)}
              />

              <button
                type="button"
                className="btn-edit"
                onClick={limparFiltrosCompetencia}
              >
                Mês atual
              </button>
            </div>
          </div>

          <table className="lc-table">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Descrição</th>
                <th>Plano de Contas</th>
                <th>Tipo</th>
                <th>Qtd.</th>
                <th>Valor unitário</th>
                <th>Total</th>
                <th>Origem</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {grupo.lancamentos
                .filter((lancamento) => competenciaDentroDoFiltro(lancamento.data))
                .map((lancamento) => (
                <tr key={lancamento.id}>
                  <td>{obterCompetenciaBR(lancamento.data)}</td>
                  <td>{lancamento.descricao}</td>
                  <td>{lancamento.planoConta || lancamento.categoria || "-"}</td>
                  <td
                    className={tipoNormalizado(lancamento.tipo) === "receita" ? "green" : "red"}
                    style={{ fontWeight: 800 }}
                  >
                    {tipoNormalizado(lancamento.tipo) === "receita" ? "Receita" : "Despesa"}
                  </td>
                  <td>{quantidadeSegura(lancamento.quantidade)}</td>
                  <td>{formatarMoeda(valorUnitarioLancamento(lancamento))}</td>
                  <td><strong>{formatarMoeda(lancamento.valor)}</strong></td>
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
            {gruposFiltrados.map((_, index) => (
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