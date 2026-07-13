import {
  montarMensagemWhatsApp,
  obterModeloWhatsApp,
} from "./whatsappService"

function texto(valor) {
  return String(valor || "").trim()
}

function normalizar(valor) {
  return texto(valor).toLowerCase()
}

function competenciaDoEvento(evento = {}) {
  const titulo = texto(evento.titulo)
  const encontrada = titulo.match(/(0[1-9]|1[0-2])\/\d{4}/)
  if (encontrada) return encontrada[0]

  const data = texto(evento.data).slice(0, 10)
  const partes = data.split("-")
  return partes.length === 3 ? `${partes[1]}/${partes[0]}` : "não informada"
}

export function obterModeloAgendaWhatsApp(evento = {}) {
  const base = normalizar(`${evento.tipo} ${evento.titulo} ${evento.detalhes}`)

  if (base.includes("honor")) return obterModeloWhatsApp("honorarios")
  if (base.includes("document")) return obterModeloWhatsApp("documento_pendente")
  if (base.includes("parcel")) return obterModeloWhatsApp("vence_3_dias")
  if (base.includes("certific")) return obterModeloWhatsApp("vence_3_dias")
  if (base.includes("das") || base.includes("pgdas") || base.includes("fiscal")) {
    return obterModeloWhatsApp("das_disponivel")
  }

  return obterModeloWhatsApp("mensagem_personalizada")
}

export function montarDadosAgendaWhatsApp(evento = {}) {
  return {
    cliente: evento.clienteDados || { nome: evento.cliente },
    clienteNome: evento.cliente,
    descricao: evento.titulo || evento.detalhes || evento.tipo,
    competencia: competenciaDoEvento(evento),
    vencimento: evento.data,
    valor: evento.valor || evento.clienteDados?.valorHonorarios || evento.clienteDados?.honorarios,
    mensagem: evento.detalhes || evento.titulo || "Temos uma informação importante para você.",
  }
}

export function criarPreviaWhatsAppAgenda(evento = {}) {
  const modelo = obterModeloAgendaWhatsApp(evento)
  const dados = montarDadosAgendaWhatsApp(evento)
  const mensagem = montarMensagemWhatsApp(modelo.id, dados)

  return {
    evento,
    modelo,
    dados,
    mensagem,
    cliente: evento.clienteDados || { nome: evento.cliente },
  }
}

export function eventoPermiteWhatsApp(evento = {}) {
  const base = normalizar(`${evento.tipo} ${evento.titulo} ${evento.detalhes}`)
  return ["das", "pgdas", "honor", "parcel", "document", "certific", "fiscal"].some((termo) => base.includes(termo))
}

export default {
  obterModeloAgendaWhatsApp,
  montarDadosAgendaWhatsApp,
  criarPreviaWhatsAppAgenda,
  eventoPermiteWhatsApp,
}
