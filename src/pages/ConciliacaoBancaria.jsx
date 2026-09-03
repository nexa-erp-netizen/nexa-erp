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
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false)
  const [diaDetalhe, setDiaDetalhe] = useState("")
  const [investigacao, setInvestigacao] = useState("")
  const [processando, setProcessando] = useState(false)
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [fechamentos, setFechamentos] = useState([])
  const [formasPagamento, setFormasPagamento] = useState([])
  const [diagnosticoSaldo, setDiagnosticoSaldo] = useState(null)
  const [selecionadosInvestigacao, setSelecionadosInvestigacao] = useState([])
  const [planoInvestigacaoId, setPlanoInvestigacaoId] = useState("")
  const [formaInvestigacao, setFormaInvestigacao] = useState("")
  const [mostrarAnaliseRestante, setMostrarAnaliseRestante] = useState(false)
  const [ajusteEmRevisao, setAjusteEmRevisao] = useState(null)
  const [tipoAjuste, setTipoAjuste] = useState("Arredondamento")
  const [planoAjusteId, setPlanoAjusteId] = useState("")
  const [observacaoAjuste, setObservacaoAjuste] = useState("")
  const periodoAutomaticoAplicadoRef = useRef("")

  useEffect(() => {
    api.get("/clientes").then(r => setClientes(r.data || [])).catch(() => setClientes([]))
    api.get("/plano-contas").then(r => setPlanoContas(r.data || [])).catch(() => setPlanoContas([]))
    api.get("/formas-pagamento").then(r => setFormasPagamento(r.data || [])).catch(() => setFormasPagamento([]))
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
      setDiagnosticoSaldo(null)
    }
  }, [contaExtratoId, competencia])

  useEffect(() => {
    periodoAutomaticoAplicadoRef.current = ""
  }, [contaExtratoId])

  useEffect(() => {
    setSelecionadosInvestigacao([])
    setMostrarAnaliseRestante(false)
    setAjusteEmRevisao(null)
    setTipoAjuste("Arredondamento")
    setPlanoAjusteId("")
    setObservacaoAjuste("")
    if (!investigacao) return

    const planoBanco = planoContas.find(plano => {
      const nome = `${plano?.nome || ""} ${plano?.descricao || ""} ${plano?.conta || ""}`
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      return nome.includes("banco")
    })
    if (planoBanco) setPlanoInvestigacaoId(String(planoBanco.id))

    const formaPix = formasPagamento.find(forma =>
      String(forma?.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "pix"
    )
    if (formaPix) setFormaInvestigacao(formaPix.nome)
  }, [investigacao, planoContas, formasPagamento])

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

      const [m, i, f, mc, ds] = await Promise.all([
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
        api.get("/extratos-bancarios/diagnostico-saldo", {
          params: { contaBancariaId: contaExtratoId, competencia, _t: semCache },
        }).catch(() => ({ data: null })),
      ])

      const lista = m.data || []
      const listaImportacoes = Array.isArray(i.data) ? i.data : []
      setMovimentos(lista)
      setImportacoes(listaImportacoes)
      setFechamentos(f.data || [])
      setMovimentosCliente(Array.isArray(mc.data) ? mc.data : [])
      setDiagnosticoSaldo(ds?.data || null)
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
        String(movimento.observacoes || "").startsWith("Nexa Ajuste •")
      ) {
        resultado[movimento.id] = {
          status: "BATENDO",
          titulo: "Ajuste reconhecido",
          detalhe: String(movimento.observacoes || "Ajuste registrado na auditoria da conciliação."),
        }
        return
      }

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
      const pareceCartao = /cart[aã]o|stone|cielo|rede|pagseguro|pagbank|mercado pago|sumup|getnet|infinitepay|infinite pay|\bton\b|maquininha/.test(descricao)

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

  const resumoBancoComparavel = useMemo(
    () => movimentos
      .filter(item => item.statusConciliacao !== "Ignorado")
      .reduce((r, item) => {
        const valor = valorBancoConciliavel(item)
        if (item.natureza === "Entrada") r.entradas += valor
        else r.saidas += valor
        return r
      }, { entradas: 0, saidas: 0 }),
    [movimentos]
  )

  const ajustesReconhecidos = useMemo(
    () => movimentos.filter(item =>
      item.ajusteTipo || Math.abs(Number(item.ajusteComparacao || 0)) > 0.001
    ),
    [movimentos]
  )

  const efeitoLiquidoAjustes = useMemo(
    () => ajustesReconhecidos.reduce((total, item) => total + Number(item.ajusteComparacao || 0), 0),
    [ajustesReconhecidos]
  )

  const contaExtrato = useMemo(
    () => contas.find(item => String(item.id) === String(contaExtratoId)) || null,
    [contas, contaExtratoId]
  )

  const importacaoCompetenciaAtual = useMemo(
    () => importacoes.find(item =>
      String(item?.dataFim || item?.dataInicio || "").slice(0, 7) === competencia &&
      item?.saldoInformado !== null &&
      item?.saldoInformado !== undefined
    ) || null,
    [importacoes, competencia]
  )

  const variacaoBancoMes = resumoMovimentos.entradas - resumoMovimentos.saidas
  const saldoFinalBancoInformado = importacaoCompetenciaAtual
    ? Number(importacaoCompetenciaAtual.saldoInformado)
    : null
  const saldoInicialBancoCadastrado = diagnosticoSaldo?.saldoAnterior !== null &&
    diagnosticoSaldo?.saldoAnterior !== undefined
    ? Number(diagnosticoSaldo.saldoAnterior)
    : null
  // Quando o OFX informa o saldo final do mês, ele é a referência mais forte
  // para reconstruir o saldo de abertura. Isso evita tratar uma base cadastrada
  // no meio do mês como se fosse o saldo de 01/MM.
  const saldoInicialBancoDerivadoOfx = saldoFinalBancoInformado !== null &&
    Number.isFinite(saldoFinalBancoInformado)
    ? saldoFinalBancoInformado - variacaoBancoMes
    : null
  const saldoInicialBancoMes = saldoInicialBancoDerivadoOfx !== null
    ? saldoInicialBancoDerivadoOfx
    : saldoInicialBancoCadastrado
  const saldoInicialBancoOrigem = saldoInicialBancoDerivadoOfx !== null ? "OFX" : "Cadastro"
  const saldoFinalBancoCalculado = saldoInicialBancoMes === null
    ? null
    : saldoInicialBancoMes + variacaoBancoMes
  const resultadoClienteBancos = resumoClienteBancos.receitas - resumoClienteBancos.despesas
  const variacaoBancoConciliavel = resumoBancoComparavel.entradas - resumoBancoComparavel.saidas
  const diferencaVariacaoBancoCliente = variacaoBancoConciliavel - resultadoClienteBancos
  const diferencaSaldoOfx = saldoFinalBancoCalculado !== null && saldoFinalBancoInformado !== null
    ? saldoFinalBancoInformado - saldoFinalBancoCalculado
    : null

  const diferencaEntradas = resumoBancoComparavel.entradas - resumoClienteBancos.receitas
  const diferencaSaidas = resumoBancoComparavel.saidas - resumoClienteBancos.despesas
  const TOLERANCIA_FECHAMENTO = 0.10
  const LIMITE_MODO_TAXAS_CENTAVOS = 1.00
  const entradasBatem = Math.abs(diferencaEntradas) <= TOLERANCIA_FECHAMENTO
  const saidasBatem = Math.abs(diferencaSaidas) <= TOLERANCIA_FECHAMENTO
  const totaisBatem = entradasBatem && saidasBatem

  const idsClienteConciliados = useMemo(() => {
    const ids = new Set()
    movimentos
      .filter(item => item.statusConciliacao === "Conciliado")
      .forEach(item => {
        const texto = String(item.observacoes || "")
        for (const encontrado of texto.matchAll(/#(\d+)/g)) {
          ids.add(Number(encontrado[1]))
        }
      })
    return ids
  }, [movimentos])

  const bancoAindaSemCorrespondencia = useMemo(
    () => movimentos.filter(item =>
      !item.lancamentoContabilId &&
      !["Conciliado", "Ignorado", "Lançado"].includes(item.statusConciliacao)
    ),
    [movimentos]
  )

  const clienteAindaSemCorrespondencia = useMemo(
    () => movimentosClienteBancariosCompetencia.filter(item => !idsClienteConciliados.has(Number(item.id))),
    [movimentosClienteBancariosCompetencia, idsClienteConciliados]
  )

  const itensBancoInvestigacao = useMemo(
    () => investigacao
      ? bancoAindaSemCorrespondencia.filter(item => item.natureza === investigacao)
      : [],
    [bancoAindaSemCorrespondencia, investigacao]
  )

  const totalBancoInvestigacao = useMemo(
    () => itensBancoInvestigacao.reduce((total, item) => total + Number(item.valor || 0), 0),
    [itensBancoInvestigacao]
  )

  const itensBancoInvestigacaoSelecaoSegura = useMemo(
    () => itensBancoInvestigacao.filter(item => {
      const analise = analiseConciliacao[item.id] || {}
      return analise.status === "FALTANDO" && analise.titulo === "Sem lançamento correspondente"
    }),
    [itensBancoInvestigacao, analiseConciliacao]
  )

  const totalBancoInvestigacaoSelecaoSegura = useMemo(
    () => itensBancoInvestigacaoSelecaoSegura.reduce((total, item) => total + Number(item.valor || 0), 0),
    [itensBancoInvestigacaoSelecaoSegura]
  )


  const itensSelecionadosInvestigacao = useMemo(
    () => itensBancoInvestigacao.filter(item => selecionadosInvestigacao.includes(item.id)),
    [itensBancoInvestigacao, selecionadosInvestigacao]
  )

  const totalSelecionadoInvestigacao = useMemo(
    () => itensSelecionadosInvestigacao.reduce((total, item) => total + Number(item.valor || 0), 0),
    [itensSelecionadosInvestigacao]
  )

  const diferencaInvestigacaoAtual = investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas
  const restanteInvestigacao = Math.max(0, diferencaInvestigacaoAtual - totalSelecionadoInvestigacao)
  const modoTaxasCentavos =
    diferencaInvestigacaoAtual > TOLERANCIA_FECHAMENTO &&
    diferencaInvestigacaoAtual < LIMITE_MODO_TAXAS_CENTAVOS
  const exibirAnaliseRestante = modoTaxasCentavos || mostrarAnaliseRestante

  const analiseRestanteInvestigacao = useMemo(() => {
    if (!investigacao || restanteInvestigacao <= TOLERANCIA_FECHAMENTO) {
      return {
        linhasRevisao: [],
        candidatosTaxa: [],
        linhasSegurasProximas: [],
        combinacaoRevisaoExata: [],
      }
    }

    const naoSelecionados = itensBancoInvestigacao.filter(
      item => !selecionadosInvestigacao.includes(item.id)
    )

    const linhasRevisao = naoSelecionados
      .map(item => ({
        item,
        analise: analiseConciliacao[item.id] || {},
      }))
      .filter(({ analise }) =>
        analise.status !== "FALTANDO" ||
        analise.titulo !== "Sem lançamento correspondente"
      )

    const naturezaEsperada = investigacao === "Entrada" ? "Receita" : "Despesa"
    const clientesMesmoTipo = movimentosClienteBancariosCompetencia.filter(
      item => String(item.tipo || "") === naturezaEsperada
    )

    const candidatosTaxa = []
    for (const { item, analise } of linhasRevisao) {
      if (!["Revisar agrupamento/taxa", "Possível correspondência"].includes(analise.titulo)) continue

      for (const clienteMov of clientesMesmoTipo) {
        const distancia = diferencaDias(dataIso(item.data), dataIso(clienteMov.data))
        if (distancia === null || distancia > 3) continue

        const valorBanco = Number(item.valor || 0)
        const valorCliente = Number(clienteMov.valor || 0)
        const diferencaAssinada = Number((valorCliente - valorBanco).toFixed(2))
        const diferencaValores = Math.abs(diferencaAssinada)

        if (diferencaValores <= 0.01) continue
        if (diferencaValores > Math.max(5, restanteInvestigacao + 1)) continue

        candidatosTaxa.push({
          banco: item,
          cliente: clienteMov,
          analise,
          diferencaAssinada,
          diferencaValores,
          distanciaRestante: Math.abs(diferencaValores - restanteInvestigacao),
        })
      }
    }

    candidatosTaxa.sort((a, b) =>
      a.distanciaRestante - b.distanciaRestante
    )

    const linhasSegurasProximas = naoSelecionados
      .map(item => ({
        item,
        analise: analiseConciliacao[item.id] || {},
        distanciaValor: Math.abs(Number(item.valor || 0) - restanteInvestigacao),
      }))
      .filter(({ analise }) =>
        analise.status === "FALTANDO" &&
        analise.titulo === "Sem lançamento correspondente"
      )
      .sort((a, b) => a.distanciaValor - b.distanciaValor)
      .slice(0, 5)

    // Diagnóstico apenas: procura combinação exata entre linhas que ficaram
    // em revisão. Elas nunca são selecionadas automaticamente.
    const alvoCentavos = Math.round(restanteInvestigacao * 100)
    const candidatosRevisao = linhasRevisao
      .map(({ item }) => ({
        id: item.id,
        centavos: Math.round(Number(item.valor || 0) * 100),
      }))
      .filter(item => item.centavos > 0 && item.centavos <= alvoCentavos)

    const estados = new Map([[0, null]])
    for (const candidato of candidatosRevisao) {
      for (const soma of Array.from(estados.keys())) {
        const novaSoma = soma + candidato.centavos
        if (novaSoma > alvoCentavos || estados.has(novaSoma)) continue
        estados.set(novaSoma, { anterior: soma, id: candidato.id })
      }
      if (estados.has(alvoCentavos)) break
    }

    const combinacaoRevisaoExata = []
    if (estados.has(alvoCentavos)) {
      let cursor = alvoCentavos
      while (cursor > 0) {
        const passo = estados.get(cursor)
        if (!passo) break
        combinacaoRevisaoExata.push(passo.id)
        cursor = passo.anterior
      }
    }

    return {
      linhasRevisao,
      candidatosTaxa: candidatosTaxa.slice(0, 5),
      linhasSegurasProximas,
      combinacaoRevisaoExata,
    }
  }, [
    investigacao,
    restanteInvestigacao,
    itensBancoInvestigacao,
    selecionadosInvestigacao,
    analiseConciliacao,
    movimentosClienteBancariosCompetencia,
  ])

  const diasComDiferenca = useMemo(() => {
    const mapa = new Map()

    function obter(data) {
      const chave = dataIso(data)
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          data: chave,
          entradasBanco: 0,
          receitasCliente: 0,
          saidasBanco: 0,
          despesasCliente: 0,
        })
      }
      return mapa.get(chave)
    }

    movimentos
      .filter(item => item.statusConciliacao !== "Ignorado")
      .forEach(item => {
        const dia = obter(item.data)
        const valor = Number(item.valor || 0)
        if (item.natureza === "Entrada") dia.entradasBanco += valor
        else dia.saidasBanco += valor
      })

    movimentosClienteBancariosCompetencia.forEach(item => {
      const dia = obter(item.data)
      const valor = Number(item.valor || 0)
      if (item.tipo === "Receita") dia.receitasCliente += valor
      else if (item.tipo === "Despesa") dia.despesasCliente += valor
    })

    return [...mapa.values()]
      .map(item => ({
        ...item,
        diferencaEntradas: item.entradasBanco - item.receitasCliente,
        diferencaSaidas: item.saidasBanco - item.despesasCliente,
      }))
      .filter(item =>
        Math.abs(item.diferencaEntradas) >= 0.01 ||
        Math.abs(item.diferencaSaidas) >= 0.01
      )
      .sort((a, b) => String(a.data).localeCompare(String(b.data)))
  }, [movimentos, movimentosClienteBancariosCompetencia])

  const diferencaAbsTotal = useMemo(
    () => diasComDiferenca.reduce(
      (total, item) =>
        total + Math.abs(item.diferencaEntradas) + Math.abs(item.diferencaSaidas),
      0
    ),
    [diasComDiferenca]
  )

  const TOLERANCIA_VISUAL = 0.10

  const diasComDiferencaRelevante = useMemo(
    () => diasComDiferenca.filter(item =>
      Math.abs(item.diferencaEntradas) > TOLERANCIA_VISUAL ||
      Math.abs(item.diferencaSaidas) > TOLERANCIA_VISUAL
    ),
    [diasComDiferenca]
  )

  const pequenasDiferencas = useMemo(
    () => diasComDiferenca.filter(item =>
      Math.abs(item.diferencaEntradas) <= TOLERANCIA_VISUAL &&
      Math.abs(item.diferencaSaidas) <= TOLERANCIA_VISUAL
    ),
    [diasComDiferenca]
  )

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

    if (diaDetalhe) {
      lista = lista.filter(m => dataIso(m.data) === diaDetalhe)
    }

    if (filtroConferencia !== "Todos") {
      lista = lista.filter(m => analiseConciliacao[m.id]?.status === filtroConferencia)
    }

    return lista
  }, [movimentos, filtroStatus, filtroConferencia, analiseConciliacao, diaDetalhe])

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

  function abrirDetalhesDia(data) {
    setDiaDetalhe(data)
    setMostrarDetalhes(true)
    setFiltroStatus("Todos")
    setFiltroConferencia("Todos")
    setSelecionados([])
    setTimeout(() => {
      document.getElementById("nexa-detalhes-conciliacao")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  function alternarSelecao(id) {
    setSelecionados(atual => atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id])
  }

  function selecionarVisiveis() {
    setSelecionados(movimentosVisiveis.filter(m => !m.lancamentoContabilId).map(m => m.id))
  }

  function alternarSelecaoInvestigacao(id) {
    if (modoTaxasCentavos) {
      return alert(`Diferença restante de ${moeda(diferencaInvestigacaoAtual)}. O modo taxa/centavos está ativo e bloqueia novos lançamentos em massa.`)
    }
    setMostrarAnaliseRestante(false)
    setSelecionadosInvestigacao(atual =>
      atual.includes(id) ? atual.filter(item => item !== id) : [...atual, id]
    )
  }

  function selecionarTodosInvestigacao() {
    if (modoTaxasCentavos) {
      return alert(`Diferença restante de ${moeda(diferencaInvestigacaoAtual)}. Revise taxas, agrupamentos e arredondamentos em vez de selecionar novos lançamentos.`)
    }
    setMostrarAnaliseRestante(false)
    const ids = itensBancoInvestigacao.map(item => item.id)
    const todosSelecionados = ids.length > 0 && ids.every(id => selecionadosInvestigacao.includes(id))
    setSelecionadosInvestigacao(todosSelecionados ? [] : ids)
  }

  function selecionarSomenteDiferencaInvestigacao() {
    const diferencaAtual = investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas

    if (diferencaAtual > TOLERANCIA_FECHAMENTO && diferencaAtual < LIMITE_MODO_TAXAS_CENTAVOS) {
      setSelecionadosInvestigacao([])
      setMostrarAnaliseRestante(true)
      return alert(`A diferença restante é de apenas ${moeda(diferencaAtual)}. A Nexa entrou no modo taxa/centavos e não fará nova seleção em massa.`)
    }
    const alvoCentavos = Math.round(Number(diferencaAtual || 0) * 100)

    if (alvoCentavos <= Math.round(TOLERANCIA_FECHAMENTO * 100)) {
      return alert("Não há diferença positiva para selecionar.")
    }

    const candidatos = itensBancoInvestigacaoSelecaoSegura
      .map(item => ({
        id: item.id,
        centavos: Math.round(Number(item.valor || 0) * 100),
      }))
      .filter(item => item.centavos > 0 && item.centavos <= alvoCentavos)

    if (!candidatos.length) {
      return alert("Não há linhas classificadas como faltantes seguros para esta diferença. Revise as possíveis correspondências manualmente.")
    }

    // Soma de subconjunto em centavos. A Nexa procura primeiro uma combinação
    // exata e, se ela não existir, usa a melhor aproximação sem ultrapassar
    // a diferença. O limite de estados evita travar o navegador em extratos
    // excepcionalmente grandes.
    const estados = new Map([[0, null]])
    const LIMITE_ESTADOS = 250000
    let encontrouExato = false
    let interrompidoPorLimite = false

    busca:
    for (const candidato of candidatos) {
      const somasExistentes = Array.from(estados.keys())

      for (const soma of somasExistentes) {
        const novaSoma = soma + candidato.centavos
        if (novaSoma > alvoCentavos || estados.has(novaSoma)) continue

        estados.set(novaSoma, {
          anterior: soma,
          id: candidato.id,
        })

        if (novaSoma === alvoCentavos) {
          encontrouExato = true
          break busca
        }
      }

      if (estados.size > LIMITE_ESTADOS) {
        interrompidoPorLimite = true
        break
      }
    }

    let melhorSoma = encontrouExato ? alvoCentavos : 0
    if (!encontrouExato) {
      for (const soma of estados.keys()) {
        if (soma <= alvoCentavos && soma > melhorSoma) melhorSoma = soma
      }
    }

    if (melhorSoma <= 0) {
      return alert("A Nexa não encontrou uma combinação segura para esta diferença.")
    }

    const ids = []
    let cursor = melhorSoma

    while (cursor > 0) {
      const passo = estados.get(cursor)
      if (!passo) break
      ids.push(passo.id)
      cursor = passo.anterior
    }

    setSelecionadosInvestigacao(ids)
    setMostrarAnaliseRestante(false)

    const totalEncontrado = melhorSoma / 100
    const restante = Math.max(0, diferencaAtual - totalEncontrado)

    if (Math.abs(totalEncontrado - diferencaAtual) <= TOLERANCIA_FECHAMENTO) {
      alert(
        `Seleção inteligente concluída.\n\n` +
        `${ids.length} linha(s) somam exatamente ${moeda(totalEncontrado)}.\n\n` +
        "A seleção automática ignorou possíveis correspondências e agrupamentos/taxas. Revise as linhas antes de clicar em Lançar selecionados."
      )
      return
    }

    alert(
      `Não foi encontrada uma combinação exata${interrompidoPorLimite ? " dentro do limite de cálculo" : ""}.\n\n` +
      `A Nexa selecionou ${ids.length} linha(s), totalizando ${moeda(totalEncontrado)}, sem ultrapassar a diferença.\n` +
      `Ainda restará ${moeda(restante)} para revisão manual.`
    )
  }

  async function lancarSelecionadosInvestigacao() {
    if (modoTaxasCentavos) {
      return alert(`Modo taxa/centavos ativo: a diferença é de ${moeda(diferencaInvestigacaoAtual)}. Identifique a origem antes de criar novos lançamentos.`)
    }

    if (!itensSelecionadosInvestigacao.length) {
      return alert("Selecione pelo menos um movimento do extrato.")
    }

    const diferencaAtual = investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas
    if (diferencaAtual <= TOLERANCIA_FECHAMENTO) {
      return alert("Não há diferença positiva para lançar nesta investigação.")
    }

    if (totalSelecionadoInvestigacao - diferencaAtual > TOLERANCIA_FECHAMENTO) {
      return alert(
        `O total selecionado (${moeda(totalSelecionadoInvestigacao)}) é maior que a diferença do mês (${moeda(diferencaAtual)}).\n\n` +
        "Revise a seleção para não criar lançamentos a mais."
      )
    }

    const itensComRisco = itensSelecionadosInvestigacao.filter(item => {
      const analise = analiseConciliacao[item.id] || {}
      return analise.status !== "FALTANDO" || analise.titulo !== "Sem lançamento correspondente"
    })
    if (itensComRisco.length > 0 && !confirm(
      `${itensComRisco.length} linha(s) selecionada(s) têm possível correspondência, agrupamento ou outra condição de revisão.\n\n` +
      "Elas podem já existir em Movimentos Clientes. Deseja continuar mesmo assim?"
    )) return

    if (!planoInvestigacaoId) {
      return alert("Selecione o Plano de contas para os lançamentos.")
    }

    if (!formaInvestigacao) {
      return alert("Selecione a Forma de pagamento.")
    }

    const plano = planoContas.find(item => String(item.id) === String(planoInvestigacaoId))
    const planoContaNome = plano?.nome || plano?.descricao || plano?.conta || ""
    if (!planoContaNome) return alert("Plano de contas inválido.")

    const planoNormalizado = planoContaNome
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    if (!planoNormalizado.includes("banco")) {
      return alert('Para a conciliação, selecione o plano "Bancos". Lançamentos em Caixa não entram na conferência bancária.')
    }

    const tipo = investigacao === "Entrada" ? "Receita" : "Despesa"
    const movimentosParaCriar = itensSelecionadosInvestigacao.map(item => ({
      cliente: cliente?.nome || undefined,
      tipo,
      data: dataIso(item.data),
      planoContaId: Number(planoInvestigacaoId),
      planoContaNome,
      forma: formaInvestigacao,
      formaPagamento: formaInvestigacao,
      descricao: item.descricao || (tipo === "Receita" ? "Recebimento bancário" : "Pagamento bancário"),
      valor: Number(item.valor || 0),
      comprovante: "",
      status: "Pendente",
    }))

    const complemento = totalSelecionadoInvestigacao < diferencaAtual - TOLERANCIA_FECHAMENTO
      ? `\n\nApós este lote ainda restará aproximadamente ${moeda(diferencaAtual - totalSelecionadoInvestigacao)} para revisar.`
      : ""

    if (!confirm(
      `Criar ${movimentosParaCriar.length} lançamento(s) individual(is) em Movimentos Clientes?\n\n` +
      `Tipo: ${tipo}\nPlano: ${planoContaNome}\nForma: ${formaInvestigacao}\n` +
      `Total selecionado: ${moeda(totalSelecionadoInvestigacao)}\n\n` +
      "A Nexa manterá a data, descrição e valor de cada linha do extrato." +
      complemento
    )) return

    const chaveIdempotencia = [
      "conciliacao",
      contaExtratoId,
      competencia,
      tipo,
      ...itensSelecionadosInvestigacao.map(item => item.id).sort((a, b) => Number(a) - Number(b)),
    ].join(":")

    setProcessando(true)
    try {
      const resposta = await api.post("/movimentos-cliente/massa", {
        movimentos: movimentosParaCriar,
        chaveIdempotencia,
      })

      await api.post("/extratos-bancarios/movimentos/conciliar-automatico", {
        contaBancariaId: contaExtratoId,
        competencia,
      })

      setSelecionadosInvestigacao([])
      await carregarExtratos()

      alert(
        resposta.data?.duplicadoEvitado
          ? "Este mesmo lote já havia sido recebido. Nenhum lançamento foi duplicado."
          : `${movimentosParaCriar.length} lançamento(s) criado(s) e a conferência foi atualizada.`
      )
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao lançar os movimentos selecionados.")
    } finally {
      setProcessando(false)
    }
  }

  function abrirAjusteConciliacao(candidato) {
    const diferenca = Number(candidato?.diferencaAssinada || 0)
    const valor = Math.abs(diferenca)
    const permiteTaxa = candidato?.banco?.natureza === "Entrada" && diferenca > 0.01
    const permiteArredondamento = valor <= LIMITE_MODO_TAXAS_CENTAVOS

    if (!permiteTaxa && !permiteArredondamento) {
      return alert("Esta diferença não deve ser resolvida como taxa/centavos. Revise o lançamento ou o agrupamento antes de conciliar.")
    }

    setAjusteEmRevisao(candidato)
    setTipoAjuste(permiteArredondamento ? "Arredondamento" : "Taxa")
    setPlanoAjusteId("")
    setObservacaoAjuste("")
  }

  async function registrarAjusteConciliacao() {
    if (!ajusteEmRevisao) return
    const diferenca = Number(ajusteEmRevisao.diferencaAssinada || 0)
    const valor = Math.abs(diferenca)

    if (tipoAjuste === "Taxa" && !planoAjusteId) {
      return alert("Selecione o Plano de Contas que receberá a taxa/despesa.")
    }

    if (tipoAjuste === "Arredondamento" && valor > LIMITE_MODO_TAXAS_CENTAVOS) {
      return alert("Arredondamento/compensação só pode ser usado para diferenças de até R$ 1,00.")
    }

    const textoTipo = tipoAjuste === "Taxa" ? "taxa/desconto" : "arredondamento/compensação"
    const confirma = window.confirm(
      `Registrar ${textoTipo} de ${moeda(valor)}?\n\n` +
      `Banco: ${moeda(ajusteEmRevisao.banco.valor)}\n` +
      `Movimento do cliente: ${moeda(ajusteEmRevisao.cliente.valor)}\n\n` +
      (tipoAjuste === "Taxa"
        ? "A Nexa criará uma Despesa contábil da taxa e manterá o valor real do extrato intacto."
        : "Nenhum lançamento financeiro será criado; a diferença ficará registrada na auditoria da conciliação.")
    )
    if (!confirma) return

    setProcessando(true)
    try {
      const r = await api.post(`/extratos-bancarios/movimentos/${ajusteEmRevisao.banco.id}/registrar-ajuste`, {
        movimentoClienteReferenciaId: ajusteEmRevisao.cliente.id,
        tipoAjuste,
        planoContaId: tipoAjuste === "Taxa" ? planoAjusteId : null,
        observacao: observacaoAjuste,
      })
      alert(r.data?.message || "Ajuste registrado.")
      setAjusteEmRevisao(null)
      setPlanoAjusteId("")
      setObservacaoAjuste("")
      await carregarExtratos()
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao registrar ajuste da conciliação.")
    } finally {
      setProcessando(false)
    }
  }

  async function desfazerAjusteConciliacao(item) {
    const confirma = window.confirm(
      `Desfazer o ajuste ${item.ajusteTipo || "reconhecido"} desta linha?\n\n` +
      "Se a Nexa criou uma despesa de taxa, ela e o lançamento contábil correspondente também serão removidos."
    )
    if (!confirma) return

    setProcessando(true)
    try {
      const r = await api.delete(`/extratos-bancarios/movimentos/${item.id}/ajuste`)
      alert(r.data?.message || "Ajuste desfeito.")
      await carregarExtratos()
    } catch (e) {
      alert(e.response?.data?.message || "Erro ao desfazer ajuste.")
    } finally {
      setProcessando(false)
    }
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

      alert(
        "Conferência atualizada.\n\nA Nexa analisou as correspondências em segundo plano. Para fechar o mês, você só precisa resolver as diferenças totais de Entradas e Saídas."
      )
    } catch (e) {
      alert(e.response?.data?.message || "Erro na conciliação automática")
    } finally {
      setProcessando(false)
    }
  }

  async function classificarUm(movimento, status) {
    const planoContaId = classificacoes[movimento.id]

    if (status === "Ignorado" && !confirm(
      `Justificar este movimento de ${moeda(movimento.valor)}?\n\nUse somente quando ele não deve ser comparado com Receita/Despesa do cliente, como transferência, estorno ou outra exceção legítima.`
    )) return

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
    if (!totaisBatem) {
      return alert(
        `Ainda existem diferenças no mês.\n\n` +
        `Entradas: ${moeda(diferencaEntradas)}\n` +
        `Saídas: ${moeda(diferencaSaidas)}\n\n` +
        `Resolva ou justifique somente essas diferenças antes de concluir.`
      )
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
                <h3 style={s.h3}>Conciliação do mês</h3>
                <p style={s.p}>Compare os totais do banco com os Movimentos Clientes. A Nexa cuida das correspondências em segundo plano.</p>
              </div>
              <label style={{ ...s.label, margin: 0, minWidth: 190 }}>Competência
                <input type="month" style={s.input} value={competencia} onChange={e => { setCompetencia(e.target.value); setFiltroStatus("Todos"); setFiltroConferencia("Todos"); setInvestigacao("") }} />
              </label>
            </div>

            <div style={s.simpleStatus}>
              <div>
                <strong style={{ display: "block", marginBottom: 4 }}>{totaisBatem ? "✅ Conciliação do mês conferida" : "Conciliação do mês"}</strong>
                <span>
                  {totaisBatem
                    ? "Entradas e Saídas estão conferidas. Não é necessário conciliar linha por linha."
                    : "A Nexa compara os totais do extrato com os lançamentos bancários do cliente. Resolva apenas as diferenças abaixo."}
                </span>
              </div>
              {!fechamentoAtual && movimentos.length > 0 && (
                <button
                  style={{ ...s.refresh, ...(processando ? s.disabled : {}) }}
                  disabled={processando}
                  onClick={conciliarAutomaticamente}
                >
                  {processando ? "Atualizando..." : "Atualizar conferência"}
                </button>
              )}
            </div>

            <div style={s.balanceBox}>
              <div style={s.balanceHeader}>
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Saldo bancário do mês</strong>
                  <span>O saldo da conta é separado do resultado dos Movimentos Clientes.</span>
                </div>
                <span style={s.balanceTag}>{contaExtrato?.bancoNome || "Conta bancária"}</span>
              </div>

              <div style={s.balanceGrid}>
                <div style={s.balanceCard}>
                  <span>Saldo inicial do banco</span>
                  <strong>{saldoInicialBancoMes === null ? "Não calculado" : moeda(saldoInicialBancoMes)}</strong>
                  <small>
                    {saldoInicialBancoOrigem === "OFX"
                      ? `Calculado pelo saldo final do OFX menos a movimentação do mês.${diagnosticoSaldo?.dataSaldoInicial ? ` Base manual de ${moeda(saldoInicialBancoCadastrado)} em ${dataBr(diagnosticoSaldo.dataSaldoInicial)} preservada apenas como referência.` : ""}`
                      : diagnosticoSaldo?.dataSaldoInicial
                        ? `Base cadastrada em ${dataBr(diagnosticoSaldo.dataSaldoInicial)}`
                        : "Cadastre saldo inicial e data-base da conta para formar o saldo corretamente."}
                  </small>
                </div>

                <div style={s.balanceCard}>
                  <span>Movimentação do extrato</span>
                  <strong style={{ color: variacaoBancoMes >= 0 ? "#42f5a7" : "#ff9ba4" }}>
                    {variacaoBancoMes >= 0 ? "+ " : "- "}{moeda(Math.abs(variacaoBancoMes))}
                  </strong>
                  <small>{moeda(resumoMovimentos.entradas)} entradas • {moeda(resumoMovimentos.saidas)} saídas</small>
                </div>

                <div style={s.balanceCard}>
                  <span>Saldo final calculado</span>
                  <strong>{saldoFinalBancoCalculado === null ? "Não calculado" : moeda(saldoFinalBancoCalculado)}</strong>
                  <small>Saldo inicial + movimentação integral do extrato.</small>
                </div>

                <div style={s.balanceCard}>
                  <span>Saldo final informado pelo banco</span>
                  <strong>{saldoFinalBancoInformado === null ? "Não disponível no arquivo" : moeda(saldoFinalBancoInformado)}</strong>
                  <small>
                    {saldoFinalBancoInformado === null
                      ? "CSV normalmente não informa saldo final; OFX pode informar."
                      : diferencaSaldoOfx !== null && Math.abs(diferencaSaldoOfx) > TOLERANCIA_FECHAMENTO
                        ? `Diferença para o saldo calculado: ${moeda(diferencaSaldoOfx)}`
                        : "Saldo informado pelo OFX compatível com o cálculo."}
                  </small>
                </div>
              </div>

              <div style={s.clientBalanceLine}>
                <div style={s.balanceCard}>
                  <span>Movimentos Clientes — somente Bancos</span>
                  <strong style={{ color: resultadoClienteBancos >= 0 ? "#42f5a7" : "#ff9ba4" }}>
                    {resultadoClienteBancos >= 0 ? "+ " : "- "}{moeda(Math.abs(resultadoClienteBancos))}
                  </strong>
                  <small>{moeda(resumoClienteBancos.receitas)} receitas • {moeda(resumoClienteBancos.despesas)} despesas</small>
                </div>
                <div style={s.balanceCard}>
                  <span>Diferença da movimentação conciliável</span>
                  <strong style={{ color: Math.abs(diferencaVariacaoBancoCliente) <= TOLERANCIA_FECHAMENTO ? "#73ffd4" : "#ffbf69" }}>
                    {moeda(diferencaVariacaoBancoCliente)}
                  </strong>
                  <small>Compara Movimentos Clientes com o extrato após ajustes reconhecidos. O saldo bancário real continua usando o extrato sem alterações.</small>
                </div>
              </div>
            </div>

            <div style={s.reconGrid}>
              <div style={{ ...s.reconCard, ...(entradasBatem ? s.reconCardOk : s.reconCardWarn) }}>
                <div style={s.reconTitle}>
                  <span>Entradas</span>
                  <span style={entradasBatem ? s.statusOk : s.statusWarn}>{entradasBatem ? "Conferido" : "Diferença"}</span>
                </div>
                <div style={s.reconLine}>
                  <span>Extrato bancário</span>
                  <strong style={{ color: "#42f5a7" }}>{moeda(resumoBancoComparavel.entradas)}</strong>
                </div>
                <div style={s.reconLine}>
                  <span>Receitas em Bancos</span>
                  <strong>{moeda(resumoClienteBancos.receitas)}</strong>
                </div>
                <div style={s.reconDifference}>
                  <span>Diferença</span>
                  <strong style={{ color: entradasBatem ? "#73ffd4" : "#ffbf69" }}>
                    {entradasBatem ? "R$ 0,00" : moeda(diferencaEntradas)}
                  </strong>
                </div>
                {!entradasBatem && !fechamentoAtual && (
                  <button style={s.investigateButton} onClick={() => setInvestigacao(investigacao === "Entrada" ? "" : "Entrada")}>
                    {investigacao === "Entrada" ? "Fechar investigação" : "Investigar entradas"}
                  </button>
                )}
              </div>

              <div style={{ ...s.reconCard, ...(saidasBatem ? s.reconCardOk : s.reconCardWarn) }}>
                <div style={s.reconTitle}>
                  <span>Saídas</span>
                  <span style={saidasBatem ? s.statusOk : s.statusWarn}>{saidasBatem ? "Conferido" : "Diferença"}</span>
                </div>
                <div style={s.reconLine}>
                  <span>Extrato bancário</span>
                  <strong style={{ color: "#ff9ba4" }}>{moeda(resumoBancoComparavel.saidas)}</strong>
                </div>
                <div style={s.reconLine}>
                  <span>Despesas em Bancos</span>
                  <strong>{moeda(resumoClienteBancos.despesas)}</strong>
                </div>
                <div style={s.reconDifference}>
                  <span>Diferença</span>
                  <strong style={{ color: saidasBatem ? "#73ffd4" : "#ff7d88" }}>
                    {saidasBatem ? "R$ 0,00" : moeda(diferencaSaidas)}
                  </strong>
                </div>
                {!saidasBatem && !fechamentoAtual && (
                  <button style={s.investigateButton} onClick={() => setInvestigacao(investigacao === "Saída" ? "" : "Saída")}>
                    {investigacao === "Saída" ? "Fechar investigação" : "Investigar saídas"}
                  </button>
                )}
              </div>
            </div>

            {ajustesReconhecidos.length > 0 && (
              <div style={s.adjustmentsBox}>
                <div style={s.adjustmentsHeader}>
                  <div>
                    <strong>Ajustes reconhecidos no mês: {ajustesReconhecidos.length}</strong>
                    <small style={{ display: "block", marginTop: 4, color: "#b8d5ea" }}>
                      Efeito comparativo líquido: {moeda(efeitoLiquidoAjustes)}. O saldo real do extrato não é alterado.
                    </small>
                  </div>
                </div>
                <div style={s.investigationList}>
                  {ajustesReconhecidos.map(item => (
                    <div key={`ajuste-${item.id}`} style={s.investigationItemSelectable}>
                      <span>
                        <b>{dataBr(item.data)}</b> • {item.descricao || "Movimento bancário"} • {item.ajusteTipo || "Ajuste"}
                        <small style={{ display: "block", marginTop: 3, color: "#a9c9df" }}>
                          Banco {moeda(item.valor)} → valor conciliável {moeda(valorBancoConciliavel(item))}
                          {item.ajustadoPor ? ` • por ${item.ajustadoPor}` : ""}
                        </small>
                      </span>
                      <strong style={{ color: Number(item.ajusteComparacao || 0) >= 0 ? "#42f5a7" : "#ffbf69" }}>
                        {Number(item.ajusteComparacao || 0) >= 0 ? "+" : ""}{moeda(Number(item.ajusteComparacao || 0))}
                      </strong>
                      <button style={s.secondary} disabled={processando || fechamentoAtual?.status === "Fechado"} onClick={() => desfazerAjusteConciliacao(item)}>
                        Desfazer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {investigacao && (
              <div style={s.investigationBox}>
                <div style={s.investigationHeader}>
                  <div>
                    <strong style={{ display: "block", marginBottom: 4 }}>Investigar {investigacao === "Entrada" ? "entradas" : "saídas"}</strong>
                    <span>
                      {investigacao === "Entrada"
                        ? diferencaEntradas > 0
                          ? `Faltam ${moeda(diferencaEntradas)} nos lançamentos bancários do cliente.`
                          : `O cliente lançou ${moeda(Math.abs(diferencaEntradas))} a mais em receitas bancárias.`
                        : diferencaSaidas > 0
                          ? `Faltam ${moeda(diferencaSaidas)} nos lançamentos bancários do cliente.`
                          : `O cliente lançou ${moeda(Math.abs(diferencaSaidas))} a mais em despesas bancárias.`}
                    </span>
                  </div>
                  <button style={s.secondary} onClick={() => setInvestigacao("")}>Fechar</button>
                </div>

                {(investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas) > 0 ? (
                  <>
                    <div style={s.investigationTip}>
                      Abaixo estão movimentos do extrato ainda sem correspondência automática. Use <b>Selecionar só o que falta</b>: a Nexa considera automaticamente apenas linhas classificadas como faltantes seguros e ignora possíveis correspondências, agrupamentos e taxas. Revise antes de lançar. Cada linha será salva separadamente, mantendo data, descrição e valor. Se não fizerem parte da conciliação, use <b>Justificar</b>.
                    </div>

                    {modoTaxasCentavos && (
                      <div style={{ ...s.investigationTip, marginBottom: 12, border: "1px solid rgba(255, 196, 64, .55)", background: "rgba(255, 196, 64, .08)" }}>
                        <strong style={{ display: "block", marginBottom: 6 }}>
                          Modo taxa/centavos ativo • diferença {moeda(diferencaInvestigacaoAtual)}
                        </strong>
                        A diferença restante ficou abaixo de R$ 1,00. A Nexa bloqueou novas seleções e lançamentos em massa para evitar criar movimentos indevidos. Revise apenas taxas, arredondamentos, agrupamentos e compensações abaixo.
                      </div>
                    )}

                    <div style={s.investigationSummary}>
                      <div>
                        <strong>{itensBancoInvestigacao.length} linha(s) sem correspondência</strong>
                        <span style={{ display: "block", marginTop: 4 }}>Total das linhas: {moeda(totalBancoInvestigacao)} • Seleção segura: {itensBancoInvestigacaoSelecaoSegura.length} linha(s) / {moeda(totalBancoInvestigacaoSelecaoSegura)} • Diferença do mês: {moeda(investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button
                          style={s.primary}
                          disabled={
                            processando ||
                            modoTaxasCentavos ||
                            !itensBancoInvestigacao.length ||
                            (investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas) <= TOLERANCIA_FECHAMENTO
                          }
                          onClick={selecionarSomenteDiferencaInvestigacao}
                        >
                          {modoTaxasCentavos
                            ? `Modo taxa/centavos • ${moeda(diferencaInvestigacaoAtual)}`
                            : `Selecionar só o que falta • ${moeda(investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas)}`}
                        </button>
                        <button style={s.secondary} disabled={processando || modoTaxasCentavos || !itensBancoInvestigacao.length} onClick={selecionarTodosInvestigacao}>
                          {itensBancoInvestigacao.length > 0 && itensBancoInvestigacao.every(item => selecionadosInvestigacao.includes(item.id))
                            ? "Desmarcar todos"
                            : "Selecionar todos"}
                        </button>
                      </div>
                    </div>

                    {selecionadosInvestigacao.length > 0 && !modoTaxasCentavos && (
                      <div style={s.batchLaunchBox}>
                        <div style={s.batchLaunchHeader}>
                          <strong>Selecionados: {itensSelecionadosInvestigacao.length} • {moeda(totalSelecionadoInvestigacao)}</strong>
                          <span>
                            {(investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas) - totalSelecionadoInvestigacao >= -TOLERANCIA_FECHAMENTO
                              ? `Restará ${moeda(Math.max(0, (investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas) - totalSelecionadoInvestigacao))}`
                              : "Seleção maior que a diferença"}
                          </span>
                        </div>
                        <div style={s.batchLaunchControls}>
                          <label style={s.label}>Plano de contas
                            <select style={s.input} value={planoInvestigacaoId} onChange={e => setPlanoInvestigacaoId(e.target.value)}>
                              <option value="">Selecione</option>
                              {planoContas.map(plano => (
                                <option key={plano.id} value={plano.id}>{plano.nome || plano.descricao || plano.conta}</option>
                              ))}
                            </select>
                          </label>
                          <label style={s.label}>Forma de pagamento
                            <select style={s.input} value={formaInvestigacao} onChange={e => setFormaInvestigacao(e.target.value)}>
                              <option value="">Selecione</option>
                              {formasPagamento.filter(forma => forma.ativo !== false).map(forma => (
                                <option key={forma.id} value={forma.nome}>{forma.nome}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            style={{
                              ...s.primary,
                              ...(
                                processando ||
                                totalSelecionadoInvestigacao - (investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas) > TOLERANCIA_FECHAMENTO
                                  ? s.disabled
                                  : {}
                              ),
                            }}
                            disabled={
                              processando ||
                              totalSelecionadoInvestigacao - (investigacao === "Entrada" ? diferencaEntradas : diferencaSaidas) > TOLERANCIA_FECHAMENTO
                            }
                            onClick={lancarSelecionadosInvestigacao}
                          >
                            {processando ? "Lançando..." : "Lançar selecionados"}
                          </button>
                        </div>
                      </div>
                    )}

                    {!modoTaxasCentavos && selecionadosInvestigacao.length > 0 && restanteInvestigacao > TOLERANCIA_FECHAMENTO && (
                      <div style={{ marginBottom: 12 }}>
                        <button
                          style={s.secondary}
                          type="button"
                          onClick={() => setMostrarAnaliseRestante(atual => !atual)}
                        >
                          {mostrarAnaliseRestante
                            ? "Fechar análise do restante"
                            : `Analisar diferença restante • ${moeda(restanteInvestigacao)}`}
                        </button>
                      </div>
                    )}

                    {exibirAnaliseRestante && restanteInvestigacao > TOLERANCIA_FECHAMENTO && (
                      <div style={{ ...s.investigationTip, marginBottom: 12, border: "1px solid rgba(255, 196, 64, .45)" }}>
                        <strong style={{ display: "block", marginBottom: 6 }}>
                          Análise da diferença restante • {moeda(restanteInvestigacao)}
                        </strong>

                        {analiseRestanteInvestigacao.combinacaoRevisaoExata.length > 0 ? (
                          <div style={{ marginBottom: 8 }}>
                            A Nexa encontrou uma combinação exata entre <b>{analiseRestanteInvestigacao.combinacaoRevisaoExata.length} linha(s) que estavam em revisão</b>.
                            Ela não será selecionada automaticamente, porque pode envolver correspondência, agrupamento ou taxa.
                          </div>
                        ) : (
                          <div style={{ marginBottom: 8 }}>
                            Nenhuma combinação segura explica exatamente esse restante. <b>Não crie um lançamento separado de {moeda(restanteInvestigacao)}</b> sem identificar a origem.
                            O valor pode estar ligado a taxa, arredondamento, diferença de compensação ou a uma linha que ficou em revisão.
                          </div>
                        )}

                        {analiseRestanteInvestigacao.candidatosTaxa.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <strong style={{ display: "block", marginBottom: 6 }}>Possíveis taxas/diferenças próximas</strong>
                            {analiseRestanteInvestigacao.candidatosTaxa.map((candidato, indice) => {
                              const diferenca = Number(candidato.diferencaAssinada || 0)
                              const valor = Math.abs(diferenca)
                              const permiteTaxa = candidato.banco.natureza === "Entrada" && diferenca > 0.01
                              const permiteArredondamento = valor <= LIMITE_MODO_TAXAS_CENTAVOS
                              const podeRevisar = permiteTaxa || permiteArredondamento
                              return (
                                <div key={`${candidato.banco.id}-${candidato.cliente.id}-${indice}`} style={s.adjustmentCandidate}>
                                  <div>
                                    {dataBr(candidato.banco.data)} • {candidato.banco.descricao || "Movimento bancário"}:
                                    {" "}banco {moeda(candidato.banco.valor)} × cliente {moeda(candidato.cliente.valor)} →
                                    {" "}diferença {moeda(valor)}
                                    <small style={{ display: "block", marginTop: 3, color: "#b8d5ea" }}>
                                      {diferenca > 0
                                        ? `O banco recebeu ${moeda(valor)} a menos que o valor registrado pelo cliente.`
                                        : `O banco recebeu ${moeda(valor)} a mais que o valor registrado pelo cliente.`}
                                    </small>
                                  </div>
                                  <button
                                    type="button"
                                    style={s.secondary}
                                    disabled={processando || !podeRevisar}
                                    onClick={() => abrirAjusteConciliacao(candidato)}
                                  >
                                    {podeRevisar ? "Revisar ajuste" : "Revisão manual"}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {ajusteEmRevisao && (
                          <div style={s.adjustmentEditor}>
                            <strong style={{ display: "block", marginBottom: 8 }}>Registrar ajuste com auditoria</strong>
                            <div style={{ marginBottom: 8 }}>
                              Banco {moeda(ajusteEmRevisao.banco.valor)} × cliente {moeda(ajusteEmRevisao.cliente.valor)} • diferença {moeda(ajusteEmRevisao.diferencaValores)}
                            </div>
                            <div style={s.batchLaunchControls}>
                              <label style={s.label}>Tratamento
                                <select style={s.input} value={tipoAjuste} onChange={e => setTipoAjuste(e.target.value)}>
                                  {Math.abs(Number(ajusteEmRevisao.diferencaAssinada || 0)) <= LIMITE_MODO_TAXAS_CENTAVOS && (
                                    <option value="Arredondamento">Arredondamento / compensação</option>
                                  )}
                                  {ajusteEmRevisao.banco.natureza === "Entrada" && Number(ajusteEmRevisao.diferencaAssinada || 0) > 0.01 && (
                                    <option value="Taxa">Taxa / desconto de adquirente</option>
                                  )}
                                </select>
                              </label>

                              {tipoAjuste === "Taxa" && (
                                <label style={s.label}>Plano da despesa
                                  <select style={s.input} value={planoAjusteId} onChange={e => setPlanoAjusteId(e.target.value)}>
                                    <option value="">Selecione</option>
                                    {planoContas.map(plano => (
                                      <option key={`ajuste-plano-${plano.id}`} value={plano.id}>{plano.nome || plano.descricao || plano.conta}</option>
                                    ))}
                                  </select>
                                </label>
                              )}

                              <label style={s.label}>Observação
                                <input
                                  style={s.input}
                                  value={observacaoAjuste}
                                  onChange={e => setObservacaoAjuste(e.target.value)}
                                  placeholder="Ex.: taxa InfinitePay / diferença de liquidação"
                                />
                              </label>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                              <button style={s.primary} disabled={processando} onClick={registrarAjusteConciliacao}>
                                {processando ? "Registrando..." : "Confirmar ajuste"}
                              </button>
                              <button style={s.secondary} disabled={processando} onClick={() => setAjusteEmRevisao(null)}>
                                Cancelar
                              </button>
                            </div>
                            <small style={{ display: "block", marginTop: 8, color: "#b8d5ea" }}>
                              Taxa/desconto gera uma Despesa separada e auditável. Arredondamento/compensação não cria lançamento e é limitado a R$ 1,00.
                            </small>
                          </div>
                        )}

                        {analiseRestanteInvestigacao.linhasRevisao.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <strong style={{ display: "block", marginBottom: 6 }}>
                              Linhas não selecionadas que exigem revisão: {analiseRestanteInvestigacao.linhasRevisao.length}
                            </strong>
                            {analiseRestanteInvestigacao.linhasRevisao.slice(0, 6).map(({ item, analise }) => (
                              <div key={item.id} style={{ marginBottom: 5 }}>
                                {dataBr(item.data)} • {item.descricao || "Movimento"} • {moeda(item.valor)} — {analise.titulo || "Revisar"}
                              </div>
                            ))}
                            {analiseRestanteInvestigacao.linhasRevisao.length > 6 && (
                              <div>+ {analiseRestanteInvestigacao.linhasRevisao.length - 6} linha(s) em revisão abaixo.</div>
                            )}
                          </div>
                        )}

                        {analiseRestanteInvestigacao.candidatosTaxa.length === 0 &&
                          analiseRestanteInvestigacao.combinacaoRevisaoExata.length === 0 && (
                            <div style={{ marginTop: 10 }}>
                              A Nexa não encontrou, entre as linhas em revisão, uma explicação matemática direta para {moeda(restanteInvestigacao)}.
                              Revise especialmente agrupamentos de cartão/adquirente e diferenças de taxa. {modoTaxasCentavos ? "Novos lançamentos em massa permanecem bloqueados." : "Revise antes de lançar o lote."}
                            </div>
                          )}
                      </div>
                    )}

                    <div style={s.investigationList}>
                      {itensBancoInvestigacao.map(item => (
                        <div key={item.id} style={s.investigationItemSelectable}>
                          <input
                            type="checkbox"
                            disabled={modoTaxasCentavos || processando}
                            checked={selecionadosInvestigacao.includes(item.id)}
                            onChange={() => alternarSelecaoInvestigacao(item.id)}
                            aria-label={`Selecionar movimento ${item.id}`}
                          />
                          <span><b>{dataBr(item.data)}</b> • {item.descricao || "Sem descrição"}</span>
                          <strong style={{ color: investigacao === "Entrada" ? "#42f5a7" : "#ff9ba4" }}>{moeda(item.valor)}</strong>
                          <button style={s.justifyButton} disabled={processando} onClick={() => classificarUm(item, "Ignorado")}>Justificar</button>
                        </div>
                      ))}
                      {itensBancoInvestigacao.length === 0 && (
                        <div style={s.empty}>Não há linhas bancárias pendentes dessa natureza. Atualize a conferência ou revise os lançamentos do cliente.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={s.investigationTip}>
                      A diferença está do lado dos Movimentos Clientes. Confira os lançamentos bancários abaixo e corrija os que estiverem duplicados, com valor errado ou lançados no período incorreto.
                    </div>
                    <div style={s.investigationList}>
                      {clienteAindaSemCorrespondencia
                        .filter(item => item.tipo === (investigacao === "Entrada" ? "Receita" : "Despesa"))
                        .slice(0, 30)
                        .map(item => (
                          <div key={item.id} style={s.investigationItem}>
                            <span><b>{dataBr(item.data)}</b> • {item.descricao || item.historico || "Movimento do cliente"}</span>
                            <strong>{moeda(item.valor)}</strong>
                            <span style={s.reviewTag}>Revisar em Movimentos Clientes</span>
                          </div>
                        ))}
                      {clienteAindaSemCorrespondencia.filter(item => item.tipo === (investigacao === "Entrada" ? "Receita" : "Despesa")).length === 0 && (
                        <div style={s.empty}>Nenhum lançamento isolado foi identificado. Atualize a conferência para a Nexa recalcular as correspondências.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={fechamentoAtual ? s.closeDone : totaisBatem ? s.closeReady : s.closeBox}>
              <div>
                <strong>
                  {fechamentoAtual
                    ? `✅ ${competenciaBr(competencia)} concluído`
                    : totaisBatem
                      ? `✅ ${competenciaBr(competencia)} pronto para concluir`
                      : `Fechamento de ${competenciaBr(competencia)}`}
                </strong>
                <span style={s.closeText}>
                  {fechamentoAtual
                    ? `Saldo final registrado: ${moeda(fechamentoAtual.saldoFinal)}`
                    : totaisBatem
                      ? "Entradas e Saídas estão conferidas. O fechamento não depende de conciliar cada linha do extrato."
                      : `Resolva somente as diferenças: Entradas ${moeda(diferencaEntradas)} • Saídas ${moeda(diferencaSaidas)}.`}
                </span>
              </div>
              <div style={s.actions}>
                {!fechamentoAtual && (
                  <button
                    style={{ ...s.primary, ...(processando || !totaisBatem || !movimentos.length ? s.disabled : {}) }}
                    disabled={processando || !totaisBatem || !movimentos.length}
                    onClick={concluirMes}
                  >
                    Concluir mês
                  </button>
                )}
                {fechamentoAtual && <button style={s.small} onClick={() => baixarRelatorio(fechamentoAtual)}>Baixar PDF</button>}
              </div>
            </div>

            {movimentos.length > 0 && (
              <details style={s.auditBox}>
                <summary style={s.auditSummary}>Auditoria avançada <span>uso técnico • linhas do extrato</span></summary>
                <div style={s.auditIntro}>
                  Esta área não faz parte do fluxo normal da conciliação. Use apenas quando precisar auditar uma linha específica do extrato.
                </div>

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
                  <button style={s.refresh} disabled={processando} onClick={carregarExtratos}>Atualizar dados</button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead>
                      <tr><th>Data</th><th>Descrição</th><th>Natureza</th><th>Valor</th><th>Conferência</th><th>Status</th><th>Ação técnica</th></tr>
                    </thead>
                    <tbody>
                      {movimentosVisiveis.map(m => {
                        const conferencia = analiseConciliacao[m.id] || { status: "FALTANDO", titulo: "Sem conferência", detalhe: "" }
                        return (
                          <tr key={m.id} style={estiloLinha(conferencia.status)}>
                            <td>{dataBr(m.data)}</td>
                            <td><strong>{m.descricao}</strong><small style={s.block}>{m.documento || ""}</small></td>
                            <td><span style={m.natureza === "Entrada" ? s.entrada : s.saida}>{m.natureza}</span></td>
                            <td style={{ color: m.natureza === "Entrada" ? "#42f5a7" : "#ff9ba4", fontWeight: 800 }}>{m.natureza === "Saída" ? "- " : "+ "}{moeda(m.valor)}</td>
                            <td><span style={badgeConferencia(conferencia.status)}>{conferencia.titulo}</span></td>
                            <td>{m.statusConciliacao}</td>
                            <td>
                              {!m.lancamentoContabilId && !fechamentoAtual && m.statusConciliacao !== "Ignorado" && (
                                <button style={s.secondary} disabled={processando} onClick={() => classificarUm(m, "Ignorado")}>Justificar</button>
                              )}
                              {m.statusConciliacao === "Ignorado" && <span style={s.reviewTag}>Justificado</span>}
                              {fechamentoAtual && <span style={s.reviewTag}>Mês fechado</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
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

function rotuloDiferenca(valor) {
  const numero = Number(valor || 0)
  if (Math.abs(numero) < 0.01) return "bateu"
  return numero > 0
    ? `faltam ${moeda(numero)} nos lançamentos do cliente`
    : `cliente lançou ${moeda(Math.abs(numero))} a mais`
}

function Campo({ t, children }) { return <label style={s.label}>{t}{children}</label> }
function Resumo({ t, v, cor }) { return <div style={s.summaryItem}><span>{t}</span><strong style={{ color: cor }}>{v}</strong></div> }
function valorBancoConciliavel(item) {
  return Number(item?.valor || 0) + Number(item?.ajusteComparacao || 0)
}

function movimentoClienteEhBancario(item) {
  const observacao = String(item?.observacao || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
  if (observacao.includes("ajuste-conciliacao-bancaria:")) return false

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
  simpleStatus: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 15, marginBottom: 14, borderRadius: 12, background: "#071f43", border: "1px solid #22558d" },
  reconGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginBottom: 14 },
  reconCard: { padding: 17, borderRadius: 14, background: "#071f43", border: "1px solid #22558d" },
  reconCardOk: { borderColor: "#258a72", boxShadow: "inset 0 0 0 1px rgba(60,235,183,.08)" },
  reconCardWarn: { borderColor: "#80652a", boxShadow: "inset 0 0 0 1px rgba(255,196,72,.06)" },
  reconTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, fontSize: 18, fontWeight: 900 },
  reconLine: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", color: "#c3daf0", borderBottom: "1px solid rgba(255,255,255,.06)" },
  reconDifference: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 0 8px", fontSize: 16 },
  statusOk: { padding: "5px 9px", borderRadius: 999, background: "#0d5d4c", color: "#9effdf", fontSize: 11, fontWeight: 900 },
  statusWarn: { padding: "5px 9px", borderRadius: 999, background: "#6d510c", color: "#ffe08a", fontSize: 11, fontWeight: 900 },
  investigateButton: { width: "100%", marginTop: 10, border: "1px solid #36c8e8", borderRadius: 10, padding: "10px 13px", background: "#0b6078", color: "#fff", fontWeight: 900, cursor: "pointer" },
  investigationBox: { padding: 16, marginBottom: 14, borderRadius: 14, background: "#0a2448", border: "1px solid #2d6da6" },
  adjustmentsBox: { padding: 14, marginBottom: 14, borderRadius: 14, background: "rgba(30, 124, 106, .12)", border: "1px solid rgba(66, 245, 167, .35)" },
  adjustmentsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 },
  adjustmentCandidate: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.08)" },
  adjustmentEditor: { marginTop: 12, marginBottom: 12, padding: 12, borderRadius: 10, background: "rgba(7,31,67,.72)", border: "1px solid rgba(66,245,167,.38)" },
  investigationHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 },
  investigationTip: { padding: 11, borderRadius: 10, background: "rgba(53,157,210,.08)", color: "#c6e2f5", fontSize: 12, marginBottom: 10 },
  investigationList: { display: "grid", gap: 7 },
  investigationItem: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", alignItems: "center", gap: 12, padding: 10, borderRadius: 10, background: "#071f43", border: "1px solid rgba(255,255,255,.06)", color: "#d8e7f5" },
  justifyButton: { border: "1px solid #ffc658", borderRadius: 8, padding: "7px 10px", background: "#60470d", color: "#fff2bd", fontWeight: 800, cursor: "pointer" },
  reviewTag: { display: "inline-block", padding: "5px 8px", borderRadius: 999, background: "#234b72", color: "#bfe3ff", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" },
  balanceBox: { padding: 16, marginBottom: 14, borderRadius: 14, background: "#081f43", border: "1px solid #2c6195" },
  balanceHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12, color: "#e8f4ff" },
  balanceTag: { padding: "5px 9px", borderRadius: 999, background: "#154d70", color: "#bfeaff", fontSize: 11, fontWeight: 900 },
  balanceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 },
  balanceCard: { display: "grid", gap: 5, padding: 12, borderRadius: 11, background: "#061a38", border: "1px solid rgba(255,255,255,.07)", color: "#c9ddf2" },
  clientBalanceLine: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10, marginTop: 10 },
  investigationSummary: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 11, marginBottom: 10, borderRadius: 10, background: "#0b315a", color: "#d9ecff" },
  batchLaunchBox: { padding: 12, marginBottom: 10, borderRadius: 11, background: "#0b3a49", border: "1px solid #268c82" },
  batchLaunchHeader: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10, color: "#cffff2" },
  batchLaunchControls: { display: "grid", gridTemplateColumns: "minmax(180px,1fr) minmax(180px,1fr) auto", gap: 10, alignItems: "end" },
  investigationItemSelectable: { display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto auto", alignItems: "center", gap: 12, padding: 10, borderRadius: 10, background: "#071f43", border: "1px solid rgba(255,255,255,.06)", color: "#d8e7f5" },
  closeReady: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 16, marginBottom: 16, borderRadius: 13, background: "#0b4a3e", border: "1px solid #29c98d" },
  auditBox: { marginTop: 16, padding: 12, borderRadius: 12, background: "#071f43", border: "1px solid #1b4774" },
  auditSummary: { cursor: "pointer", color: "#9ebbd8", fontWeight: 800, fontSize: 12 },
  auditIntro: { margin: "12px 0", padding: 10, borderRadius: 9, background: "rgba(255,255,255,.035)", color: "#8fb0cf", fontSize: 11 },
  summaryItem: { display: "flex", flexDirection: "column", gap: 6, padding: 14, background: "#071f43", borderRadius: 12 },
  diffBox: { padding: 14, marginBottom: 14, borderRadius: 12, background: "#071f43", border: "1px solid #22558d" },
  diffHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10, color: "#e8f4ff" },
  diffCountWarn: { padding: "6px 10px", borderRadius: 999, background: "#6b4d09", color: "#ffe08a", fontWeight: 900, fontSize: 12 },
  diffCountOk: { padding: "6px 10px", borderRadius: 999, background: "#0c604f", color: "#caffef", fontWeight: 900, fontSize: 12 },
  diffList: { display: "grid", gap: 8 },
  diffDay: { display: "grid", gridTemplateColumns: "100px minmax(0,1fr) auto", alignItems: "center", gap: 12, padding: 10, borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,196,72,.22)" },
  diffDate: { color: "#fff", fontWeight: 900, whiteSpace: "nowrap" },
  diffValues: { display: "grid", gap: 4, color: "#c9ddf2", fontSize: 12 },
  diffFooter: { marginTop: 10, textAlign: "right", color: "#ffd98c", fontSize: 12 },
  microDiff: { marginTop: 10, padding: 9, borderRadius: 9, background: "rgba(80,170,255,.08)", color: "#b8d9f7", fontSize: 11 },
  diffSuccess: { padding: 12, borderRadius: 10, background: "rgba(30,190,135,.12)", color: "#bfffe9", fontWeight: 700 },
  detailsToggle: { border: "1px solid #2d6ea8", borderRadius: 9, padding: "9px 13px", background: "#0a2a52", color: "#d8ebff", fontWeight: 800, cursor: "pointer" },
  dayFilter: { border: "1px solid #ffc648", borderRadius: 8, padding: "8px 10px", background: "#6b4d09", color: "#fff3c4", fontWeight: 800, cursor: "pointer" },
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
