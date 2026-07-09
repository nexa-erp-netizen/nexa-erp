const MODELOS_BASE = [
  {
    id: "das_disponivel",
    titulo: "DAS disponível",
    categoria: "Fiscal",
    texto:
      "Olá {cliente}, tudo bem?\n\nSeu DAS referente à competência {competencia} já está disponível.\n\nVencimento: {vencimento}\nValor: {valor}\n\nQualquer dúvida, estamos à disposição.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "vence_3_dias",
    titulo: "Vence em 3 dias",
    categoria: "Fiscal",
    texto:
      "Olá {cliente}, tudo bem?\n\nPassando para lembrar que sua pendência {descricao} vence em 3 dias.\n\nVencimento: {vencimento}\nValor: {valor}\n\nPara evitar juros ou multa, recomendamos o pagamento dentro do prazo.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "vence_hoje",
    titulo: "Vence hoje",
    categoria: "Fiscal",
    texto:
      "Olá {cliente}, tudo bem?\n\nLembrete importante: sua pendência {descricao} vence hoje.\n\nVencimento: {vencimento}\nValor: {valor}\n\nQualquer dúvida, nos avise por aqui.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "documento_recebido",
    titulo: "Documento recebido",
    categoria: "Documentos",
    texto:
      "Olá {cliente}, tudo bem?\n\nRecebemos seu documento no Nexa ERP.\n\nVamos analisar e, se precisarmos de mais alguma informação, avisaremos por aqui.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "documento_pendente",
    titulo: "Documento pendente",
    categoria: "Documentos",
    texto:
      "Olá {cliente}, tudo bem?\n\nIdentificamos que ainda existe documento pendente para envio.\n\nAssim que puder, envie pelo Portal do Cliente para darmos sequência ao atendimento.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "honorarios",
    titulo: "Honorários disponíveis",
    categoria: "Financeiro",
    texto:
      "Olá {cliente}, tudo bem?\n\nSeus honorários referentes à competência {competencia} estão disponíveis.\n\nValor: {valor}\nVencimento: {vencimento}\n\nQualquer dúvida, estamos à disposição.\n\nEquipe Nexa Contábil Digital.",
  },
  {
    id: "mensagem_personalizada",
    titulo: "Mensagem personalizada",
    categoria: "Geral",
    texto:
      "Olá {cliente}, tudo bem?\n\nEstamos entrando em contato pelo Nexa ERP.\n\nEquipe Nexa Contábil Digital.",
  },
]

export const MODELOS_WHATSAPP = MODELOS_BASE
export const WHATSAPP_MODELOS = MODELOS_BASE

export function limparTelefoneWhatsApp(telefone = "") {
  const apenasNumeros = String(telefone || "").replace(/\D/g, "")

  if (!apenasNumeros) return ""

  if (apenasNumeros.startsWith("55")) {
    return apenasNumeros
  }

  return `55${apenasNumeros}`
}

function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === "") return "não informado"

  const numero = Number(String(valor).replace(/\./g, "").replace(",", "."))

  if (Number.isNaN(numero)) return String(valor)

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function normalizarDados(dados = {}) {
  const cliente = dados.cliente || dados.nome || dados.razaoSocial || dados.empresa || "cliente"

  return {
    cliente,
    empresa: dados.empresa || dados.razaoSocial || cliente,
    vencimento: dados.vencimento || dados.dataVencimento || "não informado",
    valor: formatarValor(dados.valor),
    competencia: dados.competencia || "não informada",
    descricao: dados.descricao || dados.titulo || dados.tipo || "pendência",
    usuario: dados.usuario || "Nexa",
  }
}

export function obterModeloWhatsApp(idOuModelo) {
  if (!idOuModelo) return MODELOS_BASE[0]

  if (typeof idOuModelo === "object") return idOuModelo

  return (
    MODELOS_BASE.find((modelo) => modelo.id === idOuModelo) ||
    MODELOS_BASE.find((modelo) => modelo.titulo === idOuModelo) ||
    MODELOS_BASE[0]
  )
}

export function montarMensagemWhatsApp(modeloOuId, dados = {}) {
  const modelo = obterModeloWhatsApp(modeloOuId)
  const variaveis = normalizarDados(dados)

  return String(modelo.texto || "")
    .replaceAll("{cliente}", variaveis.cliente)
    .replaceAll("{empresa}", variaveis.empresa)
    .replaceAll("{vencimento}", variaveis.vencimento)
    .replaceAll("{valor}", variaveis.valor)
    .replaceAll("{competencia}", variaveis.competencia)
    .replaceAll("{descricao}", variaveis.descricao)
    .replaceAll("{usuario}", variaveis.usuario)
}

export function abrirWhatsAppWeb(telefone, mensagem = "") {
  const telefoneLimpo = limparTelefoneWhatsApp(telefone)

  if (!telefoneLimpo) {
    alert("Cliente sem telefone cadastrado para WhatsApp.")
    return false
  }

  const url = `https://wa.me/${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`
  window.open(url, "_blank", "noopener,noreferrer")
  return true
}

export function sugerirModeloWhatsApp(contexto = {}) {
  const texto = `${contexto.tipo || ""} ${contexto.status || ""} ${contexto.descricao || ""}`.toLowerCase()

  if (texto.includes("vence hoje") || texto.includes("hoje")) return obterModeloWhatsApp("vence_hoje")
  if (texto.includes("3 dias") || texto.includes("tres dias") || texto.includes("três dias")) return obterModeloWhatsApp("vence_3_dias")
  if (texto.includes("documento") && texto.includes("receb")) return obterModeloWhatsApp("documento_recebido")
  if (texto.includes("documento")) return obterModeloWhatsApp("documento_pendente")
  if (texto.includes("honor") || texto.includes("financeiro")) return obterModeloWhatsApp("honorarios")
  if (texto.includes("das") || texto.includes("guia") || texto.includes("fiscal")) return obterModeloWhatsApp("das_disponivel")

  return obterModeloWhatsApp("mensagem_personalizada")
}

export function registrarHistoricoWhatsApp(dados = {}) {
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
  limparTelefoneWhatsApp,
  obterModeloWhatsApp,
  montarMensagemWhatsApp,
  abrirWhatsAppWeb,
  sugerirModeloWhatsApp,
  registrarHistoricoWhatsApp,
}
