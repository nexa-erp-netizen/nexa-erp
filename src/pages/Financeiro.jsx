import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

const LINHAS_INICIAIS = 3

function linhaVazia(tipo = "Receber") {
  return {
    data: new Date().toISOString().slice(0, 10),
    tipo,
    centroCusto: "",
    formaPagamento: "",
    descricao: "",
    cliente: "",
    valor: "",
    status: tipo === "Pagar" ? "Pago" : "Recebido",
  }
}

export default function Financeiro() {
  const [lancamentos, setLancamentos] = useState([])
  const [clientesCadastrados, setClientesCadastrados] = useState([])
  const [clienteFiltro, setClienteFiltro] = useState("")
  const [servicos, setServicos] = useState([])
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [modoLancamento, setModoLancamento] = useState("Receber")
  const [linhas, setLinhas] = useState(Array.from({ length: LINHAS_INICIAIS }, () => linhaVazia("Receber")))
  const [editandoId, setEditandoId] = useState(null)
  const [carregando, setCarregando] = useState(false)

  const formasPagamento = ["PIX", "Boleto", "Cartão", "Dinheiro", "Transferência"]
  const centrosCustoPadrao = [
    "Honorários",
    "Serviços e Cobranças",
    "Serviços Avulsos",
    "Abertura MEI",
    "Certificado Digital",
    "Aluguel",
    "Internet",
    "Energia",
    "Sistema",
    "Marketing",
    "Contabilidade",
    "Impostos",
    "Material de Escritório",
    "Outros",
  ]

  useEffect(() => {
    // Um filtro antigo salvo no navegador não pode esconder receitas do escritório.
    localStorage.removeItem("nexaFiltroFinanceiroCliente")
    carregarLancamentos()
    carregarClientes()
    carregarServicos()
  }, [])

  async function carregarLancamentos() {
    try {
      // Garante que serviços e cobranças antigos ou recém-alterados sejam
      // materializados no Financeiro antes de montar o histórico da tela.
      try {
        await api.post("/servicos-avulsos/sincronizar-financeiro", {})
      } catch (syncError) {
        console.error("Erro ao sincronizar serviços e cobranças com o Financeiro", syncError)
      }

      const resposta = await api.get("/financeiro")
      setLancamentos(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      alert("Erro ao carregar financeiro")
      console.error(error)
    }
  }

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientesCadastrados(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("Erro ao carregar clientes", error)
    }
  }

  async function carregarServicos() {
    try {
      const resposta = await api.get("/servicos")
      setServicos(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("Erro ao carregar serviços", error)
    }
  }

  function valorNumerico(valorFormatado) {
    if (typeof valorFormatado === "number") {
      return Number.isFinite(valorFormatado) ? valorFormatado : 0
    }

    if (valorFormatado === null || valorFormatado === undefined || valorFormatado === "") {
      return 0
    }

    let texto = String(valorFormatado)
      .replace("R$", "")
      .replace(/\s/g, "")
      .trim()

    const ultimaVirgula = texto.lastIndexOf(",")
    const ultimoPonto = texto.lastIndexOf(".")

    if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
      // 27.000,00 (pt-BR) ou 27,000.00 (en-US/API).
      texto = ultimaVirgula > ultimoPonto
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto.replace(/,/g, "")
    } else if (ultimaVirgula >= 0) {
      texto = texto.replace(",", ".")
    } else if (ultimoPonto >= 0) {
      // A API envia DECIMAL como string, por exemplo "270.00".
      // Só tratamos ponto como milhar quando o formato for realmente 27.000.
      const pareceMilhar = /^-?\d{1,3}(?:\.\d{3})+$/.test(texto)
      if (pareceMilhar) texto = texto.replace(/\./g, "")
    }

    texto = texto.replace(/[^0-9.-]/g, "")
    const numero = Number(texto)
    return Number.isFinite(numero) ? numero : 0
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  function formatarData(data) {
    if (!data) return "-"
    const [ano, mes, dia] = String(data).slice(0, 10).split("-")
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
  }

  function dataDoLancamento(item) {
    return item.vencimento || item.dataRecebimento || item.createdAt || item.updatedAt || ""
  }

  function competenciaDoLancamento(item) {
    const data = dataDoLancamento(item)
    return data ? String(data).slice(0, 7) : ""
  }

  function ehReceita(item) {
    const tipo = String(item.tipo || "").toLowerCase()
    return tipo.includes("receber") || tipo.includes("receita") || tipo.includes("crédito") || tipo.includes("credito")
  }

  function ehDespesa(item) {
    const tipo = String(item.tipo || "").toLowerCase()
    return tipo.includes("pagar") || tipo.includes("despesa") || tipo.includes("débito") || tipo.includes("debito")
  }

  function statusAutomatico(item) {
    if (item.status === "Pago" || item.status === "Recebido") return item.status
    if (item.vencimento && new Date(item.vencimento) < new Date()) return "Atrasado"
    return item.status || "Pendente"
  }

  function origemDoLancamento(item) {
    if (item.origem) return item.origem
    if (item.cliente && !["Cliente Avulso / Fornecedor", "Cliente Avulso", "Fornecedor", "Escritório"].includes(item.cliente)) return "Cliente"
    return ehDespesa(item) ? "Despesa Escritório" : "Avulso"
  }

  function ehServicoAvulso(item) {
    return (
      ["Serviço Avulso", "Serviço do Cliente"].includes(item?.origem) ||
      String(item?.referenciaOrigem || "").startsWith("servico-avulso:")
    )
  }

  function mesmoCliente(nomeA, nomeB) {
    return String(nomeA || "").trim().toLowerCase() === String(nomeB || "").trim().toLowerCase()
  }

  const lancamentosComStatus = useMemo(
    () => lancamentos.map((item) => ({ ...item, statusCalculado: statusAutomatico(item), valorNumber: valorNumerico(item.valor) })),
    [lancamentos]
  )

  const lancamentosCompetencia = useMemo(
    () => lancamentosComStatus.filter((item) => {
      const bateCompetencia = !competencia || competenciaDoLancamento(item) === competencia
      const bateCliente = !clienteFiltro || mesmoCliente(item.cliente, clienteFiltro)
      return bateCompetencia && bateCliente
    }),
    [lancamentosComStatus, competencia, clienteFiltro]
  )

  const lancamentosAnteriores = useMemo(
    () => lancamentosComStatus.filter((item) => {
      const comp = competenciaDoLancamento(item)
      const bateCliente = !clienteFiltro || mesmoCliente(item.cliente, clienteFiltro)
      return competencia && comp && comp < competencia && bateCliente
    }),
    [lancamentosComStatus, competencia, clienteFiltro]
  )

  function calcularSaldo(lista) {
    return lista.reduce((total, item) => (ehReceita(item) ? total + item.valorNumber : ehDespesa(item) ? total - item.valorNumber : total), 0)
  }

  const totalReceitas = lancamentosCompetencia.filter(ehReceita).reduce((total, item) => total + item.valorNumber, 0)
  const totalDespesas = lancamentosCompetencia.filter(ehDespesa).reduce((total, item) => total + item.valorNumber, 0)
  const saldoAnterior = calcularSaldo(lancamentosAnteriores)
  const saldoAtual = saldoAnterior + totalReceitas - totalDespesas

  const evolucao = useMemo(() => {
    const hoje = new Date()
    const meses = []

    for (let i = 5; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
      const itensMes = lancamentosComStatus.filter((item) => {
        const bateCliente = !clienteFiltro || mesmoCliente(item.cliente, clienteFiltro)
        return competenciaDoLancamento(item) === chave && bateCliente
      })
      const receitas = itensMes.filter(ehReceita).reduce((total, item) => total + item.valorNumber, 0)
      const despesas = itensMes.filter(ehDespesa).reduce((total, item) => total + item.valorNumber, 0)

      meses.push({
        chave,
        label: data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        receitas,
        despesas,
        saldo: receitas - despesas,
      })
    }

    return meses
  }, [lancamentosComStatus, clienteFiltro])

  function escolherModo(tipo) {
    setModoLancamento(tipo)
    setEditandoId(null)
    setLinhas(Array.from({ length: LINHAS_INICIAIS }, () => linhaVazia(tipo)))
  }

  function atualizarLinha(index, campo, valor) {
    setLinhas((atuais) => atuais.map((linha, i) => (i === index ? { ...linha, [campo]: valor } : linha)))
  }

  function selecionarServico(index, nomeServico) {
    if (modoLancamento !== "Receber") return

    const servicoSelecionado = servicos.find((servico) => servico.nome === nomeServico)
    if (!servicoSelecionado) return

    setLinhas((atuais) =>
      atuais.map((linha, i) =>
        i === index
          ? {
              ...linha,
              descricao: nomeServico,
              valor: servicoSelecionado.valor || linha.valor,
              centroCusto: servicoSelecionado.categoria || linha.centroCusto,
            }
          : linha
      )
    )
  }

  function adicionarLinha() {
    setLinhas((atuais) => [...atuais, linhaVazia(modoLancamento)])
  }

  function limparLinhas() {
    setLinhas(Array.from({ length: LINHAS_INICIAIS }, () => linhaVazia(modoLancamento)))
    setEditandoId(null)
  }

  function montarPayload(linha) {
    const ehPagar = modoLancamento === "Pagar"
    const descricaoFinal = linha.descricao?.trim() || linha.centroCusto || (ehPagar ? "Despesa do Escritório" : "Receita Avulsa")

    const clienteFinal = ehPagar ? "Escritório" : linha.cliente?.trim() || "Cliente Avulso"

    return {
      descricao: descricaoFinal,
      cliente: clienteFinal,
      tipo: ehPagar ? "Pagar" : "Receber",
      centroCusto: linha.centroCusto,
      formaPagamento: linha.formaPagamento,
      valor: linha.valor,
      vencimento: linha.data,
      status: linha.status,
      dataRecebimento: linha.status === "Pago" || linha.status === "Recebido" ? linha.data : "",
      anexos: [],
      origem: ehPagar ? "Despesa Escritório" : "Avulso",
    }
  }

  function linhaPreenchida(linha) {
    return Boolean(
      linha.descricao?.trim() ||
        linha.valor?.trim() ||
        linha.centroCusto?.trim() ||
        linha.formaPagamento?.trim() ||
        linha.cliente?.trim()
    )
  }

  function linhaValida(linha) {
    if (!linha.data || !linha.centroCusto || !linha.formaPagamento || !linha.valor || !linha.status) {
      return false
    }

    if (modoLancamento === "Pagar") return true

    return Boolean(linha.descricao?.trim())
  }

  async function salvarLancamentos() {
    const preenchidas = linhas.filter(linhaPreenchida)
    const validas = preenchidas.filter(linhaValida)

    if (!validas.length || validas.length !== preenchidas.length) {
      alert(
        modoLancamento === "Pagar"
          ? "Para despesas, preencha data, centro de custo, forma, valor e status."
          : "Para receitas, preencha data, centro de custo, forma, descrição, valor e status."
      )
      return
    }

    setCarregando(true)

    try {
      if (editandoId) {
        await api.put(`/financeiro/${editandoId}`, montarPayload(validas[0]))
      } else {
        for (const linha of validas) await api.post("/financeiro", montarPayload(linha))
      }

      await carregarLancamentos()
      limparLinhas()
    } catch (error) {
      alert("Erro ao salvar lançamentos financeiros")
      console.error(error)
    } finally {
      setCarregando(false)
    }
  }

  function editarLancamento(item) {
    const tipo = ehDespesa(item) ? "Pagar" : "Receber"

    setModoLancamento(tipo)
    setEditandoId(item.id)
    setLinhas([
      {
        data: String(dataDoLancamento(item) || new Date().toISOString()).slice(0, 10),
        tipo,
        centroCusto: item.centroCusto || "",
        formaPagamento: item.formaPagamento || "",
        descricao: item.descricao || "",
        cliente: tipo === "Pagar" ? "" : item.cliente || "",
        valor: item.valor || "",
        status: item.status || (tipo === "Pagar" ? "Pago" : "Recebido"),
      },
    ])
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function marcarComoPago(item) {
    try {
      await api.put(`/financeiro/${item.id}`, {
        ...item,
        status: ehDespesa(item) ? "Pago" : "Recebido",
        dataRecebimento: new Date().toISOString().slice(0, 10),
      })
      await carregarLancamentos()
    } catch (error) {
      alert("Erro ao confirmar lançamento")
      console.error(error)
    }
  }

  async function excluirLancamento(id) {
    if (!window.confirm("Deseja realmente excluir este lançamento?")) return

    try {
      await api.delete(`/financeiro/${id}`)
      await carregarLancamentos()
    } catch (error) {
      alert("Erro ao excluir lançamento financeiro")
      console.error(error)
    }
  }

  function mudarCompetencia(direcao) {
    const [ano, mes] = competencia.split("-").map(Number)
    const data = new Date(ano, mes - 1 + direcao, 1)
    setCompetencia(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`)
  }

  function limparFiltroCliente() {
    localStorage.removeItem("nexaFiltroFinanceiroCliente")
    setClienteFiltro("")
  }

  return (
    <div style={box}>
      <div style={topo}>
        <div>
          <h2 style={tituloInterno}>Movimentação do Escritório</h2>
          <p style={subtituloInterno}>Controle de receitas, despesas, avulsos e recebimentos automáticos.</p>
        </div>

        <div style={filtroCompetencia}>
          <button style={botaoSecundario} onClick={() => mudarCompetencia(-1)}>← Anterior</button>
          <input type="month" style={inputCompetencia} value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          <button style={botaoSecundario} onClick={() => mudarCompetencia(1)}>Próximo →</button>
        </div>
      </div>

      {clienteFiltro && (
        <div style={filtroClienteAtivo}>
          <span>Financeiro filtrado para: <strong>{clienteFiltro}</strong></span>
          <button style={botaoSecundario} onClick={limparFiltroCliente}>Limpar filtro</button>
        </div>
      )}

      <div style={cards}>
        <Card title="Total de Crédito" value={formatarMoeda(totalReceitas)} cor="#37ff74" />
        <Card title="Total de Débito" value={formatarMoeda(totalDespesas)} cor="#ff5d73" />
        <Card title="Saldo Atual" value={formatarMoeda(saldoAtual)} cor={saldoAtual >= 0 ? "#37ff74" : "#ff5d73"} />
        <Card title="Saldo Anterior" value={formatarMoeda(saldoAnterior)} cor={saldoAnterior >= 0 ? "#37ff74" : "#ff5d73"} />
      </div>

      <div style={graficoBox}>
        <div style={graficoTopo}>
          <h3>Evolução Financeira</h3>
          <div style={legenda}>
            <span><b style={{ background: "#37ff74" }} /> Crédito</span>
            <span><b style={{ background: "#ff5d73" }} /> Débito</span>
            <span><b style={{ background: "#4cc9ff" }} /> Saldo</span>
          </div>
        </div>

        <GraficoLinha dados={evolucao} formatarMoeda={formatarMoeda} />
      </div>

      <div style={formBox}>
        <div style={formHeader}>
          <div>
            <h3>{editandoId ? "Corrigir Lançamento" : modoLancamento === "Pagar" ? "Nova Despesa" : "Nova Receita"}</h3>
            <p style={ajudaLancamento}>
              {modoLancamento === "Pagar"
                ? "Despesa simples: informe o centro de custo e digite o histórico, como combustível, internet ou material."
                : "Receita avulsa: informe a descrição do serviço para identificar a entrada."}
            </p>
          </div>

          <div style={acoesTopo}>
            <button style={modoLancamento === "Receber" ? botaoModoAtivoReceita : botaoModo} onClick={() => escolherModo("Receber")}>
              + Receita
            </button>
            <button style={modoLancamento === "Pagar" ? botaoModoAtivoDespesa : botaoModo} onClick={() => escolherModo("Pagar")}>
              + Despesa
            </button>
            <button style={botaoEscuro} onClick={adicionarLinha}>+ Adicionar linha</button>
            {editandoId && <button style={botaoSecundario} onClick={limparLinhas}>Cancelar edição</button>}
            <button style={button} onClick={salvarLancamentos} disabled={carregando}>
              {carregando ? "Salvando..." : editandoId ? "Salvar Correção" : "Salvar Lançamentos"}
            </button>
          </div>
        </div>

        <div style={tabelaMassaWrapper}>
          <table style={modoLancamento === "Pagar" ? tabelaMassaDespesa : tabelaMassaReceita}>
            <thead>
              <tr>
                <th style={thMassa}>Data</th>
                <th style={thMassa}>Centro de Custo</th>
                <th style={thMassa}>Forma</th>
                <th style={thMassa}>{modoLancamento === "Pagar" ? "Descrição / Histórico" : "Descrição / Serviço"}</th>
                {modoLancamento === "Receber" && <th style={thMassa}>Cliente</th>}
                <th style={thMassa}>Status</th>
                <th style={thMassa}>Valor</th>
              </tr>
            </thead>

            <tbody>
              {linhas.map((linha, index) => (
                <tr key={index}>
                  <td style={tdMassa}>
                    <input type="date" style={inputTabela} value={linha.data} onChange={(e) => atualizarLinha(index, "data", e.target.value)} />
                  </td>

                  <td style={tdMassa}>
                    <input style={inputTabela} list="centros-custo-financeiro" placeholder="Selecione ou digite" value={linha.centroCusto} onChange={(e) => atualizarLinha(index, "centroCusto", e.target.value)} />
                  </td>

                  <td style={tdMassa}>
                    <select style={inputTabela} value={linha.formaPagamento} onChange={(e) => atualizarLinha(index, "formaPagamento", e.target.value)}>
                      <option value="">Selecione</option>
                      {formasPagamento.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </td>

                  <td style={tdMassa}>
                    {modoLancamento === "Receber" ? (
                      <input style={inputTabela} list="servicos-financeiro" placeholder="Ex: abertura MEI, honorários..." value={linha.descricao} onChange={(e) => { atualizarLinha(index, "descricao", e.target.value); selecionarServico(index, e.target.value) }} />
                    ) : (
                      <input style={inputTabela} placeholder="Ex: combustível, internet, estacionamento..." value={linha.descricao} onChange={(e) => atualizarLinha(index, "descricao", e.target.value)} />
                    )}
                  </td>

                  {modoLancamento === "Receber" && (
                    <td style={tdMassa}>
                      <input style={inputTabela} list="clientes-financeiro" placeholder="Opcional" value={linha.cliente} onChange={(e) => atualizarLinha(index, "cliente", e.target.value)} />
                    </td>
                  )}

                  <td style={tdMassa}>
                    <select style={inputTabela} value={linha.status} onChange={(e) => atualizarLinha(index, "status", e.target.value)}>
                      {modoLancamento === "Receber" ? <option value="Recebido">Recebido</option> : <option value="Pago">Pago</option>}
                      <option value="Pendente">Pendente</option>
                      <option value="Atrasado">Atrasado</option>
                    </select>
                  </td>

                  <td style={tdMassa}>
                    <input style={{ ...inputTabela, textAlign: "right" }} placeholder="0,00" value={linha.valor} onChange={(e) => atualizarLinha(index, "valor", e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <datalist id="centros-custo-financeiro">{centrosCustoPadrao.map((item) => <option key={item} value={item} />)}</datalist>
        <datalist id="clientes-financeiro">{clientesCadastrados.map((item) => <option key={item.id} value={item.nome} />)}</datalist>
        <datalist id="servicos-financeiro">{servicos.map((item) => <option key={item.id} value={item.nome} />)}</datalist>
      </div>

      <div style={historicoBox}>
        <h3>Histórico Financeiro</h3>

        <div style={tabelaHistoricoWrapper}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Data</th>
                <th style={th}>Tipo</th>
                <th style={th}>Plano/Centro</th>
                <th style={th}>Descrição</th>
                <th style={th}>Cliente / Fornecedor</th>
                <th style={th}>Forma</th>
                <th style={th}>Origem</th>
                <th style={th}>Valor</th>
                <th style={th}>Status</th>
                <th style={th}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {lancamentosCompetencia.length === 0 && <tr><td style={tdVazio} colSpan="10">Nenhum lançamento nesta competência.</td></tr>}

              {lancamentosCompetencia.map((item) => (
                <tr key={item.id}>
                  <td style={td}>{formatarData(dataDoLancamento(item))}</td>
                  <td style={td}><span style={tipoBadge(ehReceita(item) ? "Receita" : "Despesa")}>{ehReceita(item) ? "Receita" : "Despesa"}</span></td>
                  <td style={td}>{item.centroCusto || "-"}</td>
                  <td style={td}>{item.descricao}</td>
                  <td style={td}>{item.cliente || "-"}</td>
                  <td style={td}>{item.formaPagamento || "-"}</td>
                  <td style={td}>{origemDoLancamento(item)}</td>
                  <td style={tdValor(ehReceita(item))}>{formatarMoeda(item.valorNumber)}</td>
                  <td style={td}><span style={badgeStatus(item.statusCalculado)}>{item.statusCalculado}</span></td>
                  <td style={td}>
                    {ehServicoAvulso(item) ? (
                      <span style={automaticBadge}>Automático</span>
                    ) : (
                      <div style={actions}>
                        {item.statusCalculado !== "Recebido" && item.statusCalculado !== "Pago" && <button style={receiveButton} onClick={() => marcarComoPago(item)}>Confirmar</button>}
                        <button style={editButton} onClick={() => editarLancamento(item)}>Corrigir</button>
                        <button style={deleteButton} onClick={() => excluirLancamento(item.id)}>Excluir</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Card({ title, value, cor }) {
  return <div style={card}><span style={cardTitle}>{title}</span><strong style={{ ...cardValue, color: cor || "white" }}>{value}</strong></div>
}

function GraficoLinha({ dados, formatarMoeda }) {
  const largura = 820
  const altura = 260
  const padding = 34
  const maximo = Math.max(1, ...dados.flatMap((item) => [Math.abs(item.receitas), Math.abs(item.despesas), Math.abs(item.saldo)]))

  function ponto(valor, index) {
    const x = padding + (index * (largura - padding * 2)) / Math.max(dados.length - 1, 1)
    const y = altura - padding - (Math.abs(valor) / maximo) * (altura - padding * 2)
    return { x, y }
  }

  function linha(campo) {
    return dados.map((item, index) => {
      const { x, y } = ponto(item[campo], index)
      return `${x},${y}`
    }).join(" ")
  }

  return (
    <div style={graficoScroll}>
      <svg width={largura} height={altura} style={svgGrafico}>
        <polyline points={linha("receitas")} fill="none" stroke="#37ff74" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={linha("despesas")} fill="none" stroke="#ff5d73" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={linha("saldo")} fill="none" stroke="#4cc9ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {dados.map((item, index) => {
          const pReceita = ponto(item.receitas, index)
          const pDespesa = ponto(item.despesas, index)
          const pSaldo = ponto(item.saldo, index)

          return (
            <g key={item.chave}>
              <circle cx={pReceita.x} cy={pReceita.y} r="5" fill="#37ff74" />
              <circle cx={pDespesa.x} cy={pDespesa.y} r="5" fill="#ff5d73" />
              <circle cx={pSaldo.x} cy={pSaldo.y} r="5" fill="#4cc9ff" />
              <text x={pSaldo.x} y={altura - 8} textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="700">{item.label}</text>
              <title>{`${item.chave}\nCrédito: ${formatarMoeda(item.receitas)}\nDébito: ${formatarMoeda(item.despesas)}\nSaldo: ${formatarMoeda(item.saldo)}`}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function badgeStatus(status) {
  const base = { padding: "7px 12px", borderRadius: "999px", fontWeight: "bold", fontSize: "13px", display: "inline-block" }
  if (status === "Recebido" || status === "Pago") return { ...base, background: "rgba(55,255,116,.16)", color: "#37ff74" }
  if (status === "Atrasado") return { ...base, background: "rgba(255,77,79,.18)", color: "#ff7072" }
  return { ...base, background: "rgba(0,168,255,.18)", color: "#00a8ff" }
}

function tipoBadge(tipo) {
  const receita = tipo === "Receita"
  return { padding: "7px 12px", borderRadius: "999px", fontWeight: "bold", fontSize: "13px", display: "inline-block", background: receita ? "rgba(55,255,116,.14)" : "rgba(255,77,79,.16)", color: receita ? "#37ff74" : "#ff7072" }
}

function tdValor(receita) {
  return { ...td, color: receita ? "#37ff74" : "#ff7072", fontWeight: "bold", textAlign: "right" }
}

const box = { background: "rgba(255,255,255,0.06)", borderRadius: "24px", padding: "28px", overflowX: "hidden" }
const topo = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", flexWrap: "wrap", marginBottom: "24px" }
const tituloInterno = { margin: 0, fontSize: "32px", color: "white" }
const subtituloInterno = { margin: "6px 0 0", color: "#c4d4ea" }
const filtroCompetencia = { display: "flex", gap: "10px", flexWrap: "wrap" }
const inputCompetencia = { padding: "13px", borderRadius: "12px", border: "1px solid rgba(255,255,255,.2)", background: "#061f47", color: "white", fontSize: "15px" }
const cards = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "25px" }
const card = { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: "16px", padding: "20px" }
const cardTitle = { display: "block", color: "#a9b8cc", marginBottom: "10px" }
const cardValue = { fontSize: "24px" }
const graficoBox = { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: "18px", padding: "22px", marginBottom: "28px" }
const graficoTopo = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }
const legenda = { display: "flex", gap: "16px", color: "white", fontWeight: "bold", flexWrap: "wrap" }
const graficoScroll = { width: "100%", overflowX: "auto" }
const svgGrafico = { minWidth: "760px", marginTop: "10px" }
const formBox = { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: "18px", padding: "22px", marginBottom: "28px" }
const formHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }
const ajudaLancamento = { margin: "6px 0 0", color: "#a9b8cc", fontSize: "14px" }
const acoesTopo = { display: "flex", gap: "12px", flexWrap: "wrap" }
const tabelaMassaWrapper = { overflowX: "auto" }
const tabelaMassaReceita = { width: "100%", minWidth: "1120px", borderCollapse: "collapse" }
const tabelaMassaDespesa = { width: "100%", minWidth: "980px", borderCollapse: "collapse" }
const thMassa = { textAlign: "left", padding: "12px", background: "#051b3d", color: "#4cc9ff" }
const tdMassa = { padding: "8px" }
const inputTabela = { width: "100%", boxSizing: "border-box", padding: "13px", borderRadius: "10px", border: "1px solid rgba(255,255,255,.14)", background: "#092b5d", color: "white", fontSize: "14px" }
const automaticBadge = { display: "inline-block", padding: "8px 11px", borderRadius: "999px", background: "rgba(55,255,116,.12)", color: "#37ff74", fontWeight: "800", fontSize: "12px" }
const historicoBox = { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: "18px", padding: "22px" }
const tabelaHistoricoWrapper = { overflowX: "auto" }
const table = { width: "100%", minWidth: "1300px", borderCollapse: "collapse" }
const th = { textAlign: "left", padding: "16px", color: "#a9b8cc", borderBottom: "1px solid rgba(255,255,255,.12)" }
const td = { padding: "16px", borderBottom: "1px solid rgba(255,255,255,.06)" }
const tdVazio = { ...td, textAlign: "center", color: "#a9b8cc" }
const actions = { display: "flex", gap: "10px", flexWrap: "wrap" }
const button = { padding: "13px 18px", borderRadius: "12px", border: "none", background: "linear-gradient(90deg, #00a8ff, #37ff74)", color: "#00112b", fontWeight: "bold", cursor: "pointer" }
const botaoEscuro = { padding: "13px 18px", borderRadius: "12px", border: "1px solid rgba(255,255,255,.15)", background: "#061f47", color: "white", fontWeight: "bold", cursor: "pointer" }
const botaoSecundario = { padding: "13px 18px", borderRadius: "12px", border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.08)", color: "white", fontWeight: "bold", cursor: "pointer" }
const botaoModo = { padding: "13px 18px", borderRadius: "12px", border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.08)", color: "white", fontWeight: "bold", cursor: "pointer" }
const botaoModoAtivoReceita = { ...botaoModo, background: "linear-gradient(90deg, #00a8ff, #37ff74)", color: "#00112b", border: "none" }
const botaoModoAtivoDespesa = { ...botaoModo, background: "linear-gradient(90deg, #ff4d4f, #ff9f43)", color: "#00112b", border: "none" }
const receiveButton = { padding: "10px 14px", borderRadius: "10px", border: "none", background: "#37ff74", color: "#00112b", fontWeight: "bold", cursor: "pointer" }
const editButton = { padding: "10px 14px", borderRadius: "10px", border: "none", background: "#00a8ff", color: "white", fontWeight: "bold", cursor: "pointer" }
const deleteButton = { padding: "10px 14px", borderRadius: "10px", border: "none", background: "#ff4d4f", color: "white", fontWeight: "bold", cursor: "pointer" }


const filtroClienteAtivo = { background: "rgba(0,168,255,.10)", border: "1px solid rgba(0,168,255,.20)", borderRadius: "14px", padding: "14px", marginBottom: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", color: "white" }
