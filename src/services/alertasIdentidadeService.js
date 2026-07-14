import { filtrarClientesOperacionais } from "./clienteOperacionalService"

const DIA_MS = 86400000

export function diasAteValidade(data) {
  if (!data) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(`${String(data).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(alvo.getTime())) return null
  return Math.ceil((alvo - hoje) / DIA_MS)
}

export function classificarValidade(data, ativo = true) {
  if (!ativo) return { nivel: "inativo", faixa: null, peso: 0, texto: "Inativo" }
  const dias = diasAteValidade(data)
  if (dias === null) return { nivel: "incompleto", faixa: null, peso: 15, texto: "Validade não informada" }
  if (dias < 0) return { nivel: "vencido", faixa: 0, peso: 100, texto: `Vencido há ${Math.abs(dias)} dia(s)` }
  if (dias <= 7) return { nivel: "critico", faixa: 7, peso: 90, texto: `Vence em ${dias} dia(s)` }
  if (dias <= 15) return { nivel: "alto", faixa: 15, peso: 75, texto: `Vence em ${dias} dia(s)` }
  if (dias <= 30) return { nivel: "atencao", faixa: 30, peso: 60, texto: `Vence em ${dias} dia(s)` }
  if (dias <= 60) return { nivel: "preventivo", faixa: 60, peso: 40, texto: `Vence em ${dias} dia(s)` }
  return { nivel: "regular", faixa: null, peso: 0, texto: "Regular" }
}

function nomeCliente(cliente) {
  return cliente?.nome || cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.empresa || "Cliente"
}

function mapaClientes(clientes = []) {
  const mapa = new Map()
  filtrarClientesOperacionais(clientes).forEach((cliente) => {
    mapa.set(String(cliente.id), cliente)
  })
  return mapa
}

export function montarAlertasIdentidadeDigital({ clientes = [], certificados = [], procuracoes = [] } = {}) {
  const clientesAtivos = mapaClientes(clientes)
  const alertas = []

  certificados.forEach((item) => {
    const cliente = clientesAtivos.get(String(item.clienteId))
    if (!cliente) return
    const status = classificarValidade(item.dataValidade, item.ativo !== false)
    if (!status.peso) return
    alertas.push({
      id: `certificado-${item.id}`,
      tipo: "certificado",
      titulo: "Renovar certificado digital A1",
      cliente: nomeCliente(cliente),
      clienteId: cliente.id,
      clienteDados: cliente,
      data: item.dataValidade,
      status,
      descricao: `Certificado A1: ${status.texto}.`,
      destino: "Certificados Digitais",
      prioridade: status.peso,
      referenciaId: item.id,
    })
  })

  procuracoes.forEach((item) => {
    const cliente = clientesAtivos.get(String(item.clienteId))
    if (!cliente) return
    const status = classificarValidade(item.dataValidade, item.ativa !== false)
    if (!status.peso) return
    alertas.push({
      id: `procuracao-${item.id}`,
      tipo: "procuracao",
      titulo: "Renovar procuração e-CAC",
      cliente: nomeCliente(cliente),
      clienteId: cliente.id,
      clienteDados: cliente,
      data: item.dataValidade,
      status,
      descricao: `Procuração e-CAC: ${status.texto}.`,
      destino: "Procurações e-CAC",
      prioridade: status.peso,
      referenciaId: item.id,
    })
  })

  return alertas.sort((a, b) => b.prioridade - a.prioridade || String(a.data).localeCompare(String(b.data)))
}

export function resumirAlertasIdentidade(alertas = []) {
  return alertas.reduce((resumo, alerta) => {
    resumo.total += 1
    const nivel = alerta.status?.nivel
    if (nivel === "vencido") resumo.vencidos += 1
    else if (nivel === "critico") resumo.em7Dias += 1
    else if (nivel === "alto") resumo.em15Dias += 1
    else if (nivel === "atencao") resumo.em30Dias += 1
    else if (nivel === "preventivo") resumo.em60Dias += 1
    else if (nivel === "incompleto") resumo.incompletos += 1
    return resumo
  }, { total: 0, vencidos: 0, em7Dias: 0, em15Dias: 0, em30Dias: 0, em60Dias: 0, incompletos: 0 })
}
