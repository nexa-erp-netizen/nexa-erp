function hojeBase() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return hoje
}

export function diferencaDias(data) {
  if (!data) return null

  const texto = String(data).slice(0, 10)
  const alvo = new Date(`${texto}T00:00:00`)

  if (Number.isNaN(alvo.getTime())) return null

  return Math.ceil((alvo - hojeBase()) / (1000 * 60 * 60 * 24))
}

export function textoPrazo(dias) {
  if (dias === null || dias === undefined) return "Sem vencimento"
  if (dias < 0) return `Atrasado há ${Math.abs(dias)} dia(s)`
  if (dias === 0) return "Vence hoje"
  if (dias === 1) return "Vence amanhã"
  return `Vence em ${dias} dias`
}

function textoMinusculoPrazo(data) {
  const dias = diferencaDias(data)
  return textoPrazo(dias).toLowerCase()
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase()
}

function obterNomeCliente(cliente) {
  return (
    cliente?.nome ||
    cliente?.cliente ||
    cliente?.razaoSocial ||
    cliente?.nomeFantasia ||
    cliente?.empresa ||
    "Cliente sem nome"
  )
}

function obterClienteId(cliente) {
  return cliente?.id || cliente?.clienteId || cliente?.idCliente || null
}

function clienteChave(nome) {
  return normalizarTexto(nome)
}

function montarMapaClientes(clientes = []) {
  const mapa = new Map()

  clientes.forEach((cliente) => {
    const nomes = [
      cliente?.nome,
      cliente?.cliente,
      cliente?.razaoSocial,
      cliente?.nomeFantasia,
      cliente?.empresa,
    ]

    nomes.forEach((nome) => {
      const chave = clienteChave(nome)
      if (chave && !mapa.has(chave)) mapa.set(chave, cliente)
    })
  })

  return mapa
}

function localizarCliente(mapaClientes, nome) {
  return mapaClientes.get(clienteChave(nome)) || null
}

function criarAcao({
  id,
  cliente,
  clienteId,
  clienteDados,
  modulo,
  titulo,
  descricao,
  prioridade,
  destino,
  referenciaId,
  modeloWhatsApp,
  tipo = "operacional",
  data,
}) {
  return {
    id,
    cliente: cliente || "Cliente sem nome",
    clienteId: clienteId || null,
    clienteDados: clienteDados || null,
    modulo,
    titulo,
    descricao,
    prioridade,
    destino,
    referenciaId,
    modeloWhatsApp,
    tipo,
    data,
    status: "pendente",
  }
}

function fiscalAtivo(item) {
  const status = normalizarTexto(item?.status)

  return (
    !status.includes("concluído") &&
    !status.includes("concluido") &&
    !status.includes("cancelado") &&
    !status.includes("pago pelo escritório")
  )
}

function aguardandoPagamentoFiscal(item) {
  const status = normalizarTexto(item?.status)

  return (
    fiscalAtivo(item) &&
    !status.includes("pago") &&
    !status.includes("enviado")
  )
}

function documentoPendente(item) {
  const origem = String(item?.origem || "")
  const status = String(item?.status || "")

  return (
    origem === "Cliente → Escritório" &&
    ["Recebido", "Em análise", "Entregue pelo cliente"].includes(status)
  )
}

function pendenciaAberta(item) {
  const status = normalizarTexto(item?.status)
  return status && !status.includes("concluída") && !status.includes("concluida")
}

