import { LIMITE_GERAL_SIMPLES } from "../tabelas/simplesNacional"

const LIMITES_FAIXAS = Object.freeze([180_000, 360_000, 720_000, 1_800_000, 3_600_000, 4_800_000])

function moeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0))
}

function percentual(valor, casas = 2) {
  return `${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`
}

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor))
}

function proximoLimiteFaixa(rbt12) {
  return LIMITES_FAIXAS.find((limite) => rbt12 < limite) || null
}

/**
 * Produz uma análise consultiva e explicável do cenário do Simples Nacional.
 * Não substitui o planejamento tributário profissional nem valida CNAE/elegibilidade.
 */
export function analisarPlanejamentoTributario({
  rbt12,
  receitaPeriodo,
  fatorR = null,
  comparacaoAnexos = null,
  das = null,
} = {}) {
  const receita12 = Number(rbt12)
  const receitaMes = Number(receitaPeriodo)

  if (!Number.isFinite(receita12) || receita12 <= 0) {
    throw new Error("A RBT12 deve ser maior que zero para gerar o planejamento tributário.")
  }

  const alertas = []
  const oportunidades = []
  const pontosPositivos = []
  const proximidadeLimiteGeral = receita12 / LIMITE_GERAL_SIMPLES
  const proximoLimite = proximoLimiteFaixa(receita12)
  const distanciaProximaFaixa = proximoLimite ? proximoLimite - receita12 : 0

  let pontuacao = 100
  let nivelRisco = "baixo"

  if (proximidadeLimiteGeral >= 0.9) {
    pontuacao -= 35
    nivelRisco = "alto"
    alertas.push({
      tipo: "LIMITE_SIMPLES",
      nivel: "alto",
      titulo: "Próximo do limite do Simples Nacional",
      descricao: `A RBT12 já representa ${percentual(proximidadeLimiteGeral * 100)} do limite geral de ${moeda(LIMITE_GERAL_SIMPLES)}.`,
      recomendacao: "Inicie a comparação entre Simples Nacional, Lucro Presumido e Lucro Real antes do próximo crescimento relevante.",
    })
  } else if (proximidadeLimiteGeral >= 0.75) {
    pontuacao -= 18
    nivelRisco = "medio"
    alertas.push({
      tipo: "APROXIMACAO_LIMITE",
      nivel: "medio",
      titulo: "Crescimento exige acompanhamento",
      descricao: `A empresa utiliza ${percentual(proximidadeLimiteGeral * 100)} do limite geral do Simples Nacional.`,
      recomendacao: "Projete o faturamento dos próximos 12 meses e acompanhe mensalmente a permanência no regime.",
    })
  } else {
    pontosPositivos.push("A RBT12 ainda está distante do limite geral do Simples Nacional.")
  }

  if (proximoLimite && distanciaProximaFaixa <= Math.max(receita12 * 0.08, 20_000)) {
    pontuacao -= 10
    alertas.push({
      tipo: "PROXIMA_FAIXA",
      nivel: "medio",
      titulo: "Próxima mudança de faixa",
      descricao: `Faltam aproximadamente ${moeda(distanciaProximaFaixa)} de RBT12 para alcançar o próximo limite de faixa.`,
      recomendacao: "Simule o impacto da nova alíquota efetiva antes do fechamento dos próximos períodos.",
    })
  }

  if (fatorR) {
    if (!fatorR.atingiuLimite) {
      pontuacao -= fatorR.pontosPercentuaisParaLimite <= 2 ? 12 : 20
      nivelRisco = nivelRisco === "alto" ? "alto" : "medio"
      alertas.push({
        tipo: "FATOR_R_ABAIXO",
        nivel: fatorR.pontosPercentuaisParaLimite <= 2 ? "medio" : "alto",
        titulo: "Fator R abaixo de 28%",
        descricao: `O Fator R considerado é ${percentual(fatorR.fatorRPercentual)}. Faltam ${percentual(fatorR.pontosPercentuaisParaLimite)} para atingir 28%.`,
        recomendacao: "Revise a composição da folha e simule cenários com substância econômica antes de qualquer ajuste.",
      })

      if (fatorR.folhaAdicionalNecessaria > 0) {
        oportunidades.push({
          tipo: "SIMULACAO_FATOR_R",
          titulo: "Cenário matemático para atingir 28%",
          descricao: `Mantida a mesma receita-base, seriam necessários aproximadamente ${moeda(fatorR.folhaAdicionalNecessaria)} adicionais de folha acumulada.`,
          ressalva: "Aumento de pró-labore ou folha pode gerar custos previdenciários, trabalhistas e financeiros. A decisão exige análise integral.",
        })
      }
    } else {
      pontosPositivos.push(`O Fator R atingiu ${percentual(fatorR.fatorRPercentual)}, acima ou igual ao limite de 28%.`)
    }
  }

  if (comparacaoAnexos) {
    const economiaMensal = Math.max(0, comparacaoAnexos.diferencaPeriodo)
    const economiaAnual = Math.max(0, comparacaoAnexos.diferencaAnualLinear)

    if (economiaMensal > 0) {
      oportunidades.push({
        tipo: "COMPARACAO_ANEXOS",
        titulo: "Diferença matemática entre Anexo III e V",
        descricao: `Neste cenário, a diferença estimada é ${moeda(economiaMensal)} no mês e ${moeda(economiaAnual)} em 12 meses, com receita constante.`,
        ressalva: "A comparação é simplificada e não confirma elegibilidade da atividade, custos de folha ou valor definitivo no PGDAS-D.",
      })
    }
  }

  if (receitaMes > 0 && receitaMes * 12 > receita12 * 1.25) {
    pontuacao -= 8
    alertas.push({
      tipo: "ACELERACAO_RECEITA",
      nivel: "medio",
      titulo: "Receita do período acima da média histórica",
      descricao: `A receita atual anualizada (${moeda(receitaMes * 12)}) supera em mais de 25% a RBT12 informada.`,
      recomendacao: "Verifique se existe aceleração de faturamento e antecipe simulações de faixa e regime.",
    })
  }

  if (das?.anexo === "IV") {
    pontuacao -= 8
    alertas.push({
      tipo: "ANEXO_IV_CPP",
      nivel: "medio",
      titulo: "CPP fora do DAS",
      descricao: "No Anexo IV, a contribuição previdenciária patronal exige análise separada.",
      recomendacao: "Considere a CPP fora do DAS ao comparar a carga tributária efetiva do cenário.",
    })
  }

  pontuacao = limitar(pontuacao, 0, 100)

  if (pontuacao < 55) nivelRisco = "alto"
  else if (pontuacao < 80 && nivelRisco !== "alto") nivelRisco = "medio"

  const classificacao = pontuacao >= 85 ? "Saudável" : pontuacao >= 65 ? "Atenção" : "Crítica"

  const parecer =
    nivelRisco === "alto"
      ? "O cenário exige revisão tributária prioritária antes do próximo fechamento."
      : nivelRisco === "medio"
        ? "O cenário é administrável, mas há pontos que merecem acompanhamento e simulação."
        : "O cenário não apresenta alerta crítico com os dados informados, mantendo-se necessária a revisão mensal."

  return Object.freeze({
    tipo: "PLANEJAMENTO_TRIBUTARIO_SIMPLIFICADO",
    status: "ANALISE_CONSULTIVA",
    pontuacao,
    classificacao,
    nivelRisco,
    alertas: Object.freeze(alertas),
    oportunidades: Object.freeze(oportunidades),
    pontosPositivos: Object.freeze(pontosPositivos),
    indicadores: Object.freeze({
      rbt12: receita12,
      receitaPeriodo: receitaMes,
      limiteGeralSimples: LIMITE_GERAL_SIMPLES,
      percentualLimiteGeral: proximidadeLimiteGeral * 100,
      proximoLimiteFaixa: proximoLimite,
      distanciaProximaFaixa,
    }),
    parecer,
    avisos: Object.freeze([
      "Análise destinada ao apoio do contador e baseada somente nos dados informados.",
      "Não valida CNAE, segregação de receitas, benefícios, sublimites, retenções ou enquadramento definitivo.",
      "O planejamento deve considerar custos previdenciários, trabalhistas, societários e financeiros.",
      "A decisão final pertence ao contador responsável.",
    ]),
  })
}
