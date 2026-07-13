function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase()
}

function inicioDoDia(data = new Date()) {
  const valor = new Date(data)
  valor.setHours(0, 0, 0, 0)
  return valor
}

function diferencaDias(data) {
  if (!data) return null

  const texto = String(data).slice(0, 10)
  const alvo = new Date(`${texto}T00:00:00`)
  if (Number.isNaN(alvo.getTime())) return null

  return Math.ceil((alvo - inicioDoDia()) / 86400000)
}

function obterDataUltimoAtendimento(cliente = {}) {
  return (
    cliente.ultimoAtendimento ||
    cliente.ultimoContato ||
    cliente.dataUltimoAtendimento ||
    cliente.updatedAt ||
    null
  )
}

function diasDesde(data) {
  if (!data) return null
  const texto = String(data).slice(0, 10)
  const alvo = new Date(`${texto}T00:00:00`)
  if (Number.isNaN(alvo.getTime())) return null
  return Math.max(0, Math.floor((inicioDoDia() - alvo) / 86400000))
}

function obterValidadeCertificado(cliente = {}) {
  return (
    cliente.validadeCertificado ||
    cliente.certificadoValidade ||
    cliente.dataValidadeCertificado ||
    cliente.validadeCertificadoDigital ||
    null
  )
}

function obterSaudeTributaria(cliente = {}) {
  const candidatos = [
    cliente.saudeTributaria,
    cliente.indiceSaudeTributaria,
    cliente.notaTributaria,
  ]

  for (const candidato of candidatos) {
    const numero = Number(candidato)
    if (Number.isFinite(numero)) return Math.max(0, Math.min(100, numero))
  }

  return null
}

function adicionarMotivo(lista, texto) {
  if (!texto || lista.includes(texto)) return
  lista.push(texto)
}

export function calcularPrioridadeCliente(clienteItem = {}) {
  const acoes = Array.isArray(clienteItem.acoes) ? clienteItem.acoes : []
  const cliente = clienteItem.clienteDados || {}
  const motivos = []
  let score = 0

  const atrasadas = acoes.filter((acao) => {
    const dias = diferencaDias(acao.data)
    return dias !== null && dias < 0
  })

  const vencendoHoje = acoes.filter((acao) => diferencaDias(acao.data) === 0)
  const vencendoTresDias = acoes.filter((acao) => {
    const dias = diferencaDias(acao.data)
    return dias !== null && dias > 0 && dias <= 3
  })

  if (atrasadas.length) {
    score += Math.min(45, 30 + atrasadas.length * 5)
    adicionarMotivo(motivos, `${atrasadas.length} ação(ões) vencida(s)`)
  }

  if (vencendoHoje.length) {
    score += Math.min(30, 20 + vencendoHoje.length * 4)
    adicionarMotivo(motivos, `${vencendoHoje.length} ação(ões) vence(m) hoje`)
  }

  if (vencendoTresDias.length) {
    score += Math.min(18, 10 + vencendoTresDias.length * 2)
    adicionarMotivo(motivos, `${vencendoTresDias.length} ação(ões) vence(m) em até 3 dias`)
  }

  const textosAcoes = acoes.map((acao) => normalizarTexto(`${acao.titulo} ${acao.descricao} ${acao.modulo}`))

  if (textosAcoes.some((texto) => texto.includes("parcelamento"))) {
    score += 12
    adicionarMotivo(motivos, "Parcelamento exige acompanhamento")
  }

  if (textosAcoes.some((texto) => texto.includes("honor"))) {
    score += 10
    adicionarMotivo(motivos, "Honorários aguardando conferência")
  }

  if (textosAcoes.some((texto) => texto.includes("documento") || texto.includes("pendência") || texto.includes("pendencia"))) {
    score += 8
    adicionarMotivo(motivos, "Documentos ou pendências aguardando ação")
  }

  const diasCertificado = diferencaDias(obterValidadeCertificado(cliente))
  if (diasCertificado !== null && diasCertificado < 0) {
    score += 35
    adicionarMotivo(motivos, "Certificado digital vencido")
  } else if (diasCertificado !== null && diasCertificado <= 7) {
    score += 25
    adicionarMotivo(motivos, `Certificado vence em ${diasCertificado} dia(s)`)
  } else if (diasCertificado !== null && diasCertificado <= 30) {
    score += 12
    adicionarMotivo(motivos, `Certificado vence em ${diasCertificado} dia(s)`)
  }

  const saude = obterSaudeTributaria(cliente)
  if (saude !== null && saude < 50) {
    score += 22
    adicionarMotivo(motivos, `Saúde tributária crítica (${saude}/100)`)
  } else if (saude !== null && saude < 70) {
    score += 12
    adicionarMotivo(motivos, `Saúde tributária em atenção (${saude}/100)`)
  }

  const semContatoHa = diasDesde(obterDataUltimoAtendimento(cliente))
  if (semContatoHa !== null && semContatoHa >= 30) {
    score += 10
    adicionarMotivo(motivos, `Sem atendimento registrado há ${semContatoHa} dias`)
  } else if (semContatoHa !== null && semContatoHa >= 15) {
    score += 5
    adicionarMotivo(motivos, `Sem atendimento registrado há ${semContatoHa} dias`)
  }

  // Garante que clientes com várias ações relevantes também subam na fila.
  score += Math.min(12, acoes.length * 2)

  const maiorPrioridadeAcao = acoes.reduce(
    (maior, acao) => Math.max(maior, Number(acao.prioridade || 0)),
    0
  )
  score += Math.min(18, Math.round(maiorPrioridadeAcao / 10))

  const prioridade = Math.max(0, Math.min(100, Math.round(score)))
  const classificacao =
    prioridade >= 85 ? "critico" :
    prioridade >= 65 ? "alto" :
    prioridade >= 40 ? "medio" :
    "baixo"

  const nivel = classificacao === "critico"
    ? "urgente"
    : classificacao === "alto" || classificacao === "medio"
      ? "atencao"
      : "programado"

  if (!motivos.length) {
    adicionarMotivo(motivos, "Ações programadas para acompanhamento")
  }

  return {
    prioridade,
    classificacao,
    nivel,
    motivosPrioridade: motivos.slice(0, 6),
  }
}

export function aplicarPriorizacaoFila(fila = []) {
  return fila
    .map((cliente) => {
      const analise = calcularPrioridadeCliente(cliente)
      return {
        ...cliente,
        prioridadeOriginal: cliente.prioridade,
        prioridade: analise.prioridade,
        classificacao: analise.classificacao,
        nivel: analise.nivel,
        motivosPrioridade: analise.motivosPrioridade,
        motivos: Array.from(new Set([
          ...analise.motivosPrioridade,
          ...(Array.isArray(cliente.motivos) ? cliente.motivos : []),
        ])).slice(0, 8),
      }
    })
    .sort((a, b) => {
      if (b.prioridade !== a.prioridade) return b.prioridade - a.prioridade
      const maiorA = Math.max(0, ...a.acoes.map((acao) => Number(acao.prioridade || 0)))
      const maiorB = Math.max(0, ...b.acoes.map((acao) => Number(acao.prioridade || 0)))
      return maiorB - maiorA
    })
}

export function textoClassificacaoPrioridade(classificacao) {
  const mapa = {
    critico: "🔴 Crítico",
    alto: "🟠 Alto",
    medio: "🟡 Médio",
    baixo: "🟢 Baixo",
  }

  return mapa[classificacao] || "🟢 Baixo"
}
