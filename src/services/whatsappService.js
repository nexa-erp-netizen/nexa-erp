const MODELOS_BASE = [
  {
    id: "das_disponivel",
    icone: "📄",
    titulo: "DAS disponível",
    categoria: "Fiscal",
    texto:
      "Olá {cliente}, tudo bem?\n\nSeu DAS referente à competência {competencia} já está disponível.\n\nVencimento: {vencimento}\nValor: {valor}\n\nQualquer dúvida, estamos à disposição.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "vence_3_dias",
    icone: "⏰",
    titulo: "Vence em 3 dias",
    categoria: "Fiscal",
    texto:
      "Olá {cliente}, tudo bem?\n\nPassando para lembrar que sua pendência {descricao} vence em 3 dias.\n\nVencimento: {vencimento}\nValor: {valor}\n\nPara evitar juros ou multa, recomendamos o pagamento dentro do prazo.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "vence_hoje",
    icone: "🚨",
    titulo: "Vence hoje",
    categoria: "Fiscal",
    texto:
      "Olá {cliente}, tudo bem?\n\nLembrete importante: sua pendência {descricao} vence hoje.\n\nVencimento: {vencimento}\nValor: {valor}\n\nQualquer dúvida, nos avise por aqui.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "documento_recebido",
    icone: "📂",
    titulo: "Documento recebido",
    categoria: "Documentos",
    texto:
      "Olá {cliente}, tudo bem?\n\nRecebemos seu documento no Nexa ERP.\n\nVamos analisar e, se precisarmos de mais alguma informação, avisaremos por aqui.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "documento_pendente",
    icone: "📎",
    titulo: "Documento pendente",
    categoria: "Documentos",
    texto:
      "Olá {cliente}, tudo bem?\n\nIdentificamos que ainda existe documento pendente para envio.\n\nAssim que puder, envie pelo Portal do Cliente para darmos sequência ao atendimento.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "honorarios",
    icone: "💰",
    titulo: "Honorários disponíveis",
    categoria: "Financeiro",
    texto:
      "Olá {cliente}, tudo bem?\n\nSeus honorários referentes à competência {competencia} estão disponíveis.\n\nValor: {valor}\nVencimento: {vencimento}\n\nQualquer dúvida, estamos à disposição.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "honorario_disponivel",
    icone: "💰",
    titulo: "Honorário disponível",
    categoria: "Financeiro",
    texto:
      "Olá {cliente}, tudo bem?\n\nSeu honorário referente à competência {competencia} está disponível.\n\nValor: {valor}\nVencimento: {vencimento}\n\nQualquer dúvida, estamos à disposição.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "mensagem_personalizada",
    icone: "✍️",
    titulo: "Mensagem personalizada",
    categoria: "Geral",
    texto:
      "Olá {cliente}, tudo bem?\n\n{mensagem}\n\nEquipe Nexa Contábil Digital.",
  },
]

export const MODELOS_WHATSAPP = MODELOS_BASE
export const WHATSAPP_MODELOS = MODELOS_BASE.reduce((mapa, modelo) => {
  mapa[modelo.id] = modelo
  return mapa
}, {})

function obterTelefoneCliente(origem = {}) {
  if (typeof origem === "string" || typeof origem === "number") return String(origem || "")

  const cliente = origem?.cliente && typeof origem.cliente === "object" ? origem.cliente : origem
  const campos = [
    "whatsapp",
    "WhatsApp",
    "celular",
    "Celular",
    "telefone",
    "Telefone",
    "fone",
    "Fone",
    "telefone1",
    "telefone2",
    "telefone_cliente",
    "telefoneCliente",
    "numero",
    "contato",
  ]

  for (const campo of campos) {
    const valor = cliente?.[campo]
    if (valor !== null && valor !== undefined && String(valor).trim()) return String(valor).trim()
  }

  return ""
}