export function montarAcoesDoDia({
  clientes = [],
  fiscal = [],
  pendencias = [],
  documentos = [],
  financeiro = [],
} = {}) {
  const mapaClientes = montarMapaClientes(clientes)
  const acoes = []

  fiscal.filter(fiscalAtivo).forEach((item) => {
    const clienteCadastro = localizarCliente(mapaClientes, item.cliente)
    const cliente = item.cliente || obterNomeCliente(clienteCadastro)
    const clienteId = obterClienteId(clienteCadastro) || item.clienteId || item.cliente_id
    const obrigacao = item.obrigacao || item.tipo || "Obrigação fiscal"
    const dias = diferencaDias(item.vencimento)
    const status = normalizarTexto(item.status)
    const valor = Number(String(item.valor || 0).replace(".", "").replace(",", ".")) || 0

    if (dias !== null && dias < 0 && aguardandoPagamentoFiscal(item)) {
      acoes.push(criarAcao({
        id: `fiscal-atrasado-${item.id}`,
        cliente,
        clienteId,
        clienteDados: clienteCadastro,
        modulo: "Fiscal",
        titulo: `Resolver ${obrigacao}`,
        descricao: `${obrigacao} ${textoPrazo(dias).toLowerCase()}.`,
        prioridade: 100 + Math.min(Math.abs(dias) * 5, 80),
        destino: "Fiscal",
        referenciaId: item.id,
        modeloWhatsApp: "vence_hoje",
        data: item.vencimento,
      }))

      acoes.push(criarAcao({
        id: `whatsapp-fiscal-atrasado-${item.id}`,
        cliente,
        clienteId,
        clienteDados: clienteCadastro,
        modulo: "WhatsApp",
        titulo: "Avisar cliente pelo WhatsApp",
        descricao: `Enviar lembrete sobre ${obrigacao} ${textoMinusculoPrazo(item.vencimento)}.`,
        prioridade: 95 + Math.min(Math.abs(dias) * 3, 50),
        destino: "WhatsApp Inteligente",
        referenciaId: item.id,
        modeloWhatsApp: "vence_hoje",
        tipo: "whatsapp",
        data: item.vencimento,
      }))
      return
    }

    if (dias !== null && dias === 0 && aguardandoPagamentoFiscal(item)) {
      acoes.push(criarAcao({
        id: `fiscal-hoje-${item.id}`,
        cliente,
        clienteId,
        clienteDados: clienteCadastro,
        modulo: "Fiscal",
        titulo: `Acompanhar vencimento de ${obrigacao}`,
        descricao: `${obrigacao} vence hoje${valor ? ` no valor de R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}.`,
        prioridade: 90,
        destino: "Fiscal",
        referenciaId: item.id,
        modeloWhatsApp: "vence_hoje",
        data: item.vencimento,
      }))

      acoes.push(criarAcao({
        id: `whatsapp-fiscal-hoje-${item.id}`,
        cliente,
        clienteId,
        clienteDados: clienteCadastro,
        modulo: "WhatsApp",
        titulo: "Enviar aviso de vencimento hoje",
        descricao: `Mensagem pronta para ${obrigacao} vencendo hoje.`,
        prioridade: 88,
        destino: "WhatsApp Inteligente",
        referenciaId: item.id,
        modeloWhatsApp: "vence_hoje",
        tipo: "whatsapp",
        data: item.vencimento,
      }))
      return
    }

    if (dias !== null && dias <= 3 && dias > 0 && aguardandoPagamentoFiscal(item)) {
      acoes.push(criarAcao({
        id: `fiscal-3dias-${item.id}`,
        cliente,
        clienteId,
        clienteDados: clienteCadastro,
        modulo: "Fiscal",
        titulo: `Preparar aviso de ${obrigacao}`,
        descricao: `${obrigacao} ${textoPrazo(dias).toLowerCase()}.`,
        prioridade: 70 - dias,
        destino: "Fiscal",
        referenciaId: item.id,
        modeloWhatsApp: "vence_3_dias",
        data: item.vencimento,
      }))

      acoes.push(criarAcao({
        id: `whatsapp-fiscal-3dias-${item.id}`,
        cliente,
        clienteId,
        clienteDados: clienteCadastro,
        modulo: "WhatsApp",
        titulo: "Enviar lembrete preventivo",
        descricao: `Enviar WhatsApp sobre ${obrigacao} ${textoPrazo(dias).toLowerCase()}.`,
        prioridade: 68 - dias,
        destino: "WhatsApp Inteligente",
        referenciaId: item.id,
        modeloWhatsApp: "vence_3_dias",
        tipo: "whatsapp",
        data: item.vencimento,
      }))
    }

    if (status.includes("pendente")) {
      acoes.push(criarAcao({
        id: `fiscal-pendente-${item.id}`,
        cliente,
        clienteId,
        clienteDados: clienteCadastro,
        modulo: "Fiscal",
        titulo: `Conferir ${obrigacao}`,
        descricao: `${obrigacao} está pendente no fiscal.`,
        prioridade: 55,
        destino: "Fiscal",
        referenciaId: item.id,
        modeloWhatsApp: "das_disponivel",
        data: item.vencimento,
      }))
    }

    if (status.includes("pago pelo cliente")) {
      acoes.push(criarAcao({
        id: `fiscal-pago-cliente-${item.id}`,
        cliente,
        clienteId,
        clienteDados: clienteCadastro,
        modulo: "Fiscal",
        titulo: "Conferir pagamento recebido",
        descricao: `${obrigacao} foi marcada como paga pelo cliente. Conferir recibo e concluir.`,
        prioridade: 65,
        destino: "Fiscal",
        referenciaId: item.id,
        data: item.vencimento,
      }))
    }
  })

  pendencias.filter(pendenciaAberta).forEach((item) => {
    const clienteCadastro = localizarCliente(mapaClientes, item.cliente)
    const cliente = item.cliente || obterNomeCliente(clienteCadastro)
    const clienteId = obterClienteId(clienteCadastro) || item.clienteId || item.cliente_id
    const prazo = item.vencimento || item.prazo
    const dias = diferencaDias(prazo)
    const titulo = item.titulo || item.categoria || "Pendência do cliente"

    acoes.push(criarAcao({
      id: `pendencia-${item.id}`,
      cliente,
      clienteId,
      clienteDados: clienteCadastro,
      modulo: "Atendimento",
      titulo: `Resolver ${titulo}`,
      descricao: dias === null ? `${titulo} aguardando ação.` : `${titulo} ${textoPrazo(dias).toLowerCase()}.`,
      prioridade: dias !== null && dias < 0 ? 85 : 60,
      destino: "Pendências Clientes",
      referenciaId: item.id,
      modeloWhatsApp: "documento_pendente",
      data: prazo,
    }))
  })

  documentos.filter(documentoPendente).forEach((item) => {
    const clienteCadastro = localizarCliente(mapaClientes, item.cliente)
    const cliente = item.cliente || obterNomeCliente(clienteCadastro)
    const clienteId = obterClienteId(clienteCadastro) || item.clienteId || item.cliente_id
    const tipo = item.tipo || "Documento"

    acoes.push(criarAcao({
      id: `documento-${item.id}`,
      cliente,
      clienteId,
      clienteDados: clienteCadastro,
      modulo: "Documentos",
      titulo: `Conferir ${tipo}`,
      descricao: `${tipo} recebido pelo cliente e aguardando análise.`,
      prioridade: 58,
      destino: "Documentos Digitais",
      referenciaId: item.id,
      modeloWhatsApp: "documento_recebido",
      data: String(item.createdAt || "").slice(0, 10),
    }))
  })

  financeiro.forEach((item) => {
    const status = normalizarTexto(item.status)
    const tipo = normalizarTexto(item.tipo || item.categoria || item.descricao)
    const clienteCadastro = localizarCliente(mapaClientes, item.cliente)
    const cliente = item.cliente || obterNomeCliente(clienteCadastro)
    const clienteId = obterClienteId(clienteCadastro) || item.clienteId || item.cliente_id
    const vencimento = item.vencimento || item.dataVencimento || item.data
    const dias = diferencaDias(vencimento)

    if (tipo.includes("honor") && !status.includes("pago") && !status.includes("concl")) {
      acoes.push(criarAcao({
        id: `honorario-${item.id}`,
        cliente,
        clienteId,
        clienteDados: clienteCadastro,
        modulo: "Financeiro",
        titulo: "Conferir honorários contábeis",
        descricao: dias === null ? "Honorários aguardando pagamento." : `Honorários ${textoPrazo(dias).toLowerCase()}.`,
        prioridade: dias !== null && dias < 0 ? 80 : 50,
        destino: "Financeiro",
        referenciaId: item.id,
        modeloWhatsApp: "honorarios_disponiveis",
        data: vencimento,
      }))
    }
  })

  const vistos = new Set()
  return acoes
    .filter((acao) => {
      const chave = `${acao.cliente}-${acao.modulo}-${acao.titulo}-${acao.referenciaId}`
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    .sort((a, b) => b.prioridade - a.prioridade)
}

export function montarFilaAssistenteDia(dados = {}) {
  const acoes = montarAcoesDoDia(dados)
  const mapa = new Map()

  acoes.forEach((acao) => {
    const chave = clienteChave(acao.cliente)

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        id: acao.clienteId || chave,
        cliente: acao.cliente,
        clienteId: acao.clienteId,
        prioridade: 0,
        nivel: "normal",
        motivos: [],
        acoes: [],
      })
    }

    const item = mapa.get(chave)
    item.prioridade += acao.prioridade
    item.acoes.push(acao)

    if (item.motivos.length < 5) {
      item.motivos.push(acao.descricao)
    }
  })

  const fila = Array.from(mapa.values())
    .map((item) => {
      const urgente = item.prioridade >= 140
      const atencao = item.prioridade >= 70 && item.prioridade < 140

      return {
        ...item,
        nivel: urgente ? "urgente" : atencao ? "atencao" : "programado",
        acoes: item.acoes.sort((a, b) => b.prioridade - a.prioridade),
        motivos: Array.from(new Set(item.motivos)),
      }
    })
    .sort((a, b) => b.prioridade - a.prioridade)

  return fila
}

export function montarResumoAssistenteDia(fila = []) {
  const totalAcoes = fila.reduce((total, cliente) => total + cliente.acoes.length, 0)

  return {
    clientes: fila.length,
    urgentes: fila.filter((cliente) => cliente.nivel === "urgente").length,
    atencao: fila.filter((cliente) => cliente.nivel === "atencao").length,
    programados: fila.filter((cliente) => cliente.nivel === "programado").length,
    acoes: totalAcoes,
    progresso: 0,
  }
}
