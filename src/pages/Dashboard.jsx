import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import {
  abrirWhatsAppWeb,
  montarMensagemWhatsApp,
  obterModeloWhatsApp,
  registrarHistoricoWhatsApp,
} from "../services/whatsappService"
import { montarFilaAssistenteDia, montarResumoAssistenteDia } from "../services/assistenteDiaService"
import { carregarJornadaDia, EVENTO_JORNADA_ATUALIZADA } from "../services/jornadaDiaService"
import { montarAlertasIdentidadeDigital, resumirAlertasIdentidade } from "../services/alertasIdentidadeService"
import { verificarProvedores } from "../services/conversaNexaService"
import {
  criarMapaClientesOperacionais,
  filtrarClientesOperacionais,
  localizarClienteOperacional,
} from "../services/clienteOperacionalService"
import Calendar from "react-calendar"
import "react-calendar/dist/Calendar.css"
import {
  FaUsers,
  FaClipboardList,
  FaExclamationTriangle,
  FaFileAlt,
  FaBell,
  FaSyncAlt,
  FaCalendarAlt,
  FaBolt,
  FaKey,
  FaRobot,
  FaComments,
  FaArrowRight,
} from "react-icons/fa"

const API_URL = "https://nexa-erp-api.onrender.com"

export default function Dashboard({ setPage }) {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}")

  const [clientes, setClientes] = useState([])
  const [fiscal, setFiscal] = useState([])
  const [pendencias, setPendencias] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [certificados, setCertificados] = useState([])
  const [procuracoes, setProcuracoes] = useState([])
  const [notificacoes, setNotificacoes] = useState(0)
  const [mostrarCalendario, setMostrarCalendario] = useState(false)
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [progressoDiaSalvo, setProgressoDiaSalvo] = useState({
    acoesConcluidas: {},
    historicoDia: [],
    inicioDia: null,
  })
  const [statusNexaAssist, setStatusNexaAssist] = useState({
    verificando: true,
    groq: { online: false, modelo: "" },
    ollama: { online: false, instalado: false, modelo: "" },
  })

  useEffect(() => {
    carregarDashboard()
    carregarProgressoDia()
    carregarStatusNexaAssist()

    const atualizarAoVoltar = () => carregarProgressoDia()
    window.addEventListener("focus", atualizarAoVoltar)
    window.addEventListener(EVENTO_JORNADA_ATUALIZADA, atualizarAoVoltar)

    return () => {
      window.removeEventListener("focus", atualizarAoVoltar)
      window.removeEventListener(EVENTO_JORNADA_ATUALIZADA, atualizarAoVoltar)
    }
  }, [])

  function carregarProgressoDia() {
    const salvo = carregarJornadaDia()

    setProgressoDiaSalvo({
      acoesConcluidas: salvo.acoesConcluidas,
      historicoDia: salvo.historicoDia,
      inicioDia: salvo.inicioDia,
    })
  }

  async function carregarStatusNexaAssist() {
    try {
      const status = await verificarProvedores()
      setStatusNexaAssist({ verificando: false, ...status })
    } catch (error) {
      console.warn("Não foi possível verificar o status da Nexa Assist", error)
      setStatusNexaAssist((atual) => ({ ...atual, verificando: false }))
    }
  }

  function abrirNexaAssist() {
    if (typeof setPage === "function") setPage("Conversa com a Nexa")
  }

  function abrirAtalhoNexa(pagina) {
    if (typeof setPage === "function") setPage(pagina)
  }

  async function carregarDashboard() {
    try {
      const usuarioSalvo = JSON.parse(localStorage.getItem("usuario"))
      const token = localStorage.getItem("token") || usuarioSalvo?.token

      const [clientesResp, fiscalResp, pendenciasResp, documentosResp, certificadosResp, procuracoesResp] =
        await Promise.all([
          api.get("/clientes"),
          api.get("/fiscal"),
          api.get("/solicitacoes-clientes"),
          api.get("/documentos-digitais"),
          api.get("/certificados-digitais"),
          api.get("/procuracoes-ecac"),
        ])

      setClientes(Array.isArray(clientesResp.data) ? clientesResp.data : [])
      setFiscal(Array.isArray(fiscalResp.data) ? fiscalResp.data : [])
      setPendencias(Array.isArray(pendenciasResp.data) ? pendenciasResp.data : [])
      setDocumentos(Array.isArray(documentosResp.data) ? documentosResp.data : [])
      setCertificados(Array.isArray(certificadosResp.data) ? certificadosResp.data : [])
      setProcuracoes(Array.isArray(procuracoesResp.data) ? procuracoesResp.data : [])

      if (token) {
        const resposta = await fetch(`${API_URL}/notificacoes/contador`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const dados = await resposta.json()
        setNotificacoes(dados.total || 0)
      }
    } catch (error) {
      alert("Erro ao carregar dashboard")
      console.error(error)
    }
  }

  function abrirDestino(item) {
  if (!item || typeof setPage !== "function") {
    console.warn("Dashboard sem setPage ou item inválido", item)
    return
  }

  const destino = item.destino

  if (destino === "Fiscal") {
    localStorage.setItem("nexaFiltroFiscalCliente", item.cliente || "")
    localStorage.setItem("nexaFiltroFiscalId", String(item.referenciaId || ""))
    setPage("Fiscal")
    return
  }

  if (destino === "Documentos Digitais") {
    localStorage.setItem("nexaFiltroDocumentoCliente", item.cliente || "")
    localStorage.setItem("nexaFiltroDocumentoId", String(item.referenciaId || ""))
    setPage("Documentos Digitais")
    return
  }

  if (destino === "Pendências Clientes") {
    localStorage.setItem("nexaFiltroPendenciaCliente", item.cliente || "")
    localStorage.setItem("nexaFiltroPendenciaId", String(item.referenciaId || ""))
    setPage("Pendências Clientes")
    return
  }

  setPage(destino)
}

  function localizarClientePorNome(nomeCliente) {
    const nomeNormalizado = String(nomeCliente || "").trim().toLowerCase()

    if (!nomeNormalizado) return null

    return clientes.find((cliente) => {
      const nomes = [
        cliente.nome,
        cliente.cliente,
        cliente.razaoSocial,
        cliente.nomeFantasia,
        cliente.empresa,
      ]

      return nomes.some(
        (nome) => String(nome || "").trim().toLowerCase() === nomeNormalizado
      )
    }) || null
  }

  function telefoneCliente(cliente) {
    return (
      cliente?.whatsapp ||
      cliente?.celular ||
      cliente?.telefone ||
      cliente?.fone ||
      cliente?.telefone1 ||
      cliente?.telefone2 ||
      ""
    )
  }

  async function enviarWhatsAppAssist(sugestao) {
    const clienteCadastrado = localizarClientePorNome(sugestao.cliente)
    const clienteWhatsApp = clienteCadastrado || {
      nome: sugestao.cliente,
      telefone: sugestao.telefone || "",
    }

    const modelo = obterModeloWhatsApp(sugestao.modeloId)
    const mensagem = montarMensagemWhatsApp({
      modeloId: sugestao.modeloId,
      cliente: clienteWhatsApp,
      clienteNome: sugestao.cliente,
      descricao: sugestao.descricao,
      pendencia: sugestao.pendencia,
      competencia: sugestao.competencia,
      vencimento: sugestao.vencimento,
      valor: sugestao.valor,
      status: sugestao.status,
      mensagem: sugestao.mensagem,
      textoLivre: sugestao.mensagem,
      usuario: usuario?.nome || "Equipe Nexa",
    })

    const abriu = abrirWhatsAppWeb({
      cliente: clienteWhatsApp,
      telefone: telefoneCliente(clienteWhatsApp),
      mensagem,
    })

    if (!abriu) return

    try {
      if (clienteCadastrado?.id) {
        await registrarHistoricoWhatsApp(api, clienteCadastrado, modelo?.titulo, mensagem)
      } else {
        registrarHistoricoWhatsApp({
          cliente: sugestao.cliente,
          modeloTitulo: modelo?.titulo,
          mensagem,
          usuario: usuario?.nome || "Nexa",
        })
      }
    } catch (error) {
      console.warn("WhatsApp aberto, mas o histórico não foi atualizado", error)
    }
  }

  function dataLocalISO(data) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, "0")
    const dia = String(data.getDate()).padStart(2, "0")
    return `${ano}-${mes}-${dia}`
  }

  function diferencaDias(data) {
    if (!data) return null

    const hoje = new Date()
    const alvo = new Date(`${data}T00:00:00`)

    hoje.setHours(0, 0, 0, 0)

    return Math.ceil((alvo - hoje) / (1000 * 60 * 60 * 24))
  }

  function textoPrazo(dias) {
    if (dias === null) return "Sem vencimento"
    if (dias < 0) return `Atrasado há ${Math.abs(dias)} dia(s)`
    if (dias === 0) return "Vence hoje"
    if (dias === 1) return "Vence amanhã"
    return `Vence em ${dias} dias`
  }

  function corPrazo(dias) {
    if (dias === null) return "neutral"
    if (dias < 0) return "danger"
    if (dias <= 1) return "warning"
    return "blue"
  }

  function documentoPendente(item) {
    return (
      item.origem === "Cliente → Escritório" &&
      ["Recebido", "Em análise", "Entregue pelo cliente"].includes(item.status)
    )
  }

  function fiscalAguardandoPagamento(item) {
    const status = String(item.status || "").toLowerCase()

    return (
      !status.includes("pago") &&
      !status.includes("concluído") &&
      !status.includes("concluido") &&
      !status.includes("enviado")
    )
  }

  const clientesOperacionais = useMemo(() => filtrarClientesOperacionais(clientes), [clientes])

  const alertasIdentidade = useMemo(() => montarAlertasIdentidadeDigital({
    clientes,
    certificados,
    procuracoes,
  }), [clientes, certificados, procuracoes])

  const resumoIdentidade = useMemo(() => resumirAlertasIdentidade(alertasIdentidade), [alertasIdentidade])
  const mapaClientesOperacionais = useMemo(() => criarMapaClientesOperacionais(clientes), [clientes])

  function pertenceClienteOperacional(item) {
    return Boolean(localizarClienteOperacional(mapaClientesOperacionais, item?.cliente))
  }

  const resumo = useMemo(() => {
    const fiscalAtivo = fiscal.filter((item) => item.status !== "Concluído" && pertenceClienteOperacional(item))

    const obrigacoesPendentes = fiscalAtivo.filter(
      (item) => item.status === "Pendente" || item.status === "Em andamento"
    ).length

    const aguardandoConferencia = fiscalAtivo.filter(
      (item) => item.status === "Pago pelo cliente"
    ).length

    const emAtraso = fiscalAtivo.filter((item) => {
      const dias = diferencaDias(item.vencimento)
      return dias !== null && dias < 0
    }).length

    const documentosPendentes = documentos.filter((item) => documentoPendente(item) && pertenceClienteOperacional(item)).length

    const aguardandoAcao =
      aguardandoConferencia +
      documentosPendentes +
      pendencias.filter((item) => item.status !== "Concluída" && pertenceClienteOperacional(item)).length

    return {
      clientes: clientesOperacionais.length,
      obrigacoesPendentes,
      aguardandoAcao,
      emAtraso,
      documentosPendentes,
      notificacoes,
    }
  }, [clientesOperacionais, mapaClientesOperacionais, fiscal, pendencias, documentos, notificacoes])

  const prioridades = useMemo(() => {
    const lista = []

    fiscal
      .filter((item) => item.status !== "Concluído" && pertenceClienteOperacional(item))
      .forEach((item) => {
        const dias = diferencaDias(item.vencimento)

        if (dias !== null && dias < 0) {
          lista.push({
            id: `fiscal-atrasado-${item.id}`,
            nivel: "danger",
            peso: 1,
            titulo: item.cliente,
            descricao: `${item.obrigacao || "Obrigação"} ${textoPrazo(dias).toLowerCase()}.`,
            etiqueta: "Atrasado",
            destino: "Fiscal",
            cliente: item.cliente,
            referenciaId: item.id,
          })
        } else if (dias !== null && dias <= 1) {
          lista.push({
            id: `fiscal-urgente-${item.id}`,
            nivel: "warning",
            peso: 2,
            titulo: item.cliente,
            descricao: `${item.obrigacao || "Obrigação"} ${textoPrazo(dias).toLowerCase()}.`,
            etiqueta: "Urgente",
            destino: "Fiscal",
            cliente: item.cliente,
            referenciaId: item.id,
          })
        } else if (dias !== null && dias <= 3) {
          lista.push({
            id: `fiscal-vencendo-${item.id}`,
            nivel: "blue",
            peso: 4,
            titulo: item.cliente,
            descricao: `${item.obrigacao || "Obrigação"} ${textoPrazo(dias).toLowerCase()}.`,
            etiqueta: "Vencendo",
            destino: "Fiscal",
            cliente: item.cliente,
            referenciaId: item.id,
          })
        }

        if (item.status === "Pago pelo cliente") {
          lista.push({
            id: `fiscal-pago-${item.id}`,
            nivel: "success",
            peso: 3,
            titulo: item.cliente,
            descricao: `${item.obrigacao || "Obrigação"} paga pelo cliente. Conferir e concluir.`,
            etiqueta: "Conferir",
            destino: "Fiscal",
            cliente: item.cliente,
            referenciaId: item.id,
          })
        }
      })

    pendencias
      .filter((item) => item.status !== "Concluída" && pertenceClienteOperacional(item))
      .forEach((item) => {
        const data = item.vencimento || item.prazo
        const dias = diferencaDias(data)

        lista.push({
          id: `pendencia-${item.id}`,
          nivel: dias !== null && dias < 0 ? "danger" : "warning",
          peso: dias !== null && dias < 0 ? 1 : 5,
          titulo: item.cliente,
          descricao: `${item.titulo || item.categoria || "Pendência"} ${
            dias !== null ? textoPrazo(dias).toLowerCase() : "aguardando ação."
          }`,
          etiqueta: item.status || "Pendente",
          destino: "Pendências Clientes",
          cliente: item.cliente,
          referenciaId: item.id,
        })
      })

    documentos
      .filter((item) => documentoPendente(item) && pertenceClienteOperacional(item))
      .forEach((item) => {
        lista.push({
          id: `documento-${item.id}`,
          nivel: "blue",
          peso: 6,
          titulo: item.cliente,
          descricao: `${item.tipo || "Documento"} recebido aguardando análise.`,
          etiqueta: item.status || "Recebido",
          destino: "Documentos Digitais",
          cliente: item.cliente,
          referenciaId: item.id,
        })
      })

    return lista.sort((a, b) => a.peso - b.peso).slice(0, 8)
  }, [fiscal, pendencias, documentos])

  const atendimentoDia = useMemo(() => {
    const lista = []

    documentos
      .filter((item) => documentoPendente(item) && pertenceClienteOperacional(item))
      .forEach((item) => {
        lista.push({
          id: `atendimento-doc-${item.id}`,
          icone: "📄",
          cliente: item.cliente,
          texto: `${item.tipo || "Documento"} aguardando análise.`,
          nivel: "blue",
          destino: "Documentos Digitais",
          referenciaId: item.id,
        })
      })

    pendencias
      .filter((item) =>
        ["Respondida", "Visualizada", "Em análise"].includes(item.status) &&
        pertenceClienteOperacional(item)
      )
      .slice(0, 4)
      .forEach((item) => {
        lista.push({
          id: `atendimento-pend-${item.id}`,
          icone: "⚠️",
          cliente: item.cliente,
          texto:
  item.status === "Respondida"
    ? `${item.titulo || item.categoria || "Solicitação"} respondida pelo cliente.`
    : item.titulo || item.categoria || "Solicitação aguardando ação.",
          nivel: "warning",
          destino: "Pendências Clientes",
          referenciaId: item.id,
        })
      })

    return lista.slice(0, 6)
  }, [fiscal, documentos, pendencias])

  const proximosVencimentos = useMemo(() => {
    return fiscal
      .filter((item) => fiscalAguardandoPagamento(item) && pertenceClienteOperacional(item))
      .map((item) => ({
        ...item,
        dias: diferencaDias(item.vencimento),
        destino: "Fiscal",
        cliente: item.cliente,
        referenciaId: item.id,
      }))
      .filter((item) => item.dias !== null)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 7)
  }, [fiscal])

  const documentosRecebidos = useMemo(() => {
    return documentos
      .filter((item) => documentoPendente(item) && pertenceClienteOperacional(item))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6)
      .map((item) => ({
        ...item,
        destino: "Documentos Digitais",
        cliente: item.cliente,
        referenciaId: item.id,
      }))
  }, [documentos])

  const sugestoesWhatsApp = useMemo(() => {
    const lista = []

    fiscal
      .filter((item) => fiscalAguardandoPagamento(item) && pertenceClienteOperacional(item))
      .forEach((item) => {
        const dias = diferencaDias(item.vencimento)
        const cliente = localizarClientePorNome(item.cliente)

        if (dias !== null && dias <= 0) {
          lista.push({
            id: `assist-whatsapp-fiscal-hoje-${item.id}`,
            tipo: "Fiscal",
            prioridade: 1,
            icone: "🚨",
            cliente: item.cliente,
            telefone: telefoneCliente(cliente),
            titulo: "Avisar vencimento de hoje",
            descricao: `${item.obrigacao || "Obrigação"} vence hoje ou está em atraso.`,
            modeloId: "vence_hoje",
            pendencia: item.obrigacao || "Obrigação fiscal",
            competencia: item.competencia,
            vencimento: item.vencimento,
            valor: item.valor,
            status: item.status,
          })
        } else if (dias !== null && dias <= 3) {
          lista.push({
            id: `assist-whatsapp-fiscal-3dias-${item.id}`,
            tipo: "Fiscal",
            prioridade: 2,
            icone: "⏰",
            cliente: item.cliente,
            telefone: telefoneCliente(cliente),
            titulo: "Enviar lembrete de vencimento",
            descricao: `${item.obrigacao || "Obrigação"} vence em ${dias} dia(s).`,
            modeloId: dias === 0 ? "vence_hoje" : "vence_3_dias",
            pendencia: item.obrigacao || "Obrigação fiscal",
            competencia: item.competencia,
            vencimento: item.vencimento,
            valor: item.valor,
            status: item.status,
          })
        } else if (String(item.status || "").toLowerCase().includes("pendente")) {
          lista.push({
            id: `assist-whatsapp-fiscal-das-${item.id}`,
            tipo: "Fiscal",
            prioridade: 4,
            icone: "📄",
            cliente: item.cliente,
            telefone: telefoneCliente(cliente),
            titulo: "Avisar guia disponível",
            descricao: `${item.obrigacao || "Guia"} disponível para o cliente.`,
            modeloId: "das_disponivel",
            pendencia: item.obrigacao || "Guia fiscal",
            competencia: item.competencia,
            vencimento: item.vencimento,
            valor: item.valor,
            status: item.status,
          })
        }
      })

    documentos
      .filter((item) => documentoPendente(item) && pertenceClienteOperacional(item))
      .forEach((item) => {
        const cliente = localizarClientePorNome(item.cliente)

        lista.push({
          id: `assist-whatsapp-doc-${item.id}`,
          tipo: "Documentos",
          prioridade: 3,
          icone: "📂",
          cliente: item.cliente,
          telefone: telefoneCliente(cliente),
          titulo: "Confirmar documento recebido",
          descricao: `${item.tipo || "Documento"} recebido e aguardando análise.`,
          modeloId: "documento_recebido",
          pendencia: item.tipo || "Documento recebido",
          competencia: item.competencia || item.anoCalendario,
          status: item.status,
        })
      })

    pendencias
      .filter((item) => item.status !== "Concluída" && pertenceClienteOperacional(item))
      .forEach((item) => {
        const cliente = localizarClientePorNome(item.cliente)

        lista.push({
          id: `assist-whatsapp-pend-${item.id}`,
          tipo: "Pendência",
          prioridade: 5,
          icone: "📎",
          cliente: item.cliente,
          telefone: telefoneCliente(cliente),
          titulo: "Cobrar pendência do cliente",
          descricao: item.titulo || item.categoria || "Pendência aguardando resposta.",
          modeloId: "documento_pendente",
          pendencia: item.titulo || item.categoria || "Pendência",
          competencia: item.competencia,
          vencimento: item.vencimento || item.prazo,
          status: item.status,
        })
      })

    const vistos = new Set()

    return lista
      .filter((item) => {
        const chave = `${item.cliente}-${item.modeloId}-${item.pendencia}-${item.vencimento}`
        if (vistos.has(chave)) return false
        vistos.add(chave)
        return true
      })
      .sort((a, b) => a.prioridade - b.prioridade)
      .slice(0, 5)
  }, [fiscal, documentos, pendencias, clientes])

  const filaAssistenteDia = useMemo(() => {
    return montarFilaAssistenteDia({
      clientes,
      fiscal,
      pendencias,
      documentos,
      certificados,
      procuracoes,
    })
  }, [clientes, fiscal, pendencias, documentos, certificados, procuracoes])

  const resumoAssistenteDia = useMemo(() => {
    const base = montarResumoAssistenteDia(filaAssistenteDia)
    const totalAcoes = filaAssistenteDia.reduce((total, cliente) => total + cliente.acoes.length, 0)
    const concluidas = filaAssistenteDia.reduce(
      (total, cliente) =>
        total + cliente.acoes.filter((acao) => progressoDiaSalvo.acoesConcluidas?.[acao.id]).length,
      0
    )

    return {
      ...base,
      concluidas,
      progresso: totalAcoes ? Math.round((concluidas / totalAcoes) * 100) : 0,
    }
  }, [filaAssistenteDia, progressoDiaSalvo])

  const painelDiario = useMemo(() => {
    const dasProximos = fiscal.filter((item) => {
      if (!pertenceClienteOperacional(item)) return false
      const obrigacao = String(item.obrigacao || item.tipo || "").toLowerCase()
      const dias = diferencaDias(item.vencimento)
      return obrigacao.includes("das") && dias !== null && dias >= 0 && dias <= 3 && fiscalAguardandoPagamento(item)
    }).length

    const honorariosPendentes = fiscal.filter((item) => {
      if (!pertenceClienteOperacional(item)) return false
      const obrigacao = String(item.obrigacao || item.tipo || "").toLowerCase()
      return obrigacao.includes("honor") && fiscalAguardandoPagamento(item)
    }).length

    const parcelamentos = fiscal.filter((item) => {
      if (!pertenceClienteOperacional(item)) return false
      const obrigacao = String(item.obrigacao || item.tipo || "").toLowerCase()
      const dias = diferencaDias(item.vencimento)
      return obrigacao.includes("parcel") && dias !== null && dias <= 3 && fiscalAguardandoPagamento(item)
    }).length

    const oportunidades = clientesOperacionais.filter((cliente) => {
      const nota = Number(cliente.saudeTributaria || cliente.indiceSaudeTributaria || 100)
      const fatorR = Number(cliente.fatorRAtual || cliente.fatorR || 100)
      return nota < 75 || (fatorR > 0 && fatorR < 28)
    }).length

    const primeiro = filaAssistenteDia[0] || null

    return {
      criticos: resumoAssistenteDia.urgentes,
      hoje: filaAssistenteDia.filter((cliente) =>
        cliente.acoes.some((acao) => diferencaDias(acao.data) === 0)
      ).length,
      dasProximos,
      honorariosPendentes,
      documentosPendentes: resumo.documentosPendentes,
      parcelamentos,
      oportunidades,
      alertasIdentidade: resumoIdentidade.total,
      primeiro,
    }
  }, [clientesOperacionais, mapaClientesOperacionais, fiscal, filaAssistenteDia, resumoAssistenteDia, resumo.documentosPendentes, resumoIdentidade])

  const eventosCalendario = useMemo(() => {
    const eventos = {}

    function adicionar(data, evento) {
      if (!data) return

      if (!eventos[data]) {
        eventos[data] = []
      }

      eventos[data].push(evento)
    }

    fiscal.forEach((item) => {
      if (!pertenceClienteOperacional(item) || !item.vencimento) return

      const dias = diferencaDias(item.vencimento)

      adicionar(item.vencimento, {
        tipo: item.status === "Concluído" ? "success" : corPrazo(dias),
        titulo: item.cliente,
        descricao: `${item.obrigacao || "Obrigação"} - ${
          item.status === "Concluído" ? "Concluído" : textoPrazo(dias)
        }`,
        destino: "Fiscal",
        cliente: item.cliente,
        referenciaId: item.id,
      })
    })

    documentos
      .filter((item) => documentoPendente(item) && pertenceClienteOperacional(item))
      .forEach((item) => {
        const data = String(item.createdAt || "").slice(0, 10)

        adicionar(data, {
          tipo: "document",
          titulo: item.cliente,
          descricao: `${item.tipo || "Documento"} recebido`,
          destino: "Documentos Digitais",
          cliente: item.cliente,
          referenciaId: item.id,
        })
      })

    return eventos
  }, [fiscal, documentos])

  const eventosDiaSelecionado =
    eventosCalendario[dataLocalISO(dataSelecionada)] || []

  function dataExtenso() {
    return new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  }

  function nomeUsuario() {
    return usuario?.nome?.split(" ")[0] || "Fabio"
  }

  return (
    <div className="dashboard-page">
      <style>{`
        .dashboard-page { color: white; }

        .calendar-popup {
          position: absolute;
          top: 58px;
          right: 0;
          z-index: 9999;
          width: 350px;
          background: #061f47;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 18px 45px rgba(0,0,0,.35);
          padding: 14px;
        }

        .react-calendar {
          width: 100%;
          background: transparent;
          border: none;
          color: white;
          font-family: Arial, sans-serif;
        }

        .react-calendar__navigation button {
          color: white;
          background: transparent;
          font-weight: 800;
        }

        .react-calendar__month-view__weekdays {
          color: #a9b8cc;
          font-size: 11px;
        }

        .react-calendar__tile {
          background: transparent;
          color: white;
          border-radius: 10px;
          min-height: 46px;
          position: relative;
        }

        .react-calendar__tile:hover,
        .react-calendar__tile--active {
          background: rgba(0,168,255,.25) !important;
        }

        .calendar-markers {
          display: flex;
          justify-content: center;
          gap: 3px;
          margin-top: 3px;
        }

        .calendar-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .calendar-day-list {
          margin-top: 12px;
          border-top: 1px solid rgba(255,255,255,.12);
          padding-top: 12px;
          display: grid;
          gap: 8px;
        }

        .calendar-day-item {
          background: rgba(255,255,255,.06);
          border-radius: 12px;
          padding: 10px;
          font-size: 12px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,.08);
        }

        .calendar-day-item:hover {
          border-color: rgba(55,255,116,.35);
        }

        .calendar-day-item strong {
          display: block;
          margin-bottom: 4px;
        }

        .dash-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 22px;
          gap: 20px;
        }

        .dash-title {
          font-size: 30px;
          font-weight: 900;
          margin: 0 0 8px;
        }

        .dash-date {
          color: #a9b8cc;
          font-size: 15px;
          text-transform: capitalize;
        }

        .dash-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .date-arrow {
          font-size: 13px;
          color: #a9b8cc;
          margin-left: 4px;
        }

        .date-box {
          height: 44px;
          border-radius: 14px;
          background: #061f47;
          border: 1px solid rgba(255,255,255,.12);
          padding: 0 16px;
          color: white;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .refresh {
          height: 44px;
          border: none;
          border-radius: 14px;
          padding: 0 18px;
          background: linear-gradient(90deg,#00a8ff,#37ff74);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .card {
          background: #123d78;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          padding: 16px;
          min-height: 96px;
          box-shadow: 0 8px 24px rgba(0,0,0,.12);
        }

        .card-icon {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          background: #061f47;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          font-size: 16px;
        }

        .card-label {
          color: #a9b8cc;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .card-value {
          font-size: 22px;
          font-weight: 900;
        }

        .grid-main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 12px 35px rgba(0,0,0,.12);
        }

        .box-title {
          font-size: 21px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .priority-list,
        .due-list,
        .doc-list,
        .service-list {
          display: grid;
          gap: 12px;
        }

        .priority-item,
        .due-item,
        .doc-item,
        .service-item {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 16px;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
        }

        .clickable-card {
          width: 100%;
          text-align: left;
          color: white;
          cursor: pointer;
          font-family: inherit;
        }

        .clickable-card:hover {
          border-color: rgba(55,255,116,.35);
          transform: translateY(-1px);
          transition: .2s;
        }

        .item-main strong {
          display: block;
          margin-bottom: 5px;
          font-size: 15px;
        }

        .item-main span {
          color: #a9b8cc;
          font-size: 13px;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }

        .item-left {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .tag {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .danger { color: #ff4d4f; }
        .warning { color: #ffc107; }
        .success { color: #37ff74; }
        .blue { color: #00a8ff; }
        .neutral { color: #a9b8cc; }
        .document { color: #b388ff; }

        .bg-danger { background: #ff4d4f; color: white; }
        .bg-warning { background: #ffc107; color: #00112b; }
        .bg-success { background: #37ff74; color: #00112b; }
        .bg-blue { background: #00a8ff; color: white; }
        .bg-neutral { background: rgba(255,255,255,.14); color: white; }
        .bg-document { background: #b388ff; color: #00112b; }

        .nexa-assist-dashboard {
          position: relative;
          overflow: hidden;
          margin-bottom: 24px;
          background: linear-gradient(135deg, #071f48 0%, #0a3265 52%, rgba(0,168,255,.24) 78%, rgba(55,255,116,.16) 100%);
          border: 1px solid rgba(0,168,255,.38);
          border-radius: 26px;
          padding: 25px;
          box-shadow: 0 18px 45px rgba(0,0,0,.22);
        }

        .nexa-assist-dashboard::after {
          content: "";
          position: absolute;
          width: 240px;
          height: 240px;
          right: -90px;
          top: -110px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(55,255,116,.20), transparent 68%);
          pointer-events: none;
        }

        .nexa-assist-main {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 22px;
          align-items: center;
        }

        .nexa-assist-brand { display: flex; gap: 16px; align-items: flex-start; }
        .nexa-assist-logo {
          width: 54px;
          height: 54px;
          flex: 0 0 54px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
          color: #00112b;
          background: linear-gradient(135deg, #00a8ff, #37ff74);
          box-shadow: 0 10px 26px rgba(0,168,255,.28);
        }

        .nexa-assist-kicker { color: #37ff74; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
        .nexa-assist-heading { margin: 5px 0 7px; font-size: 25px; font-weight: 900; }
        .nexa-assist-description { color: #c8d7eb; line-height: 1.45; margin: 0; max-width: 720px; }
        .nexa-assist-statuses { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
        .nexa-status-pill { border-radius: 999px; padding: 7px 10px; font-size: 12px; font-weight: 900; border: 1px solid rgba(255,255,255,.12); background: rgba(1,17,43,.68); }
        .nexa-status-online { color: #37ff74; border-color: rgba(55,255,116,.28); }
        .nexa-status-local { color: #00c8ff; border-color: rgba(0,200,255,.28); }
        .nexa-status-offline { color: #ffc107; border-color: rgba(255,193,7,.28); }

        .nexa-assist-open {
          position: relative;
          z-index: 1;
          border: none;
          border-radius: 15px;
          min-height: 48px;
          padding: 0 19px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(90deg, #00a8ff, #37ff74);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .nexa-assist-shortcuts {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 19px;
        }

        .nexa-shortcut {
          border: 1px solid rgba(255,255,255,.11);
          border-radius: 14px;
          padding: 12px;
          background: rgba(1,17,43,.66);
          color: white;
          text-align: left;
          cursor: pointer;
          font-weight: 800;
          min-height: 44px;
        }

        .nexa-shortcut:hover { border-color: rgba(55,255,116,.38); transform: translateY(-1px); transition: .2s; }

        .nexa-daily-panel {
          margin-bottom: 24px;
          background: linear-gradient(135deg, #071f48 0%, #0c3970 58%, rgba(55,255,116,.14) 100%);
          border: 1px solid rgba(55,255,116,.28);
          border-radius: 26px;
          padding: 25px;
          box-shadow: 0 18px 45px rgba(0,0,0,.22);
        }

        .nexa-daily-head {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .nexa-kicker { color: #37ff74; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
        .nexa-daily-title { margin: 7px 0 5px; font-size: 25px; font-weight: 900; }
        .nexa-daily-copy { color: #c8d7eb; max-width: 720px; line-height: 1.45; margin: 0; }
        .nexa-daily-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 11px; margin-top: 20px; }
        .nexa-daily-metric { background: rgba(1,17,43,.68); border: 1px solid rgba(255,255,255,.10); border-radius: 16px; padding: 14px; }
        .nexa-daily-metric span { display: block; color: #9fb2ca; font-size: 12px; margin-bottom: 6px; }
        .nexa-daily-metric strong { font-size: 23px; font-weight: 900; }
        .nexa-recommendation { margin-top: 15px; display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap; background: rgba(1,17,43,.72); border-radius: 17px; padding: 15px; border: 1px solid rgba(255,255,255,.10); }
        .nexa-recommendation small { display: block; color: #9fb2ca; margin-bottom: 5px; }
        .nexa-recommendation strong { display: block; font-size: 16px; }
        .nexa-progress-line { margin-top: 17px; }
        .nexa-progress-label { display: flex; justify-content: space-between; color: #c8d7eb; font-size: 12px; margin-bottom: 7px; }

        .dia-box {
          margin-bottom: 24px;
          background: linear-gradient(135deg, rgba(0,168,255,.18), rgba(55,255,116,.10));
          border: 1px solid rgba(55,255,116,.26);
        }

        .dia-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .dia-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .dia-stat {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 16px;
          padding: 13px;
        }

        .dia-stat span {
          display: block;
          color: #a9b8cc;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .dia-stat strong {
          display: block;
          font-size: 22px;
          font-weight: 900;
        }

        .dia-progress {
          background: #061f47;
          border-radius: 999px;
          height: 10px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .dia-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #00a8ff, #37ff74);
        }

        .dia-action {
          border: none;
          border-radius: 14px;
          padding: 12px 18px;
          background: linear-gradient(90deg, #00a8ff, #37ff74);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
        }

        .dia-next {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 16px;
          padding: 14px;
          color: #dce8f8;
          font-size: 13px;
        }

        .assist-box {
          margin-bottom: 24px;
          background: linear-gradient(135deg, rgba(0,168,255,.16), rgba(55,255,116,.10));
          border: 1px solid rgba(55,255,116,.24);
        }

        .assist-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .assist-subtitle {
          color: #a9b8cc;
          font-size: 13px;
          margin-top: 5px;
        }

        .assist-badge {
          border-radius: 999px;
          padding: 8px 11px;
          background: rgba(55,255,116,.16);
          color: #37ff74;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .assist-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 12px;
        }

        .assist-item {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 16px;
          padding: 15px;
          display: grid;
          gap: 12px;
        }

        .assist-item-top {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .assist-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          background: rgba(55,255,116,.14);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 18px;
        }

        .assist-client {
          display: block;
          font-size: 15px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .assist-text {
          display: block;
          color: #a9b8cc;
          font-size: 13px;
          line-height: 1.35;
        }

        .assist-action {
          border: none;
          border-radius: 12px;
          padding: 10px 12px;
          background: linear-gradient(90deg, #00a8ff, #37ff74);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
          width: 100%;
        }

        .empty {
          color: #a9b8cc;
          padding: 18px;
          background: #061f47;
          border-radius: 16px;
        }

        @media (max-width: 1100px) {
          .grid-main {
            grid-template-columns: 1fr;
          }

          .dash-header {
            flex-direction: column;
          }

          .nexa-assist-main { grid-template-columns: 1fr; }
          .nexa-assist-open { width: 100%; justify-content: center; }
          .nexa-assist-shortcuts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 620px) {
          .nexa-assist-dashboard { padding: 19px; }
          .nexa-assist-brand { gap: 12px; }
          .nexa-assist-logo { width: 46px; height: 46px; flex-basis: 46px; border-radius: 15px; }
          .nexa-assist-heading { font-size: 21px; }
          .nexa-assist-shortcuts { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dash-header">
        <div>
          <h1 className="dash-title">Bom dia, {nomeUsuario()}! 👋</h1>
          <div className="dash-date">{dataExtenso()}</div>
        </div>

        <div className="dash-actions">
          <div style={{ position: "relative" }}>
            <div
              className="date-box"
              title="Calendário operacional"
              onClick={() => setMostrarCalendario(!mostrarCalendario)}
            >
              <FaCalendarAlt />
              {dataSelecionada.toLocaleDateString("pt-BR")}
              <span className="date-arrow">▾</span>
            </div>

            {mostrarCalendario && (
              <div className="calendar-popup">
                <Calendar
                  onChange={(data) => setDataSelecionada(data)}
                  value={dataSelecionada}
                  tileContent={({ date, view }) => {
                    if (view !== "month") return null

                    const eventos = eventosCalendario[dataLocalISO(date)] || []

                    if (eventos.length === 0) return null

                    return (
                      <div className="calendar-markers">
                        {eventos.slice(0, 4).map((evento, index) => (
                          <span
                            key={index}
                            className={`calendar-dot bg-${evento.tipo}`}
                            title={`${evento.titulo} - ${evento.descricao}`}
                          />
                        ))}
                      </div>
                    )
                  }}
                />

                <div className="calendar-day-list">
                  {eventosDiaSelecionado.length === 0 ? (
                    <div className="calendar-day-item">
                      Nenhum evento para este dia.
                    </div>
                  ) : (
                    eventosDiaSelecionado.map((evento, index) => (
                      <button
                        type="button"
                        className="calendar-day-item"
                        key={index}
                        onClick={() => abrirDestino(evento)}
                      >
                        <strong>{evento.titulo}</strong>
                        <span>{evento.descricao}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="refresh" onClick={carregarDashboard}>
            <FaSyncAlt />
            Atualizar
          </button>
        </div>
      </div>

      <section className="nexa-assist-dashboard">
        <div className="nexa-assist-main">
          <div className="nexa-assist-brand">
            <div className="nexa-assist-logo"><FaRobot /></div>
            <div>
              <div className="nexa-assist-kicker">Nexa Assist</div>
              <h2 className="nexa-assist-heading">Sua assistente inteligente está pronta.</h2>
              <p className="nexa-assist-description">
                Converse com a Nexa, consulte clientes e pendências ou use comandos para abrir qualquer área do sistema.
              </p>
              <div className="nexa-assist-statuses">
                {statusNexaAssist.verificando ? (
                  <span className="nexa-status-pill nexa-status-offline">Verificando conexão...</span>
                ) : (
                  <>
                    <span className={`nexa-status-pill ${statusNexaAssist.groq?.online ? "nexa-status-online" : "nexa-status-offline"}`}>
                      {statusNexaAssist.groq?.online ? "Groq online" : "Groq indisponível"}
                    </span>
                    <span className={`nexa-status-pill ${statusNexaAssist.ollama?.online && statusNexaAssist.ollama?.instalado ? "nexa-status-local" : "nexa-status-offline"}`}>
                      {statusNexaAssist.ollama?.online && statusNexaAssist.ollama?.instalado ? "Ollama local disponível" : "Ollama local em espera"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button type="button" className="nexa-assist-open" onClick={abrirNexaAssist}>
            <FaComments />
            Conversar com a Nexa
            <FaArrowRight />
          </button>
        </div>

        <div className="nexa-assist-shortcuts">
          <button type="button" className="nexa-shortcut" onClick={() => abrirAtalhoNexa("Assistente do Dia")}>Iniciar meu dia</button>
          <button type="button" className="nexa-shortcut" onClick={() => abrirAtalhoNexa("Pendências Clientes")}>Ver pendências</button>
          <button type="button" className="nexa-shortcut" onClick={() => abrirAtalhoNexa("Clientes")}>Abrir clientes</button>
          <button type="button" className="nexa-shortcut" onClick={() => abrirAtalhoNexa("Fiscal")}>Próximos vencimentos</button>
        </div>
      </section>

      <section className="nexa-daily-panel">
        <div className="nexa-daily-head">
          <div>
            <div className="nexa-kicker">Painel Diário da Nexa</div>
            <h2 className="nexa-daily-title">Eu já organizei as prioridades do escritório.</h2>
            <p className="nexa-daily-copy">
              {painelDiario.criticos > 0
                ? `Encontrei ${painelDiario.criticos} cliente(s) que exigem atenção imediata.`
                : "Não encontrei pendências críticas. Podemos seguir a fila planejada com tranquilidade."}
            </p>
          </div>

          <button type="button" className="dia-action" onClick={() => setPage("Assistente do Dia")}>
            {resumoAssistenteDia.progresso > 0 ? "Continuar meu dia" : "Começar atendimento"}
          </button>
        </div>

        <div className="nexa-daily-grid">
          <div className="nexa-daily-metric"><span>Clientes críticos</span><strong className="danger">{painelDiario.criticos}</strong></div>
          <div className="nexa-daily-metric"><span>Atendimentos hoje</span><strong className="warning">{painelDiario.hoje}</strong></div>
          <div className="nexa-daily-metric"><span>DAS em até 3 dias</span><strong className="blue">{painelDiario.dasProximos}</strong></div>
          <div className="nexa-daily-metric"><span>Honorários pendentes</span><strong className="warning">{painelDiario.honorariosPendentes}</strong></div>
          <div className="nexa-daily-metric"><span>Documentos pendentes</span><strong className="success">{painelDiario.documentosPendentes}</strong></div>
          <div className="nexa-daily-metric"><span>Parcelamentos próximos</span><strong className="blue">{painelDiario.parcelamentos}</strong></div>
          <div className="nexa-daily-metric"><span>Radar tributário</span><strong className="success">{painelDiario.oportunidades}</strong></div>
          <div className="nexa-daily-metric"><span>Identidade digital</span><strong className="warning">{painelDiario.alertasIdentidade}</strong></div>
        </div>

        <div className="nexa-progress-line">
          <div className="nexa-progress-label">
            <span>Progresso do expediente</span>
            <strong>{resumoAssistenteDia.concluidas || 0}/{resumoAssistenteDia.acoes || 0} ações • {resumoAssistenteDia.progresso}%</strong>
          </div>
          <div className="dia-progress">
            <div className="dia-progress-bar" style={{ width: `${resumoAssistenteDia.progresso}%` }} />
          </div>
        </div>

        <div className="nexa-recommendation">
          <div>
            <small>Próximo cliente recomendado</small>
            <strong>
              {painelDiario.primeiro
                ? `${painelDiario.primeiro.cliente} — ${painelDiario.primeiro.motivos?.[0] || "atendimento prioritário"}`
                : "Nenhum atendimento pendente no momento."}
            </strong>
          </div>
          {progressoDiaSalvo.historicoDia?.[0] && (
            <small>Última ação: {progressoDiaSalvo.historicoDia[0].hora} • {progressoDiaSalvo.historicoDia[0].texto}</small>
          )}
        </div>
      </section>

      <div className="cards">
        <ResumoCard icon={<FaUsers />} label="Clientes Ativos" value={resumo.clientes} color="blue" />
        <ResumoCard icon={<FaClipboardList />} label="Obrigações Pendentes" value={resumo.obrigacoesPendentes} color="warning" />
        <ResumoCard icon={<FaBolt />} label="Aguardando Ação" value={resumo.aguardandoAcao} color="warning" />
        <ResumoCard icon={<FaExclamationTriangle />} label="Em Atraso" value={resumo.emAtraso} color="danger" />
        <ResumoCard icon={<FaFileAlt />} label="Documentos Pendentes" value={resumo.documentosPendentes} color="success" />
        <ResumoCard icon={<FaBell />} label="Notificações" value={resumo.notificacoes} color="warning" />
        <ResumoCard icon={<FaKey />} label="Alertas Digitais" value={resumoIdentidade.total} color="warning" />
      </div>

      <section className="box dia-box">
        <div className="dia-row">
          <div>
            <div className="box-title" style={{ marginBottom: 0 }}>☀️ Assistente do Dia</div>
            <div className="assist-subtitle">
              Fila operacional montada com dados reais do Fiscal, Documentos e Atendimento.
            </div>
          </div>

          <button type="button" className="dia-action" onClick={() => setPage("Assistente do Dia")}>
            Iniciar o Dia
          </button>
        </div>

        <div className="dia-progress">
          <div className="dia-progress-bar" style={{ width: `${resumoAssistenteDia.progresso}%` }} />
        </div>

        <div className="dia-stats">
          <div className="dia-stat"><span>Urgentes</span><strong className="danger">{resumoAssistenteDia.urgentes}</strong></div>
          <div className="dia-stat"><span>Atenção</span><strong className="warning">{resumoAssistenteDia.atencao}</strong></div>
          <div className="dia-stat"><span>Programados</span><strong className="success">{resumoAssistenteDia.programados}</strong></div>
          <div className="dia-stat"><span>Ações reais</span><strong className="blue">{resumoAssistenteDia.acoes}</strong></div>
        </div>

        {filaAssistenteDia[0] ? (
          <div className="dia-next">
            Primeiro cliente: <strong>{filaAssistenteDia[0].cliente}</strong> • {filaAssistenteDia[0].motivos[0]}
          </div>
        ) : (
          <div className="dia-next">Nenhuma ação real encontrada para hoje.</div>
        )}
      </section>

      <section className="box assist-box">
        <div className="assist-title-row">
          <div>
            <div className="box-title" style={{ marginBottom: 0 }}>🤖 Nexa Assist WhatsApp</div>
            <div className="assist-subtitle">
              Sugestões automáticas para avisar clientes sem precisar escolher o modelo manualmente.
            </div>
          </div>
          <span className="assist-badge">v3 em teste</span>
        </div>

        {sugestoesWhatsApp.length === 0 ? (
          <div className="empty">Nenhuma sugestão de WhatsApp no momento.</div>
        ) : (
          <div className="assist-list">
            {sugestoesWhatsApp.map((item) => {
              const modelo = obterModeloWhatsApp(item.modeloId)

              return (
                <div className="assist-item" key={item.id}>
                  <div className="assist-item-top">
                    <span className="assist-icon">{item.icone}</span>
                    <div>
                      <strong className="assist-client">{item.cliente}</strong>
                      <span className="assist-text">
                        {item.titulo} • Modelo sugerido: {modelo?.titulo || "WhatsApp"}
                      </span>
                      <span className="assist-text">{item.descricao}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="assist-action"
                    onClick={() => enviarWhatsAppAssist(item)}
                  >
                    Abrir WhatsApp com mensagem sugerida
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid-main">
        <section className="box">
          <div className="box-title">🚨 Prioridades do Dia</div>

          <div className="priority-list">
            {prioridades.length === 0 ? (
              <div className="empty">Nenhuma prioridade crítica no momento.</div>
            ) : (
              prioridades.map((item) => (
                <button
                  type="button"
                  className="priority-item clickable-card"
                  key={item.id}
                  onClick={() => abrirDestino(item)}
                >
                  <div className="item-left">
                    <span className={`dot bg-${item.nivel}`} />
                    <div className="item-main">
                      <strong>{item.titulo}</strong>
                      <span>{item.descricao}</span>
                    </div>
                  </div>

                  <span className={`tag bg-${item.nivel}`}>{item.etiqueta}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="box">
          <div className="box-title">⏰ Próximos Vencimentos</div>

          <div className="due-list">
            {proximosVencimentos.length === 0 ? (
              <div className="empty">Nenhum vencimento próximo.</div>
            ) : (
              proximosVencimentos.map((item) => (
                <button
                  type="button"
                  className="due-item clickable-card"
                  key={item.id}
                  onClick={() => abrirDestino(item)}
                >
                  <div className="item-main">
                    <strong>{item.cliente}</strong>
                    <span>
                      {item.obrigacao} • Competência: {item.competencia || "-"}
                    </span>
                  </div>

                  <span className={`tag bg-${corPrazo(item.dias)}`}>
                    {textoPrazo(item.dias)}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid-main">
        <section className="box">
          <div className="box-title">📞 Atendimento do Dia</div>

          <div className="service-list">
            {atendimentoDia.length === 0 ? (
              <div className="empty">Nenhum atendimento pendente no momento.</div>
            ) : (
              atendimentoDia.map((item) => (
                <button
                  type="button"
                  className="service-item clickable-card"
                  key={item.id}
                  onClick={() => abrirDestino(item)}
                >
                  <div className="item-main">
                    <strong>
                      {item.icone} {item.cliente}
                    </strong>
                    <span>{item.texto}</span>
                  </div>

                  <span className={`tag bg-${item.nivel}`}>Resolver</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="box">
          <div className="box-title">📄 Documentos Recebidos</div>

          <div className="doc-list">
            {documentosRecebidos.length === 0 ? (
              <div className="empty">Nenhum documento recebido aguardando tratamento.</div>
            ) : (
              documentosRecebidos.map((item) => (
                <button
                  type="button"
                  className="doc-item clickable-card"
                  key={item.id}
                  onClick={() => abrirDestino(item)}
                >
                  <div className="item-main">
                    <strong>{item.cliente}</strong>
                    <span>
                      {item.tipo} •{" "}
                      {item.anoCalendario || item.competencia || "Sem competência"}
                    </span>
                  </div>

                  <span className="tag bg-blue">{item.status || "Recebido"}</span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ResumoCard({ icon, label, value, color }) {
  return (
    <div className="card">
      <div className={`card-icon ${color}`}>{icon}</div>
      <div className="card-label">{label}</div>
      <div className={`card-value ${color}`}>{value}</div>
    </div>
  )
}