export function obterTelefoneWhatsApp(clienteOuTelefone = {}) {
  return obterTelefoneCliente(clienteOuTelefone)
}

export function limparTelefoneWhatsApp(telefone = "") {
  const telefoneBruto = obterTelefoneCliente(telefone)
  let apenasNumeros = String(telefoneBruto || "").replace(/\D/g, "")

  if (!apenasNumeros) return ""
  if (apenasNumeros.startsWith("00")) apenasNumeros = apenasNumeros.slice(2)
  if (apenasNumeros.startsWith("55")) return apenasNumeros

  return `55${apenasNumeros}`
}

export function telefoneWhatsApp(clienteOuTelefone = {}) {
  return limparTelefoneWhatsApp(clienteOuTelefone)
}

export function formatarMoedaWhatsApp(valor) {
  if (valor === null || valor === undefined || valor === "") return "não informado"

  const texto = String(valor).trim()
  const numero = texto.includes(",")
    ? Number(texto.replace(/\./g, "").replace(",", "."))
    : Number(texto)

  if (Number.isNaN(numero)) return texto

  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function formatarDataWhatsApp(data) {
  if (!data) return "não informado"

  const texto = String(data)
  const apenasData = texto.slice(0, 10)
  const partes = apenasData.split("-")

  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`

  return texto
}

function normalizarDados(dados = {}) {
  const clienteObj = dados.cliente && typeof dados.cliente === "object" ? dados.cliente : null
  const extras = dados.dados && typeof dados.dados === "object" ? dados.dados : {}

  const nomeCliente =
    dados.clienteNome ||
    dados.nome ||
    clienteObj?.nome ||
    clienteObj?.cliente ||
    clienteObj?.razaoSocial ||
    dados.razaoSocial ||
    dados.empresa ||
    "cliente"

  return {
    cliente: nomeCliente,
    empresa: clienteObj?.razaoSocial || clienteObj?.nomeFantasia || dados.empresa || dados.razaoSocial || nomeCliente,
    vencimento: formatarDataWhatsApp(dados.vencimento || dados.dataVencimento || extras.vencimento || extras.prazo),
    valor: formatarMoedaWhatsApp(dados.valor ?? extras.valor),
    competencia: dados.competencia || extras.competencia || "não informada",
    descricao: dados.descricao || dados.titulo || dados.tipo || extras.descricao || extras.pendencia || extras.obrigacao || "pendência",
    pendencia: dados.pendencia || extras.pendencia || extras.obrigacao || dados.descricao || "documento/pendência solicitada",
    usuario: dados.usuario || extras.usuario || "Nexa",
    mensagem: dados.textoLivre || dados.mensagem || extras.mensagem || "Estamos entrando em contato pelo Nexa ERP.",
  }
}

export function obterModeloWhatsApp(idOuModelo) {
  if (!idOuModelo) return MODELOS_BASE[0]
  if (typeof idOuModelo === "object" && idOuModelo.id && idOuModelo.texto) return idOuModelo

  const chave = typeof idOuModelo === "object" ? idOuModelo.modeloId || idOuModelo.id || idOuModelo.modelo : idOuModelo

  return (
    MODELOS_BASE.find((modelo) => modelo.id === chave) ||
    MODELOS_BASE.find((modelo) => modelo.titulo === chave) ||
    MODELOS_BASE[0]
  )
}

export function montarMensagemWhatsApp(modeloOuConfig, dados = {}) {
  const usandoConfig = modeloOuConfig && typeof modeloOuConfig === "object" && !modeloOuConfig.texto
  const modelo = obterModeloWhatsApp(usandoConfig ? modeloOuConfig.modeloId || modeloOuConfig.modelo : modeloOuConfig)
  const variaveis = normalizarDados(usandoConfig ? modeloOuConfig : dados)

  return String(modelo.texto || "").replace(/\{(\w+)\}/g, (_, chave) => variaveis[chave] ?? "")
}

export function abrirWhatsAppWeb(clienteOuTelefone, mensagem = "") {
  const mensagemFinal =
    clienteOuTelefone && typeof clienteOuTelefone === "object" && clienteOuTelefone.mensagem !== undefined
      ? clienteOuTelefone.mensagem
      : mensagem

  const telefoneLimpo = limparTelefoneWhatsApp(clienteOuTelefone)

  if (!telefoneLimpo) {
    alert(
      "Cliente sem telefone válido para WhatsApp.\n\n" +
        "Campos verificados: whatsapp, celular, telefone, fone, telefone1 e telefone2."
    )
    return false
  }

  const url = `https://wa.me/${telefoneLimpo}?text=${encodeURIComponent(mensagemFinal || "")}`
  window.open(url, "_blank", "noopener,noreferrer")
  return true
}

export function sugerirModeloWhatsApp(contexto = {}) {
  const texto = `${contexto.tipo || ""} ${contexto.status || ""} ${contexto.descricao || ""} ${contexto.titulo || ""}`.toLowerCase()

  if (texto.includes("vence hoje") || texto.includes("hoje")) return obterModeloWhatsApp("vence_hoje")
  if (texto.includes("3 dias") || texto.includes("tres dias") || texto.includes("três dias")) return obterModeloWhatsApp("vence_3_dias")
  if (texto.includes("documento") && texto.includes("receb")) return obterModeloWhatsApp("documento_recebido")
  if (texto.includes("documento")) return obterModeloWhatsApp("documento_pendente")
  if (texto.includes("honor")) return obterModeloWhatsApp("honorarios")
  if (texto.includes("das") || texto.includes("guia") || texto.includes("fiscal")) return obterModeloWhatsApp("das_disponivel")

  return obterModeloWhatsApp("mensagem_personalizada")
}

export async function registrarHistoricoWhatsApp(apiOuDados, cliente, modeloTitulo, mensagem) {
  if (apiOuDados?.put && cliente?.id) {
    const anotacao = {
      id: Date.now(),
      data: new Date().toISOString(),
      tipo: "WhatsApp",
      texto: `💬 WhatsApp aberto • Modelo: ${modeloTitulo || "Mensagem"}\n\n${mensagem || ""}`,
    }

    const anotacoesAtualizadas = [anotacao, ...(Array.isArray(cliente.anotacoes) ? cliente.anotacoes : [])]
    const resposta = await apiOuDados.put(`/clientes/${cliente.id}`, { ...cliente, anotacoes: anotacoesAtualizadas })

    return resposta.data || { ...cliente, anotacoes: anotacoesAtualizadas }
  }

  const dados = apiOuDados || {}
  const registro = {
    id: Date.now(),
    tipo: "WhatsApp",
    data: new Date().toISOString(),
    cliente: dados.cliente || dados.nome || "Cliente",
    modelo: dados.modelo || dados.modeloTitulo || "Mensagem WhatsApp",
    mensagem: dados.mensagem || "",
    usuario: dados.usuario || "Nexa",
  }

  try {
    const chave = "nexa_historico_whatsapp"
    const historico = JSON.parse(localStorage.getItem(chave) || "[]")
    historico.unshift(registro)
    localStorage.setItem(chave, JSON.stringify(historico.slice(0, 500)))
  } catch (error) {
    console.warn("Não foi possível registrar histórico do WhatsApp", error)
  }

  return registro
}

export default {
  MODELOS_WHATSAPP,
  WHATSAPP_MODELOS,
  obterTelefoneWhatsApp,
  limparTelefoneWhatsApp,
  telefoneWhatsApp,
  formatarMoedaWhatsApp,
  formatarDataWhatsApp,
  obterModeloWhatsApp,
  montarMensagemWhatsApp,
  abrirWhatsAppWeb,
  sugerirModeloWhatsApp,
  registrarHistoricoWhatsApp,
}
