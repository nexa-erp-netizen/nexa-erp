function normalizar(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function obterRegime(cliente = {}) {
  return normalizar(
    cliente.regimeTributario ||
    cliente.regime ||
    cliente.tipoEmpresa ||
    cliente.tipoCliente ||
    ""
  )
}

function obterSituacao(cliente = {}) {
  return normalizar(
    cliente.statusOperacional ||
    cliente.situacaoEmpresa ||
    cliente.situacaoCadastral ||
    cliente.statusEmpresa ||
    ""
  )
}

export function clienteOperacionalAtivo(cliente = {}) {
  if (!cliente || typeof cliente !== "object") return false
  if (cliente.ativo === false) return false

  const regime = obterRegime(cliente)
  if (regime.includes("avulso")) return false

  const situacao = obterSituacao(cliente)
  if (!situacao) return true // compatibilidade com cadastros antigos

  return situacao === "ativa" || situacao === "ativo"
}

export function filtrarClientesOperacionais(clientes = []) {
  return (Array.isArray(clientes) ? clientes : []).filter(clienteOperacionalAtivo)
}

export function nomeChaveCliente(valor) {
  return normalizar(valor)
}

export function criarMapaClientesOperacionais(clientes = []) {
  const mapa = new Map()

  filtrarClientesOperacionais(clientes).forEach((cliente) => {
    const nomes = [
      cliente.nome,
      cliente.cliente,
      cliente.razaoSocial,
      cliente.nomeFantasia,
      cliente.empresa,
    ]

    nomes.forEach((nome) => {
      const chave = nomeChaveCliente(nome)
      if (chave && !mapa.has(chave)) mapa.set(chave, cliente)
    })
  })

  return mapa
}

export function localizarClienteOperacional(mapa, nome) {
  if (!(mapa instanceof Map)) return null
  return mapa.get(nomeChaveCliente(nome)) || null
}
