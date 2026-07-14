import { filtrarClientesOperacionais } from "./clienteOperacionalService"

const PREFIXO_CHAVE = "nexa_planejamento_anual"

function texto(valor) {
  return String(valor || "").trim()
}

function normalizar(valor) {
  return texto(valor).toLowerCase()
}

function nomeCliente(cliente = {}) {
  return (
    cliente.nome ||
    cliente.cliente ||
    cliente.razaoSocial ||
    cliente.nomeFantasia ||
    cliente.empresa ||
    "Cliente sem nome"
  )
}

function clienteId(cliente = {}) {
  return cliente.id || cliente.clienteId || cliente.idCliente || nomeCliente(cliente)
}

function dataValida(ano, mes, dia) {
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const diaSeguro = Math.max(1, Math.min(Number(dia) || 1, ultimoDia))
  return `${ano}-${String(mes).padStart(2, "0")}-${String(diaSeguro).padStart(2, "0")}`
}

function chavePlanejamento(ano) {
  return `${PREFIXO_CHAVE}_${ano}`
}

function lerPlanejamento(ano) {
  try {
    const salvo = JSON.parse(localStorage.getItem(chavePlanejamento(ano)) || "[]")
    return Array.isArray(salvo) ? salvo : []
  } catch (error) {
    console.warn("Não foi possível ler o planejamento anual", error)
    return []
  }
}

function salvarPlanejamento(ano, eventos) {
  localStorage.setItem(chavePlanejamento(ano), JSON.stringify(eventos))
  return eventos
}

function obterParcelamento(item = {}) {
  if (item.parcelamento && typeof item.parcelamento === "object") return item.parcelamento

  const observacao = texto(item.observacao)
  const bloco = observacao.match(/\[PARCELAMENTO\]([\s\S]*?)\[\/PARCELAMENTO\]/i)
  if (!bloco) return null

  const conteudo = bloco[1]
  const parcela = conteudo.match(/Parcela:\s*(\d+|-)\/(\d+|-)/i)
  const dia = conteudo.match(/Vencimento recorrente:\s*dia\s*(\d+|-)/i)
  const orgao = conteudo.match(/Órgão:\s*(.*)/i)
  const descricao = conteudo.match(/Descrição:\s*(.*)/i)

  return {
    parcelaAtual: parcela?.[1] === "-" ? "" : parcela?.[1] || "",
    totalParcelas: parcela?.[2] === "-" ? "" : parcela?.[2] || "",
    diaVencimento: dia?.[1] === "-" ? "" : dia?.[1] || "",
    orgao: orgao?.[1]?.trim() || "Receita Federal",
    descricao: descricao?.[1]?.trim() || "Parcelamento",
  }
}

function eventoBase({ id, cliente, tipo, titulo, data, modulo, prioridade = 30, referenciaId = null, detalhes = "" }) {
  return {
    id,
    cliente: nomeCliente(cliente),
    clienteId: clienteId(cliente),
    clienteDados: cliente,
    tipo,
    titulo,
    data,
    modulo,
    prioridade,
    referenciaId,
    detalhes,
    status: "pendente",
    origem: "planejamento-anual",
    criadoEm: new Date().toISOString(),
  }
}

function eventosMensaisCliente(cliente, ano, configuracao = {}) {
  const regime = normalizar(cliente.regimeTributario || cliente.regime)
  const eventos = []
  const diaDas = Number(configuracao.diaDas || cliente.diaVencimentoDas || 20)
  const diaHonorarios = Number(configuracao.diaHonorarios || cliente.diaVencimentoHonorarios || 5)
  const diaDocumentos = Number(configuracao.diaDocumentos || cliente.diaEntregaDocumentos || 10)

  for (let mes = 1; mes <= 12; mes += 1) {
    const competencia = `${String(mes).padStart(2, "0")}/${ano}`

    if (regime.includes("mei") || regime.includes("simples")) {
      eventos.push(eventoBase({
        id: `plano-${clienteId(cliente)}-${ano}-${mes}-das`,
        cliente,
        tipo: "Fiscal",
        titulo: regime.includes("mei") ? `DAS MEI • ${competencia}` : `DAS Simples Nacional • ${competencia}`,
        data: dataValida(ano, mes, diaDas),
        modulo: "Fiscal",
        prioridade: 55,
        detalhes: "Conferir apuração, disponibilizar a guia e comunicar o cliente.",
      }))
    }

    if (regime.includes("simples")) {
      eventos.push(eventoBase({
        id: `plano-${clienteId(cliente)}-${ano}-${mes}-pgdas`,
        cliente,
        tipo: "Fiscal",
        titulo: `Conferir PGDAS-D • ${competencia}`,
        data: dataValida(ano, mes, Math.max(1, diaDas - 3)),
        modulo: "Fiscal",
        prioridade: 48,
        detalhes: "Revisar receitas, anexo, faixa e alíquota antes do vencimento do DAS.",
      }))
    }

    if (regime.includes("presumido") || regime.includes("real")) {
      eventos.push(eventoBase({
        id: `plano-${clienteId(cliente)}-${ano}-${mes}-apuracao`,
        cliente,
        tipo: "Fiscal",
        titulo: `Apuração tributária mensal • ${competencia}`,
        data: dataValida(ano, mes, 15),
        modulo: "Fiscal",
        prioridade: 52,
        detalhes: "Revisar as apurações aplicáveis ao regime antes dos vencimentos.",
      }))
    }

    eventos.push(eventoBase({
      id: `plano-${clienteId(cliente)}-${ano}-${mes}-documentos`,
      cliente,
      tipo: "Documentos",
      titulo: `Conferir documentos mensais • ${competencia}`,
      data: dataValida(ano, mes, diaDocumentos),
      modulo: "Documentos Digitais",
      prioridade: 32,
      detalhes: "Confirmar recebimento e consistência dos documentos da competência.",
    }))

    eventos.push(eventoBase({
      id: `plano-${clienteId(cliente)}-${ano}-${mes}-honorarios`,
      cliente,
      tipo: "Financeiro",
      titulo: `Honorários contábeis • ${competencia}`,
      data: dataValida(ano, mes, diaHonorarios),
      modulo: "Financeiro",
      prioridade: 42,
      detalhes: "Acompanhar cobrança e confirmação de pagamento dos honorários.",
    }))

    eventos.push(eventoBase({
      id: `plano-${clienteId(cliente)}-${ano}-${mes}-recibo`,
      cliente,
      tipo: "Financeiro",
      titulo: `Preparar recibo de honorários • ${competencia}`,
      data: dataValida(ano, mes, Math.min(28, diaHonorarios + 1)),
      modulo: "Financeiro",
      prioridade: 28,
      detalhes: "Emitir e enviar o recibo somente após a confirmação do pagamento.",
    }))
  }

  return eventos
}

