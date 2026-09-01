import { useEffect, useMemo, useRef, useState } from "react"
import api from "../services/api"

const vazio = {
  bancoCodigo: "",
  bancoNome: "",
  agencia: "",
  conta: "",
  digito: "",
  tipoConta: "Conta corrente",
  moeda: "BRL",
  saldoInicial: "",
  dataSaldoInicial: "",
  principal: false,
  ativo: true,
  observacoes: "",
}

export default function ConciliacaoBancaria({ setPage }) {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState(localStorage.getItem("nexaConciliacaoClienteId") || "")
  const [contas, setContas] = useState([])
  const [form, setForm] = useState(vazio)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [contaExtratoId, setContaExtratoId] = useState("")
  const [arquivo, setArquivo] = useState(null)
  const [movimentos, setMovimentos] = useState([])
  const [movimentosCliente, setMovimentosCliente] = useState([])
  const [importacoes, setImportacoes] = useState([])
  const [importando, setImportando] = useState(false)
  const [resumoImportacao, setResumoImportacao] = useState(null)
  const [planoContas, setPlanoContas] = useState([])
  const [classificacoes, setClassificacoes] = useState({})
  const [selecionados, setSelecionados] = useState([])
  const [planoLoteId, setPlanoLoteId] = useState("")
  const [filtroStatus, setFiltroStatus] = useState("Todos")
  const [filtroConferencia, setFiltroConferencia] = useState("Todos")
  const [processando, setProcessando] = useState(false)
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [fechamentos, setFechamentos] = useState([])
  const periodoAutomaticoAplicadoRef = useRef("")

  useEffect(() => {
    api.get("/clientes").then(r => setClientes(r.data || [])).catch(() => setClientes([]))
    api.get("/plano-contas").then(r => setPlanoContas(r.data || [])).catch(() => setPlanoContas([]))
  }, [])

  useEffect(() => {
    if (!clienteId) {
      setContas([])
      setMovimentosCliente([])
      return
    }
    localStorage.setItem("nexaConciliacaoClienteId", String(clienteId))
    carregar()
  }, [clienteId])

  useEffect(() => {
    if (contaExtratoId) carregarExtratos()
    else {
      setMovimentos([])
      setImportacoes([])
      setFechamentos([])
      setMovimentosCliente([])
    }
  }, [contaExtratoId, competencia])

  useEffect(() => {
    periodoAutomaticoAplicadoRef.current = ""
  }, [contaExtratoId])

  async function carregar() {
    try {
      const r = await api.get("/contas-bancarias-clientes", { params: { clienteId } })
      const lista = r.data || []
      setContas(lista)
      setContaExtratoId(atual =>
        lista.some(c => String(c.id) === String(atual))
          ? atual
          : String(lista.find(c => c.principal && c.ativo)?.id || lista.find(c => c.ativo)?.id || "")
      )
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao carregar contas bancárias")
    }
  }

  const cliente = useMemo(
    () => clientes.find(c => String(c.id) === String(clienteId)),
    [clientes, clienteId]
  )

  const alterar = (campo, valor) => setForm(atual => ({ ...atual, [campo]: valor }))
  function limpar() { setForm(vazio); setEditandoId(null) }

  function editar(item) {
    setEditandoId(item.id)
    setForm({
      ...vazio,
      ...item,
      saldoInicial: moedaCampo(item.saldoInicial),
      dataSaldoInicial: item.dataSaldoInicial || "",
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function salvar(e) {
    e.preventDefault()
    if (!clienteId) return alert("Selecione a empresa")
    setSalvando(true)
    try {
      const corpo = { ...form, clienteId, saldoInicial: numeroMoeda(form.saldoInicial) }
      if (editandoId) await api.put(`/contas-bancarias-clientes/${editandoId}`, corpo)
      else await api.post("/contas-bancarias-clientes", corpo)
      limpar()
      await carregar()
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao salvar conta bancária")
    } finally {
      setSalvando(false)
    }
  }

  async function alternar(item) {
    try {
      await api.patch(`/contas-bancarias-clientes/${item.id}/status`, { ativo: !item.ativo })
      await carregar()
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao alterar situação")
    }
  }

  async function carregarExtratos() {
    try {
      const semCache = Date.now()
      const [ano, mes] = competencia.split("-").map(Number)
      const fim = `${competencia}-${String(new Date(ano, mes, 0).getDate()).padStart(2, "0")}`

      const [m, i, f, mc] = await Promise.all([
        api.get("/extratos-bancarios/movimentos", {
          params: {
            contaBancariaId: contaExtratoId,
            inicio: `${competencia}-01`,
            fim,
            _t: semCache,
          },
        }),
        api.get("/extratos-bancarios/importacoes", {
          params: { contaBancariaId: contaExtratoId, _t: semCache },
        }),
        api.get("/extratos-bancarios/fechamentos", {
          params: { contaBancariaId: contaExtratoId, _t: semCache },
        }),
        api.get("/movimentos-cliente", {
          params: { clienteId, _t: semCache },
        }),
      ])

      const lista = m.data || []
      const listaImportacoes = Array.isArray(i.data) ? i.data : []
      setMovimentos(lista)
      setImportacoes(listaImportacoes)
      setFechamentos(f.data || [])
      setMovimentosCliente(Array.isArray(mc.data) ? mc.data : [])
      setClassificacoes(Object.fromEntries(lista.map(item => [item.id, item.planoContaId || ""])))
      setSelecionados(atual => atual.filter(id => lista.some(item => item.id === id)))

      const ultimaImportacao = listaImportacoes[0]
      const competenciaImportada = String(ultimaImportacao?.dataFim || ultimaImportacao?.dataInicio || "").slice(0, 7)
      const chaveAuto = `${contaExtratoId}|${competenciaImportada}`
      if (
        lista.length === 0 &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(competenciaImportada) &&
        competenciaImportada !== competencia &&
        periodoAutomaticoAplicadoRef.current !== chaveAuto
      ) {
        periodoAutomaticoAplicadoRef.current = chaveAuto
        setCompetencia(competenciaImportada)
      }
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao carregar extratos")
    }
  }

  async function importarExtrato(e) {
    e.preventDefault()
    if (!contaExtratoId) return alert("Selecione a conta bancária")
    if (!arquivo) return alert("Selecione um arquivo OFX ou CSV")

    const dados = new FormData()
    dados.append("contaBancariaId", contaExtratoId)
    dados.append("arquivo", arquivo)

    setImportando(true)
    setResumoImportacao(null)

    try {
      const r = await api.post("/extratos-bancarios/importar", dados, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      const importacaoRetornada = r.data?.importacao || {}
      const resumo = {
        ...(r.data?.resumo || {}),
        dataInicio: importacaoRetornada.dataInicio || r.data?.resumo?.dataInicio || null,
        dataFim: importacaoRetornada.dataFim || r.data?.resumo?.dataFim || null,
      }
      setResumoImportacao(resumo)
      setArquivo(null)
      const inputArquivo = document.getElementById("nexa-arquivo-extrato")
      if (inputArquivo) inputArquivo.value = ""

      const competenciaImportada = String(resumo.dataFim || resumo.dataInicio || "").slice(0, 7)
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(competenciaImportada) && competenciaImportada !== competencia) {
        periodoAutomaticoAplicadoRef.current = `${contaExtratoId}|${competenciaImportada}`
        setCompetencia(competenciaImportada)
      } else {
        await carregarExtratos()
      }
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao importar extrato")
    } finally {
      setImportando(false)
    }
  }

  const analiseConciliacao = useMemo(() => {
    const resultado = {}

    const movimentosBancoElegiveis = movimentos.filter(m => !m.lancamentoContabilId)
    const movimentosClienteBancarios = movimentosCliente.filter(movimentoClienteEhBancario)

    function chaveExataBanco(movimento) {
      const naturezaEsperada = movimento.natureza === "Entrada" ? "Receita" : "Despesa"
      return `${naturezaEsperada}|${dataIso(movimento.data)}|${valorComparavel(movimento.valor).toFixed(2)}`
    }

    function chaveExataCliente(item) {
      return `${String(item.tipo || "")}|${dataIso(item.data)}|${valorComparavel(item.valor).toFixed(2)}`
    }

    const gruposBanco = new Map()
    movimentosBancoElegiveis.forEach(movimento => {
      const chave = chaveExataBanco(movimento)
      const lista = gruposBanco.get(chave) || []
      lista.push(movimento)
      gruposBanco.set(chave, lista)
    })

    const gruposCliente = new Map()
    movimentosClienteBancarios.forEach(item => {
      const chave = chaveExataCliente(item)
      const lista = gruposCliente.get(chave) || []
      lista.push(item)
      gruposCliente.set(chave, lista)
    })

    gruposBanco.forEach(lista => lista.sort((a, b) => Number(a.id || 0) - Number(b.id || 0)))
    gruposCliente.forEach(lista => lista.sort((a, b) => Number(a.id || 0) - Number(b.id || 0)))

    movimentos.forEach(movimento => {
      const naturezaEsperada = movimento.natureza === "Entrada" ? "Receita" : "Despesa"
      const valorBanco = valorComparavel(movimento.valor)
      const dataBanco = dataIso(movimento.data)

      if (
        movimento.statusConciliacao === "Conciliado" &&
        String(movimento.observacoes || "").startsWith("Nexa Auto •")
      ) {
        const agrupado = String(movimento.observacoes || "").includes("agrupamento diário")
        resultado[movimento.id] = {
          status: "BATENDO",
          titulo: agrupado ? "Conciliado por total diário" : "Conciliado automaticamente",
          detalhe: agrupado
            ? "O total bancário do dia bateu com o total dos lançamentos bancários do cliente."
            : "Mesma data, natureza e valor em Movimentos Clientes.",
        }
        return
      }

      if (movimento.lancamentoContabilId) {
        resultado[movimento.id] = {
          status: "DIVERGENCIA",
          titulo: "Revisar possível duplicidade",
          detalhe: `Já existe lançamento #${movimento.lancamentoContabilId} gerado por esta conciliação.`,
        }
        return
      }

      const chave = chaveExataBanco(movimento)
      const bancoMesmoGrupo = gruposBanco.get(chave) || []
      const clientesMesmoGrupo = gruposCliente.get(chave) || []
      const indiceBanco = bancoMesmoGrupo.findIndex(item => String(item.id) === String(movimento.id))

      // 1 banco ↔ 1 cliente ou quantidades iguais (ex.: 2 ↔ 2): pareamento seguro 1 a 1.
      if (clientesMesmoGrupo.length > 0 && bancoMesmoGrupo.length === clientesMesmoGrupo.length) {
        const pareado = clientesMesmoGrupo[indiceBanco] || clientesMesmoGrupo[0]
        resultado[movimento.id] = {
          status: "BATENDO",
          titulo: bancoMesmoGrupo.length > 1 ? "Pareamento 1↔1 confirmado" : "Bateu com Movimentos Clientes",
          detalhe: bancoMesmoGrupo.length > 1
            ? `${bancoMesmoGrupo.length} movimentos no banco e ${clientesMesmoGrupo.length} lançamentos do cliente com mesma data, natureza e valor. Pareado item ${indiceBanco + 1} de ${bancoMesmoGrupo.length}.`
            : `${naturezaEsperada} de ${moeda(pareado.valor)} em ${dataBr(pareado.data)}.`,
        }
        return
      }

      // Há mais movimentos bancários do que lançamentos do cliente:
      // pareia os primeiros N e deixa o excedente amarelo.
      if (clientesMesmoGrupo.length > 0 && bancoMesmoGrupo.length > clientesMesmoGrupo.length) {
        if (indiceBanco >= 0 && indiceBanco < clientesMesmoGrupo.length) {
          const pareado = clientesMesmoGrupo[indiceBanco]
          resultado[movimento.id] = {
            status: "BATENDO",
            titulo: "Pareamento 1↔1 confirmado",
            detalhe: `Há ${bancoMesmoGrupo.length} movimentos bancários e ${clientesMesmoGrupo.length} lançamento(ões) do cliente neste grupo. Este item foi pareado com ${moeda(pareado.valor)} em ${dataBr(pareado.data)}.`,
          }
        } else {
          resultado[movimento.id] = {
            status: "FALTANDO",
            titulo: "Movimento excedente no extrato",
            detalhe: `Há ${bancoMesmoGrupo.length} movimentos bancários, mas apenas ${clientesMesmoGrupo.length} lançamento(ões) do cliente com a mesma data e valor.`,
          }
        }
        return
      }

      // Há mais lançamentos do cliente que movimentos no banco:
      // possível lançamento manual duplicado, manter vermelho para revisão.
      if (clientesMesmoGrupo.length > bancoMesmoGrupo.length) {
        resultado[movimento.id] = {
          status: "DIVERGENCIA",
          titulo: "Mais lançamentos do cliente que no banco",
          detalhe: `${clientesMesmoGrupo.length} lançamentos do cliente para ${bancoMesmoGrupo.length} movimento(s) bancário(s) com a mesma data e valor. Revise possível duplicidade manual.`,
        }
        return
      }

      const candidatosTipo = movimentosClienteBancarios.filter(item =>
        String(item.tipo || "") === naturezaEsperada
      )

      const proximos = candidatosTipo.filter(item => {
        const valorIgual = Math.abs(valorComparavel(item.valor) - valorBanco) <= 0.01
        const distancia = diferencaDias(dataIso(item.data), dataBanco)
        return valorIgual && distancia !== null && distancia <= 3
      })

      if (proximos.length > 0) {
        resultado[movimento.id] = {
          status: "REVISAR",
          titulo: "Possível correspondência",
          detalhe: "Existe lançamento com o mesmo valor em até 3 dias de diferença. Revise a data de compensação.",
        }
        return
      }

      const descricao = String(movimento.descricao || "").toLowerCase()
      const pareceCartao = /cart[aã]o|stone|cielo|rede|pagseguro|mercado pago|sumup|getnet|maquininha/.test(descricao)

      resultado[movimento.id] = {
        status: "FALTANDO",
        titulo: pareceCartao ? "Revisar agrupamento/taxa" : "Sem lançamento correspondente",
        detalhe: pareceCartao
          ? "O crédito pode reunir várias vendas ou ter desconto de taxa. Nenhum lançamento será criado automaticamente."
          : "Não foi encontrado lançamento do cliente com a mesma natureza, data e valor.",
      }
    })

    return resultado
  }, [movimentos, movimentosCliente])

  const resumoMovimentos = useMemo(() => movimentos.reduce((r, m) => {
    const valor = Number(m.valor || 0)
    if (m.natureza === "Entrada") r.entradas += valor
    else r.saidas += valor
    return r
  }, { entradas: 0, saidas: 0 }), [movimentos])

  const movimentosClienteBancariosCompetencia = useMemo(
    () => movimentosCliente.filter(item =>
      movimentoClienteEhBancario(item) &&
      dataIso(item.data).startsWith(`${competencia}-`)
    ),
    [movimentosCliente, competencia]
  )

  const resumoClienteBancos = useMemo(
    () => movimentosClienteBancariosCompetencia.reduce((r, item) => {
      const valor = Number(item.valor || 0)
      if (item.tipo === "Receita") r.receitas += valor
      else if (item.tipo === "Despesa") r.despesas += valor
      return r
    }, { receitas: 0, despesas: 0 }),
    [movimentosClienteBancariosCompetencia]
  )

  const diferencaEntradas = resumoMovimentos.entradas - resumoClienteBancos.receitas
  const diferencaSaidas = resumoMovimentos.saidas - resumoClienteBancos.despesas
  const totaisBatem =
    Math.abs(diferencaEntradas) < 0.01 &&
    Math.abs(diferencaSaidas) < 0.01

  const resumoConferencia = useMemo(() => movimentos.reduce((r, movimento) => {
    const status = analiseConciliacao[movimento.id]?.status
    if (status === "BATENDO") r.batendo += 1
    else if (status === "FALTANDO") r.faltando += 1
    else if (status === "REVISAR") r.revisar += 1
    else if (status === "DIVERGENCIA") r.divergencias += 1
    return r
  }, { batendo: 0, faltando: 0, revisar: 0, divergencias: 0 }), [movimentos, analiseConciliacao])

  const movimentosVisiveis = useMemo(() => {
    let lista = movimentos

    if (filtroStatus === "A concluir") {
      lista = lista.filter(m => {
        if (m.statusConciliacao === "Ignorado") return false
        return analiseConciliacao[m.id]?.status !== "BATENDO" || m.statusConciliacao !== "Conciliado"
      })
    } else if (filtroStatus !== "Todos") {
      lista = lista.filter(m => m.statusConciliacao === filtroStatus)
    }

    if (filtroConferencia !== "Todos") {
      lista = lista.filter(m => analiseConciliacao[m.id]?.status === filtroConferencia)
    }

    return lista
  }, [movimentos, filtroStatus, filtroConferencia, analiseConciliacao])

  const fechamentoAtual = useMemo(
    () => fechamentos.find(f => f.competencia === competencia && f.status === "Fechado"),
    [fechamentos, competencia]
  )

  const faltamConcluir = useMemo(() => movimentos.filter(m => {
    if (m.statusConciliacao === "Ignorado") return false
    return analiseConciliacao[m.id]?.status !== "BATENDO" || m.statusConciliacao !== "Conciliado"
  }).length, [movimentos, analiseConciliacao])

  const planosPara = natureza => planoContas.filter(p => naturezaCompativel(p, natureza))

  function naturezaCompativel(plano, natureza) {
    const texto = `${plano?.natureza || ""} ${plano?.tipo || ""} ${plano?.conta || ""}`.toLowerCase()
    return natureza === "Entrada"
      ? texto.includes("credor") || texto.includes("receita") || texto.includes("fatur")
      : texto.includes("devedor") || texto.includes("despesa") || texto.includes("custo") || texto.includes("taxa") || texto.includes("imposto")
  }

  function alternarSelecao(id) {
    setSelecionados(atual => atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id])
  }

  function selecionarVisiveis() {
    setSelecionados(movimentosVisiveis.filter(m => !m.lancamentoContabilId).map(m => m.id))
  }

  async function conciliarAutomaticamente() {
    if (!contaExtratoId) return alert("Selecione uma conta bancária.")

    setProcessando(true)
    try {
      const r = await api.post("/extratos-bancarios/movimentos/conciliar-automatico", {
        contaBancariaId: contaExtratoId,
        competencia,
      })

      await carregarExtratos()
      setFiltroStatus("A concluir")
      setFiltroConferencia("Todos")
      setSelecionados([])

      const dados = r.data || {}
      alert(
        `Conferência automática concluída.\n\n` +
        `${dados.exatos || 0} por correspondência exata • ` +
        `${dados.agrupados || 0} por total diário.\n` +
        `Agora a Nexa mostra somente o que realmente precisa de atenção.`
      )
    } catch (e) {
      alert(e.response?.data?.message || "Erro na conciliação automática")
    } finally {
      setProcessando(false)
    }
  }

  async function classificarUm(movimento, status) {
    const planoContaId = classificacoes[movimento.id]

    if (status === "Conciliado" && analiseConciliacao[movimento.id]?.status !== "BATENDO") {
      return alert("Este movimento ainda não bate com um lançamento único em Movimentos Clientes. Corrija ou lance o movimento do cliente e depois clique em Atualizar conferência.")
    }

    if (status === "Classificado" && !planoContaId) {
      return alert("Selecione a conta contábil deste movimento")
    }

    setProcessando(true)
    try {
      await api.patch(`/extratos-bancarios/movimentos/${movimento.id}`, {
        planoContaId,
        statusConciliacao: status,
      })
      await carregarExtratos()
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao classificar movimento")
    } finally {
      setProcessando(false)
    }
  }

  async function classificarLote(status) {
    if (!selecionados.length) return alert("Selecione os movimentos")

    if (status === "Conciliado") {
      const naoBatendo = selecionados.filter(id => analiseConciliacao[id]?.status !== "BATENDO")
      if (naoBatendo.length) {
        return alert(`${naoBatendo.length} movimento(s) selecionado(s) ainda não batem com Movimentos Clientes. Somente linhas verdes podem ser conciliadas.`)
      }
    }

    if (status === "Classificado" && !planoLoteId) {
      return alert("Selecione uma conta contábil para o lote")
    }

    setProcessando(true)
    try {
      const r = await api.post("/extratos-bancarios/movimentos/classificar-lote", {
        ids: selecionados,
        planoContaId: planoLoteId || null,
        statusConciliacao: status,
      })
      setSelecionados([])
      await carregarExtratos()
      alert(`${r.data.atualizados} movimento(s) atualizado(s).`)
    } catch (e) {
      alert(e.response?.data?.message || "Erro na classificação em lote")
    } finally {
      setProcessando(false)
    }
  }

  async function sugerirClassificacoes() {
    setProcessando(true)
    try {
      const r = await api.post("/extratos-bancarios/movimentos/sugerir", {
        contaBancariaId: contaExtratoId,
      })
      await carregarExtratos()
      alert(`${r.data.sugeridos} classificação(ões) sugerida(s) pelo histórico.`)
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao sugerir classificações")
    } finally {
      setProcessando(false)
    }
  }

  async function concluirMes() {
    if (faltamConcluir) {
      setFiltroStatus("A concluir")
      return
    }
    if (!movimentos.length) return alert("Não existem movimentos nesta competência.")
    if (!confirm(`Concluir a competência ${competenciaBr(competencia)}?`)) return

    setProcessando(true)
    try {
      await api.post("/extratos-bancarios/fechamentos", {
        contaBancariaId: contaExtratoId,
        competencia,
      })
      await carregarExtratos()
      alert("Mês concluído com sucesso.")
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao concluir o mês")
    } finally {
      setProcessando(false)
    }
  }

  async function reabrirMes(item) {
    if (!confirm(`Reabrir a competência ${competenciaBr(item.competencia)}?`)) return
    setProcessando(true)
    try {
      await api.patch(`/extratos-bancarios/fechamentos/${item.id}/reabrir`)
      await carregarExtratos()
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao reabrir o mês")
    } finally {
      setProcessando(false)
    }
  }

  async function baixarRelatorio(item) {
    try {
      const r = await api.get(`/extratos-bancarios/fechamentos/${item.id}/pdf`, {
        responseType: "blob",
      })
      const url = URL.createObjectURL(r.data)
      const link = document.createElement("a")
      link.href = url
      link.download = `conciliacao-${item.competencia}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao baixar relatório")
    }
  }

  function voltarEmpresa() {
    if (!clienteId) return
    localStorage.setItem("nexaAbrirClienteId", String(clienteId))
    setPage?.("Clientes")
  }

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div>
          <span style={s.badge}>Contábil</span>
          <h2 style={s.h2}>Conciliação Bancária</h2>
          <p style={s.p}>Conferência do extrato bancário contra os lançamentos já feitos pelo cliente, sem criar lançamentos automaticamente.</p>
        </div>
        {clienteId && (
          <button style={s.home} title="Voltar para a empresa" aria-label="Voltar para a empresa" onClick={voltarEmpresa}>🏠</button>
        )}
      </div>

      <div style={s.card}>
        <label style={s.label}>Empresa
          <select style={s.input} value={clienteId} onChange={e => { setClienteId(e.target.value); limpar() }}>
            <option value="">Selecione a empresa</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>

      {clienteId && <>
        <form style={s.card} onSubmit={salvar}>
          <div style={s.titleRow}>
            <div>
              <h3 style={s.h3}>{editandoId ? "Corrigir conta bancária" : "Cadastrar conta bancária"}</h3>
              <p style={s.p}>Empresa: <strong>{cliente?.nome || "-"}</strong></p>
            </div>
            {editandoId && <button type="button" style={s.secondary} onClick={limpar}>Cancelar edição</button>}
          </div>

          <div style={s.grid}>
            <Campo t="Código do banco"><input style={s.input} value={form.bancoCodigo} onChange={e => alterar("bancoCodigo", e.target.value)} placeholder="Ex.: 001" /></Campo>
            <Campo t="Banco *"><input style={s.input} value={form.bancoNome} onChange={e => alterar("bancoNome", e.target.value)} placeholder="Ex.: Banco do Brasil" required /></Campo>
            <Campo t="Agência *"><input style={s.input} value={form.agencia} onChange={e => alterar("agencia", e.target.value)} required /></Campo>
            <Campo t="Conta *"><input style={s.input} value={form.conta} onChange={e => alterar("conta", e.target.value)} required /></Campo>
            <Campo t="Dígito"><input style={s.input} value={form.digito || ""} onChange={e => alterar("digito", e.target.value)} /></Campo>
            <Campo t="Tipo de conta">
              <select style={s.input} value={form.tipoConta} onChange={e => alterar("tipoConta", e.target.value)}>
                <option>Conta corrente</option><option>Conta poupança</option><option>Conta pagamento</option><option>Investimentos</option><option>Caixa interno</option>
              </select>
            </Campo>
            <Campo t="Saldo inicial"><input inputMode="numeric" style={s.input} value={form.saldoInicial} onChange={e => alterar("saldoInicial", formatarMoedaDigitada(e.target.value))} placeholder="R$ 0,00" /></Campo>
            <Campo t="Data-base do saldo"><input type="date" style={s.input} value={form.dataSaldoInicial} onChange={e => alterar("dataSaldoInicial", e.target.value)} /></Campo>
          </div>

          <label style={s.check}><input type="checkbox" checked={form.principal} onChange={e => alterar("principal", e.target.checked)} /> Definir como conta principal da empresa</label>
          <Campo t="Observações"><textarea style={{ ...s.input, minHeight: 80 }} value={form.observacoes || ""} onChange={e => alterar("observacoes", e.target.value)} /></Campo>
          <button style={s.primary} disabled={salvando}>{salvando ? "Salvando..." : editandoId ? "Salvar correção" : "Cadastrar conta"}</button>
        </form>

        <div style={s.card}>
          <div style={s.titleRow}>
            <div><h3 style={s.h3}>Contas da empresa</h3><p style={s.p}>{contas.length} conta(s) cadastrada(s).</p></div>
            <span style={s.next}>Importação OFX e CSV disponível</span>
          </div>

          {contas.length === 0 ? (
            <div style={s.empty}>Nenhuma conta bancária cadastrada.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead><tr><th>Banco</th><th>Agência</th><th>Conta</th><th>Tipo</th><th>Saldo inicial</th><th>Situação</th><th>Ações</th></tr></thead>
                <tbody>{contas.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.bancoCodigo ? `${item.bancoCodigo} • ` : ""}{item.bancoNome}</strong>{item.principal && <span style={s.principal}>Principal</span>}</td>
                    <td>{item.agencia}</td>
                    <td>{item.conta}{item.digito ? `-${item.digito}` : ""}</td>
                    <td>{item.tipoConta}</td>
                    <td>{moeda(item.saldoInicial)}</td>
                    <td>{item.ativo ? "Ativa" : "Inativa"}</td>
                    <td><div style={s.actions}><button style={s.small} onClick={() => editar(item)}>Corrigir</button><button style={item.ativo ? s.danger : s.secondary} onClick={() => alternar(item)}>{item.ativo ? "Inativar" : "Ativar"}</button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>

        {contas.some(c => c.ativo) && (
          <div style={s.card}>
            <div style={s.titleRow}>
              <div>
                <h3 style={s.h3}>Importar extrato bancário</h3>
                <p style={s.p}>Envie o extrato em OFX ou CSV. O arquivo fica separado dos lançamentos do cliente e serve apenas para conferência.</p>
              </div>
              <span style={s.next}>Importação não gera lançamentos</span>
            </div>

            <form onSubmit={importarExtrato}>
              <div style={s.grid}>
                <Campo t="Conta bancária">
                  <select style={s.input} value={contaExtratoId} onChange={e => { setContaExtratoId(e.target.value); setResumoImportacao(null) }}>
                    {contas.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.bancoNome} • Ag. {c.agencia} • {c.conta}{c.digito ? `-${c.digito}` : ""}</option>)}
                  </select>
                </Campo>
                <Campo t="Arquivo OFX ou CSV"><input id="nexa-arquivo-extrato" type="file" accept=".ofx,.csv,text/csv,application/x-ofx" style={s.input} onChange={e => setArquivo(e.target.files?.[0] || null)} /></Campo>
              </div>
              <button style={s.primary} disabled={importando}>{importando ? "Lendo extrato..." : "Importar e ler extrato"}</button>
            </form>

            {resumoImportacao && (
              <div style={s.success}>
                <strong>Extrato importado com sucesso.</strong>
                <span>{resumoImportacao.importados} movimento(s) novo(s) • {resumoImportacao.duplicados} duplicado(s) do extrato ignorado(s)</span>
                {resumoImportacao.dataInicio && resumoImportacao.dataFim && (
                  <span>Período do extrato: {dataBr(resumoImportacao.dataInicio)} até {dataBr(resumoImportacao.dataFim)}</span>
                )}
              </div>
            )}
          </div>
        )}

        {contaExtratoId && (
          <div style={s.card}>
            <div style={s.titleRow}>
              <div>
                <h3 style={s.h3}>Movimentos importados</h3>
                <p style={s.p}>A Nexa confere automaticamente o extrato e deixa para você somente as exceções.</p>
              </div>
              <label style={{ ...s.label, margin: 0, minWidth: 190 }}>Competência
                <input type="month" style={s.input} value={competencia} onChange={e => { setCompetencia(e.target.value); setFiltroStatus("Todos"); setFiltroConferencia("Todos") }} />
              </label>
            </div>

            <div style={s.summary}>
              <Resumo t="Entradas" v={moeda(resumoMovimentos.entradas)} cor="#42f5a7" />
              <Resumo t="Saídas" v={moeda(resumoMovimentos.saidas)} cor="#ff7d88" />
              <Resumo t="Movimento líquido" v={moeda(resumoMovimentos.entradas - resumoMovimentos.saidas)} cor="#53c9ff" />
              <Resumo t="Batendo" v={resumoConferencia.batendo} cor="#73ffd4" />
              <Resumo t="Faltando" v={resumoConferencia.faltando} cor="#ffd45b" />
              <Resumo t="Revisar" v={resumoConferencia.revisar} cor="#ffbf69" />
              <Resumo t="Divergências" v={resumoConferencia.divergencias} cor="#ff7d88" />
            </div>

            <div style={totaisBatem ? s.autoOk : s.autoBox}>
              <div style={s.autoInfo}>
                <strong>Conferência automática da Nexa</strong>
                <span>
                  Entradas do extrato: <b>{moeda(resumoMovimentos.entradas)}</b> •
                  Receitas em Bancos: <b>{moeda(resumoClienteBancos.receitas)}</b> •
                  Diferença: <b>{moeda(diferencaEntradas)}</b>
                </span>
                <span>
                  Saídas do extrato: <b>{moeda(resumoMovimentos.saidas)}</b> •
                  Despesas em Bancos: <b>{moeda(resumoClienteBancos.despesas)}</b> •
                  Diferença: <b>{moeda(diferencaSaidas)}</b>
                </span>
                <small>
                  {totaisBatem
                    ? "✅ Os totais bancários do mês batem."
                    : "A Nexa resolve o que for seguro e deixa somente as diferenças para revisão."}
                </small>
              </div>
              {!fechamentoAtual && movimentos.length > 0 && (
                <button
                  style={{ ...s.autoButton, ...(processando ? s.disabled : {}) }}
                  disabled={processando}
                  onClick={conciliarAutomaticamente}
                >
                  {processando ? "Conferindo..." : "✨ Conferir automaticamente"}
                </button>
              )}
            </div>

            <div style={s.legend}>
              <span><b style={{ color: "#73ffd4" }}>● Verde</b> — mesma natureza, data e valor; quando existem movimentos repetidos, a Nexa faz pareamento 1↔1 pela quantidade.</span>
              <span><b style={{ color: "#ffd45b" }}>● Amarelo</b> — lançamento ausente ou possível diferença de compensação/agrupamento.</span>
              <span><b style={{ color: "#ff7d88" }}>● Vermelho</b> — mais de uma correspondência ou lançamento já gerado pela conciliação; revisar possível duplicidade.</span>
              <span><b>Regra de segurança:</b> importar extrato não cria Receita ou Despesa em Movimentos Clientes.</span>
              <span><b>Caixa fica fora:</b> a conciliação usa apenas lançamentos bancários do cliente.</span>
            </div>

            <div style={fechamentoAtual ? s.closeDone : s.closeBox}>
              <div>
                <strong>{fechamentoAtual ? `✅ ${competenciaBr(competencia)} concluído` : `Fechamento de ${competenciaBr(competencia)}`}</strong>
                <span style={s.closeText}>
                  {fechamentoAtual
                    ? `Saldo final: ${moeda(fechamentoAtual.saldoFinal)}`
                    : faltamConcluir
                      ? `Faltam ${faltamConcluir} movimento(s) para concluir este mês.`
                      : movimentos.length
                        ? "Tudo conferido. O mês já pode ser concluído."
                        : "Nenhum movimento nesta competência."}
                </span>
              </div>
              <div style={s.actions}>
                {!fechamentoAtual && faltamConcluir > 0 && <button style={s.secondary} onClick={() => setFiltroStatus("A concluir")}>Ver pendentes</button>}
                {!fechamentoAtual && <button style={{ ...s.primary, ...(processando || faltamConcluir > 0 || !movimentos.length ? s.disabled : {}) }} disabled={processando || faltamConcluir > 0 || !movimentos.length} onClick={concluirMes}>Concluir mês</button>}
                {fechamentoAtual && <button style={s.small} onClick={() => baixarRelatorio(fechamentoAtual)}>Baixar PDF</button>}
              </div>
            </div>

            {movimentos.length > 0 && (
              <div style={s.batch}>
                <select style={s.input} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                  <option>Todos</option><option>A concluir</option><option>Pendente</option><option>Classificado</option><option>Conciliado</option><option>Ignorado</option><option>Lançado</option>
                </select>
                <select style={s.input} value={filtroConferencia} onChange={e => setFiltroConferencia(e.target.value)}>
                  <option value="Todos">Todas as conferências</option>
                  <option value="BATENDO">🟢 Batendo</option>
                  <option value="FALTANDO">🟡 Faltando</option>
                  <option value="REVISAR">🟠 Revisar</option>
                  <option value="DIVERGENCIA">🔴 Divergências</option>
                </select>
                <button style={s.secondary} onClick={selecionarVisiveis}>Selecionar visíveis</button>
                <button style={s.secondary} onClick={() => setSelecionados([])}>Limpar seleção</button>
                <select style={s.input} value={planoLoteId} onChange={e => setPlanoLoteId(e.target.value)}>
                  <option value="">Conta contábil para o lote</option>
                  {planoContas.map(p => <option key={p.id} value={p.id}>{p.codigo} • {p.conta}</option>)}
                </select>
                <button style={s.small} disabled={processando || Boolean(fechamentoAtual)} onClick={() => classificarLote("Classificado")}>Classificar lote</button>
                <button
                  style={{
                    ...s.primary,
                    ...(processando || Boolean(fechamentoAtual) || !selecionados.length || selecionados.some(id => analiseConciliacao[id]?.status !== "BATENDO") ? s.disabled : {}),
                  }}
                  disabled={processando || Boolean(fechamentoAtual) || !selecionados.length || selecionados.some(id => analiseConciliacao[id]?.status !== "BATENDO")}
                  onClick={() => classificarLote("Conciliado")}
                >
                  Conciliar lote
                </button>
                <button style={s.secondary} disabled={processando || Boolean(fechamentoAtual)} onClick={() => classificarLote("Ignorado")}>Ignorar lote</button>
                <button style={s.small} disabled={processando || Boolean(fechamentoAtual)} onClick={sugerirClassificacoes}>Sugerir pelo histórico</button>
                <button style={s.refresh} disabled={processando} onClick={carregarExtratos}>Atualizar conferência</button>
                <strong>{selecionados.length} selecionado(s)</strong>
              </div>
            )}

            {movimentos.length === 0 ? (
              <div style={s.empty}>Nenhum movimento em {competenciaBr(competencia)}.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={s.table}>
                  <thead>
                    <tr><th>✓</th><th>Data</th><th>Descrição</th><th>Natureza</th><th>Valor</th><th>Plano de Contas</th><th>Conferência</th><th>Status</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {movimentosVisiveis.map(m => {
                      const conferencia = analiseConciliacao[m.id] || { status: "FALTANDO", titulo: "Sem conferência", detalhe: "" }
                      return (
                        <tr key={m.id} style={estiloLinha(conferencia.status)}>
                          <td><input type="checkbox" checked={selecionados.includes(m.id)} disabled={Boolean(m.lancamentoContabilId) || Boolean(fechamentoAtual)} onChange={() => alternarSelecao(m.id)} /></td>
                          <td>{dataBr(m.data)}</td>
                          <td><strong>{m.descricao}</strong><small style={s.block}>{m.documento || ""}</small></td>
                          <td><span style={m.natureza === "Entrada" ? s.entrada : s.saida}>{m.natureza}</span></td>
                          <td style={{ color: m.natureza === "Entrada" ? "#42f5a7" : "#ff9ba4", fontWeight: 800 }}>{m.natureza === "Saída" ? "- " : "+ "}{moeda(m.valor)}</td>
                          <td>
                            <select style={s.tableSelect} value={classificacoes[m.id] || ""} disabled={Boolean(m.lancamentoContabilId) || Boolean(fechamentoAtual)} onChange={e => setClassificacoes(a => ({ ...a, [m.id]: e.target.value }))}>
                              <option value="">Selecione</option>
                              {planosPara(m.natureza).map(p => <option key={p.id} value={p.id}>{p.codigo} • {p.conta}</option>)}
                            </select>
                            {m.categoriaSugerida && <small style={s.block}>Sugestão: {m.categoriaSugerida}</small>}
                          </td>
                          <td><span style={badgeConferencia(conferencia.status)}>{conferencia.titulo}</span><small style={s.block}>{conferencia.detalhe}</small></td>
                          <td>{m.statusConciliacao}</td>
                          <td>
                            <div style={s.actions}>
                              {!m.lancamentoContabilId && !fechamentoAtual && <>
                                <button style={s.small} disabled={processando} onClick={() => classificarUm(m, "Classificado")}>Classificar</button>
                                <button
                                  style={{ ...s.primary, ...(processando || conferencia.status !== "BATENDO" ? s.disabled : {}) }}
                                  disabled={processando || conferencia.status !== "BATENDO"}
                                  title={conferencia.status === "BATENDO" ? "Conciliar com o lançamento do cliente" : "Só é possível conciliar quando a linha estiver verde"}
                                  onClick={() => classificarUm(m, "Conciliado")}
                                >
                                  Conciliar
                                </button>
                                <button style={s.secondary} disabled={processando} onClick={() => classificarUm(m, "Ignorado")}>Ignorar</button>
                              </>}
                              {m.lancamentoContabilId && <span style={s.lancado}>⚠ Lançamento #{m.lancamentoContabilId} — revisar</span>}
                              {fechamentoAtual && !m.lancamentoContabilId && <span style={s.lancado}>Mês fechado</span>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {fechamentos.filter(f => f.status === "Fechado").length > 0 && (
              <details style={s.history}>
                <summary style={s.historySummary}>Meses anteriores ({fechamentos.filter(f => f.status === "Fechado").length})</summary>
                {fechamentos.filter(f => f.status === "Fechado").map(f => (
                  <div key={f.id} style={s.importItem}>
                    <span><strong>{competenciaBr(f.competencia)}</strong> • Saldo final {moeda(f.saldoFinal)}</span>
                    <span style={s.actions}><button style={s.small} onClick={() => baixarRelatorio(f)}>PDF</button><button style={s.secondary} disabled={processando} onClick={() => reabrirMes(f)}>Reabrir</button></span>
                  </div>
                ))}
              </details>
            )}

            {importacoes.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <h4>Histórico de importações</h4>
                {importacoes.slice(0, 5).map(i => (
                  <div key={i.id} style={s.importItem}>
                    <span><strong>{i.nomeArquivo}</strong> • {i.formato}{i.dataInicio && i.dataFim ? ` • ${dataBr(i.dataInicio)} a ${dataBr(i.dataFim)}` : ""}</span>
                    <span>{i.totalImportados} novos • {i.totalDuplicados} duplicados • importado em {dataBr(String(i.createdAt).slice(0, 10))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </>}
    </div>
  )
}

function valorComparavel(v) {
  if (v === null || v === undefined || v === "") return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  let t = String(v).replace(/R\$/gi, "").replace(/\s/g, "").trim()
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".")
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

function dataIso(v) { return v ? String(v).slice(0, 10) : "" }

function diferencaDias(a, b) {
  if (!a || !b) return null
  const da = new Date(`${a}T12:00:00`)
  const db = new Date(`${b}T12:00:00`)
  if (!Number.isFinite(da.getTime()) || !Number.isFinite(db.getTime())) return null
  return Math.abs(Math.round((da - db) / 86400000))
}

function estiloLinha(status) {
  if (status === "BATENDO") return { background: "rgba(48,201,126,.13)", boxShadow: "inset 4px 0 0 #3fe49b" }
  if (status === "DIVERGENCIA") return { background: "rgba(255,92,112,.13)", boxShadow: "inset 4px 0 0 #ff5c70" }
  return { background: "rgba(255,198,72,.09)", boxShadow: "inset 4px 0 0 #ffc648" }
}

function badgeConferencia(status) {
  if (status === "BATENDO") return { display: "inline-block", padding: "5px 8px", borderRadius: 999, background: "#145c4a", color: "#79ffd0", fontWeight: 800, fontSize: 11 }
  if (status === "DIVERGENCIA") return { display: "inline-block", padding: "5px 8px", borderRadius: 999, background: "#652c3b", color: "#ffb8bf", fontWeight: 800, fontSize: 11 }
  return { display: "inline-block", padding: "5px 8px", borderRadius: 999, background: "#624d1c", color: "#ffe49a", fontWeight: 800, fontSize: 11 }
}

function Campo({ t, children }) { return <label style={s.label}>{t}{children}</label> }
function Resumo({ t, v, cor }) { return <div style={s.summaryItem}><span>{t}</span><strong style={{ color: cor }}>{v}</strong></div> }
function movimentoClienteEhBancario(item) {
  const plano = String(item?.planoContaNome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

  // Se existe Plano de Contas, ele prevalece. Caixa fica fora.
  if (plano) return plano.includes("banco")

  const forma = `${item?.formaPagamento || ""} ${item?.forma || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return /pix|cartao|transferencia|ted|doc|debito|credito|banco/.test(forma)
}

function moeda(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
function moedaCampo(v) { return moeda(v) }
function formatarMoedaDigitada(v) { const d = String(v || "").replace(/\D/g, ""); return d ? (Number(d) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "" }
function numeroMoeda(v) { const t = String(v || "").replace(/R\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", "."); return Number(t || 0) }
function dataBr(v) { if (!v) return "-"; return new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") }
function competenciaBr(v) { const [ano, mes] = String(v || "").split("-"); return mes && ano ? `${mes}/${ano}` : "-" }

const s = {
  page: { padding: 24, color: "#fff", background: "#082e61", minHeight: "100vh" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, background: "linear-gradient(135deg,#0b4a84,#087c7c)", padding: 24, borderRadius: 20, marginBottom: 18, border: "1px solid #18c9b2" },
  badge: { color: "#58ffd0", fontWeight: 800 },
  h2: { margin: "6px 0", fontSize: 30 },
  h3: { margin: "0 0 6px" },
  p: { margin: 0, color: "#bcd8f5" },
  home: { width: 46, height: 46, borderRadius: 12, border: "1px solid #49f2c2", background: "#092750", fontSize: 23, cursor: "pointer" },
  card: { background: "#0b2852", border: "1px solid #22558d", borderRadius: 18, padding: 20, marginBottom: 18 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 },
  label: { display: "flex", flexDirection: "column", gap: 7, color: "#bcd8f5", fontSize: 13, fontWeight: 700, marginBottom: 12 },
  input: { boxSizing: "border-box", width: "100%", padding: "12px 13px", borderRadius: 10, border: "1px solid #2b6098", background: "#071f43", color: "#fff", fontSize: 14 },
  check: { display: "flex", gap: 9, alignItems: "center", margin: "4px 0 16px", color: "#dff" },
  primary: { border: 0, borderRadius: 10, padding: "12px 18px", background: "linear-gradient(90deg,#08b8ef,#27ed8b)", fontWeight: 800, cursor: "pointer" },
  secondary: { border: "1px solid #2f74ae", borderRadius: 9, padding: "9px 13px", background: "#123b6b", color: "#fff", cursor: "pointer" },
  danger: { border: "1px solid #ff6a78", borderRadius: 9, padding: "9px 13px", background: "#6b2433", color: "#fff", cursor: "pointer" },
  small: { border: 0, borderRadius: 9, padding: "9px 13px", background: "#09bcea", fontWeight: 800, cursor: "pointer" },
  refresh: { border: "1px solid #38d9c3", borderRadius: 9, padding: "10px 14px", background: "#0b4f62", color: "#d8fff8", fontWeight: 800, cursor: "pointer" },
  disabled: { opacity: 0.4, cursor: "not-allowed", filter: "grayscale(.55)" },
  titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  next: { background: "#164f69", color: "#65ffd0", padding: "8px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800 },
  table: { width: "100%", borderCollapse: "collapse" },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  principal: { display: "inline-block", marginLeft: 8, padding: "3px 7px", background: "#167a64", borderRadius: 999, fontSize: 10 },
  empty: { padding: 20, textAlign: "center", color: "#9ab8d7", background: "#071f43", borderRadius: 12 },
  success: { display: "flex", flexDirection: "column", gap: 5, marginTop: 15, padding: 14, borderRadius: 12, background: "#0c5c50", color: "#caffee" },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 },
  summaryItem: { display: "flex", flexDirection: "column", gap: 6, padding: 14, background: "#071f43", borderRadius: 12 },
  autoBox: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap", padding: 14, marginBottom: 14, borderRadius: 12, background: "#0d2b52", border: "1px solid #34649a" },
  autoOk: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap", padding: 14, marginBottom: 14, borderRadius: 12, background: "#0b3d3a", border: "1px solid #2aa883" },
  autoInfo: { display: "grid", gap: 5, color: "#d7e9fb", fontSize: 12 },
  autoButton: { border: "1px solid #5df0c8", borderRadius: 10, padding: "11px 16px", background: "#0a7568", color: "#fff", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  legend: { display: "grid", gap: 7, padding: 14, marginBottom: 16, borderRadius: 12, background: "#071f43", border: "1px solid #22558d", color: "#bcd8f5", fontSize: 12 },
  entrada: { padding: "4px 8px", borderRadius: 999, background: "#145c4a", color: "#6cffc5" },
  saida: { padding: "4px 8px", borderRadius: 999, background: "#652c3b", color: "#ffabb2" },
  importItem: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 12px", marginTop: 7, background: "#071f43", borderRadius: 10, color: "#bcd8f5" },
  batch: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: 14, marginBottom: 14, background: "#071f43", borderRadius: 12 },
  tableSelect: { minWidth: 210, padding: 8, borderRadius: 8, border: "1px solid #2b6098", background: "#071f43", color: "#fff" },
  block: { display: "block", marginTop: 5, color: "#91b4d8" },
  lancado: { padding: "6px 9px", borderRadius: 8, background: "#3c3476", color: "#d9d2ff", whiteSpace: "nowrap" },
  closeBox: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 16, marginBottom: 16, borderRadius: 13, background: "#102f59", border: "1px solid #2b6098" },
  closeDone: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 16, marginBottom: 16, borderRadius: 13, background: "#105443", border: "1px solid #29c98d" },
  closeText: { display: "block", marginTop: 5, color: "#c2d9ed", fontSize: 13 },
  history: { marginTop: 18, padding: 12, borderRadius: 12, background: "#082243", border: "1px solid #22558d" },
  historySummary: { cursor: "pointer", fontWeight: 800, color: "#bfe1ff" },
}
