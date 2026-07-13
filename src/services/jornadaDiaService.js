const EVENTO_JORNADA_ATUALIZADA = "nexa:jornada-dia-atualizada"

export function dataLocalISO(data = new Date()) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

export function chaveJornadaDia(data = new Date()) {
  return `nexa_assistente_dia_${dataLocalISO(data)}`
}

export function carregarJornadaDia(data = new Date()) {
  try {
    const salvo = JSON.parse(localStorage.getItem(chaveJornadaDia(data)) || "null")

    return {
      atendimentoAtivo: Boolean(salvo?.atendimentoAtivo),
      clienteAtualIndex: Number(salvo?.clienteAtualIndex || 0),
      acoesConcluidas: salvo?.acoesConcluidas || {},
      historicoDia: Array.isArray(salvo?.historicoDia) ? salvo.historicoDia : [],
      inicioDia: salvo?.inicioDia || null,
    }
  } catch (error) {
    console.warn("Não foi possível carregar a jornada do dia", error)
    return {
      atendimentoAtivo: false,
      clienteAtualIndex: 0,
      acoesConcluidas: {},
      historicoDia: [],
      inicioDia: null,
    }
  }
}

export function salvarJornadaDia(dados, data = new Date()) {
  try {
    localStorage.setItem(chaveJornadaDia(data), JSON.stringify(dados))
    window.dispatchEvent(new CustomEvent(EVENTO_JORNADA_ATUALIZADA, { detail: dados }))
    return true
  } catch (error) {
    console.warn("Não foi possível salvar a jornada do dia", error)
    return false
  }
}

export function limparJornadaDia(data = new Date()) {
  try {
    localStorage.removeItem(chaveJornadaDia(data))
    window.dispatchEvent(new CustomEvent(EVENTO_JORNADA_ATUALIZADA, { detail: null }))
    return true
  } catch (error) {
    console.warn("Não foi possível limpar a jornada do dia", error)
    return false
  }
}

export { EVENTO_JORNADA_ATUALIZADA }