function eventosParcelamentos(fiscal = [], clientes = [], ano) {
  const clientesPorNome = new Map()
  filtrarClientesOperacionais(clientes).forEach((cliente) => {
    const nomes = [cliente.nome, cliente.cliente, cliente.razaoSocial, cliente.nomeFantasia, cliente.empresa]
    nomes.forEach((nome) => {
      const chave = normalizar(nome)
      if (chave && !clientesPorNome.has(chave)) clientesPorNome.set(chave, cliente)
    })
  })

  const eventos = []

  fiscal.forEach((item) => {
    const obrigacao = normalizar(item.obrigacao || item.tipo)
    if (!obrigacao.includes("parcelamento")) return

    const dados = obterParcelamento(item)
    if (!dados) return

    const atual = Number(dados.parcelaAtual || 0)
    const total = Number(dados.totalParcelas || 0)
    const dia = Number(dados.diaVencimento || 0)
    if (!atual || !total || !dia || atual > total) return

    const cliente = clientesPorNome.get(normalizar(item.cliente)) || { nome: item.cliente || "Cliente sem nome" }
    const dataInicial = item.vencimento ? new Date(`${String(item.vencimento).slice(0, 10)}T00:00:00`) : new Date(ano, 0, dia)
    if (Number.isNaN(dataInicial.getTime())) return

    let parcela = atual
    let mesCursor = dataInicial.getMonth() + 1
    let anoCursor = dataInicial.getFullYear()

    while (parcela <= total && anoCursor <= ano) {
      if (anoCursor === ano) {
        eventos.push(eventoBase({
          id: `plano-parcelamento-${item.id || clienteId(cliente)}-${parcela}-${ano}`,
          cliente,
          tipo: "Parcelamento",
          titulo: `${dados.descricao || "Parcelamento"} • Parcela ${parcela}/${total}`,
          data: dataValida(anoCursor, mesCursor, dia),
          modulo: "Fiscal",
          prioridade: 62,
          referenciaId: item.id,
          detalhes: `${dados.orgao || "Órgão não informado"}. Conferir, enviar e registrar a parcela correta.`,
        }))
      }

      parcela += 1
      mesCursor += 1
      if (mesCursor > 12) {
        mesCursor = 1
        anoCursor += 1
      }
    }
  })

  return eventos
}

export function gerarPlanejamentoAnual({ clientes = [], fiscal = [], ano = new Date().getFullYear(), configuracao = {} } = {}) {
  const existentes = lerPlanejamento(ano)
  const statusPorId = new Map(existentes.map((item) => [item.id, item.status]))

  const clientesOperacionais = filtrarClientesOperacionais(clientes)

  const gerados = [
    ...clientesOperacionais.flatMap((cliente) => eventosMensaisCliente(cliente, ano, configuracao)),
    ...eventosParcelamentos(fiscal, clientesOperacionais, ano),
  ]

  const unicos = Array.from(new Map(gerados.map((item) => [item.id, item])).values())
    .map((item) => ({ ...item, status: statusPorId.get(item.id) || item.status }))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || a.cliente.localeCompare(b.cliente))

  return salvarPlanejamento(ano, unicos)
}

export function obterPlanejamentoAnual(ano = new Date().getFullYear()) {
  return lerPlanejamento(ano)
}

export function garantirPlanejamentoAnual({ clientes = [], fiscal = [], ano = new Date().getFullYear(), configuracao = {} } = {}) {
  return gerarPlanejamentoAnual({ clientes, fiscal, ano, configuracao })
}

export function atualizarStatusPlanejamento(ano, id, status) {
  const eventos = lerPlanejamento(ano).map((item) => item.id === id ? { ...item, status } : item)
  return salvarPlanejamento(ano, eventos)
}

export function obterEventosPlanejamentoPorPeriodo({ ano, mes = null, inicio = null, fim = null } = {}) {
  const eventos = lerPlanejamento(ano || new Date().getFullYear())

  return eventos.filter((item) => {
    if (mes && Number(String(item.data).slice(5, 7)) !== Number(mes)) return false
    if (inicio && String(item.data) < String(inicio)) return false
    if (fim && String(item.data) > String(fim)) return false
    return true
  })
}
