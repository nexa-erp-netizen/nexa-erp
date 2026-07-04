import { useEffect, useState } from "react"
import api from "../services/api"

export default function Clientes({ setPage }) {
  const [tela, setTela] = useState("lista")
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [editandoId, setEditandoId] = useState(null)

  const [nome, setNome] = useState("")
  const [cpf, setCpf] = useState("")
  const [telefone, setTelefone] = useState("")
  const [email, setEmail] = useState("")
  const [cnpj, setCnpj] = useState("")
  const [regime, setRegime] = useState("")
  const [cep, setCep] = useState("")
  const [endereco, setEndereco] = useState("")
  const [numero, setNumero] = useState("")
  const [bairro, setBairro] = useState("")
  const [complemento, setComplemento] = useState("")
  const [cidade, setCidade] = useState("")
  const [estado, setEstado] = useState("")
  const [dataNascimento, setDataNascimento] = useState("")
  const [tituloEleitor, setTituloEleitor] = useState("")
  const [codigoSimplesNacional, setCodigoSimplesNacional] = useState("")
  const [senhaGovBr, setSenhaGovBr] = useState("")
  const [cnaePrincipal, setCnaePrincipal] = useState("")
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("")
  const [inscricaoEstadual, setInscricaoEstadual] = useState("")
  const [alvara, setAlvara] = useState("")
  const [observacao, setObservacao] = useState("")
  const [anexos, setAnexos] = useState([])
  const [pesquisaCliente, setPesquisaCliente] = useState("")
  const [novaAnotacao, setNovaAnotacao] = useState("")
  const [novaAcao, setNovaAcao] = useState("")
  const [vencimentoAcao, setVencimentoAcao] = useState("")
  const [financeiroResumoCliente, setFinanceiroResumoCliente] = useState(null)
  const [fiscalResumoCliente, setFiscalResumoCliente] = useState(null)
  const [carregandoIntegracoes, setCarregandoIntegracoes] = useState(false)

  const regimes = [
    "Avulso",
    "MEI",
    "Simples Nacional",
    "Lucro Presumido",
    "Lucro Real",
  ]

  const estados = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
    "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
    "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ]

  const [clientes, setClientes] = useState([])

  useEffect(() => {
    carregarClientes()
  }, [])

  useEffect(() => {
    if (tela === "detalhes" && clienteSelecionado?.nome) {
      carregarResumoIntegracoes(clienteSelecionado.nome)
    }
  }, [tela, clienteSelecionado?.id])

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientes(resposta.data || [])
      return resposta.data || []
    } catch (error) {
      alert("Erro ao carregar clientes da API")
      console.error(error)
      return []
    }
  }


  function valorNumerico(valorFormatado) {
    return Number(
      String(valorFormatado || 0)
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    ) || 0
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function mesmoCliente(nomeA, nomeB) {
    return String(nomeA || "").trim().toLowerCase() === String(nomeB || "").trim().toLowerCase()
  }

  function dataDoFinanceiro(item) {
    return item.vencimento || item.dataRecebimento || item.createdAt || item.updatedAt || ""
  }

  function ehReceitaFinanceira(item) {
    const tipo = String(item.tipo || "").toLowerCase()
    return tipo.includes("receber") || tipo.includes("receita") || tipo.includes("crédito") || tipo.includes("credito")
  }

  function statusFinanceiro(item) {
    if (item.status === "Pago" || item.status === "Recebido") return item.status
    if (item.vencimento && new Date(item.vencimento) < new Date()) return "Atrasado"
    return item.status || "Pendente"
  }

  async function carregarResumoIntegracoes(nomeCliente) {
    setCarregandoIntegracoes(true)

    try {
      const [financeiroResp, fiscalResp] = await Promise.all([
        api.get("/financeiro").catch(() => ({ data: [] })),
        api.get("/fiscal").catch(() => ({ data: [] })),
      ])

      const financeiros = Array.isArray(financeiroResp.data) ? financeiroResp.data : []
      const financeirosCliente = financeiros
        .filter((item) => mesmoCliente(item.cliente, nomeCliente))
        .filter(ehReceitaFinanceira)
        .map((item) => ({ ...item, statusCalculado: statusFinanceiro(item), valorNumber: valorNumerico(item.valor) }))

      const recebidos = financeirosCliente
        .filter((item) => item.statusCalculado === "Pago" || item.statusCalculado === "Recebido")
        .reduce((total, item) => total + item.valorNumber, 0)

      const emAberto = financeirosCliente
        .filter((item) => item.statusCalculado !== "Pago" && item.statusCalculado !== "Recebido")
        .reduce((total, item) => total + item.valorNumber, 0)

      const ultimoFinanceiro = [...financeirosCliente].sort(
        (a, b) => new Date(dataDoFinanceiro(b) || 0) - new Date(dataDoFinanceiro(a) || 0)
      )[0]

      setFinanceiroResumoCliente({
        total: financeirosCliente.length,
        recebidos,
        emAberto,
        ultimo: ultimoFinanceiro,
        situacao: emAberto > 0 ? "Atenção" : financeirosCliente.length > 0 ? "Em dia" : "Sem lançamentos",
      })

      const fiscais = Array.isArray(fiscalResp.data) ? fiscalResp.data : []
      const fiscaisCliente = fiscais.filter((item) => mesmoCliente(item.cliente, nomeCliente))

      const abertas = fiscaisCliente.filter((item) => !["Concluído", "Concluido", "Pago", "Recebido"].includes(item.status))
      const proximaFiscal = [...abertas].sort(
        (a, b) => new Date(a.vencimento || "9999-12-31") - new Date(b.vencimento || "9999-12-31")
      )[0]
      const ultimaFiscal = [...fiscaisCliente].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt || b.vencimento || 0) - new Date(a.updatedAt || a.createdAt || a.vencimento || 0)
      )[0]

      setFiscalResumoCliente({
        total: fiscaisCliente.length,
        abertas: abertas.length,
        proxima: proximaFiscal,
        ultima: ultimaFiscal,
        situacao: abertas.length > 0 ? "Atenção" : fiscaisCliente.length > 0 ? "Em dia" : "Sem obrigações",
      })
    } catch (error) {
      console.error("Erro ao carregar integrações da central", error)
      setFinanceiroResumoCliente(null)
      setFiscalResumoCliente(null)
    } finally {
      setCarregandoIntegracoes(false)
    }
  }

  function formatarCPF(valor) {
    return valor
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  }

  function formatarTelefone(valor) {
    return valor
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
  }

  function formatarCNPJ(valor) {
    return valor
      .replace(/\D/g, "")
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
  }

  function formatarCEP(valor) {
    return valor
      .replace(/\D/g, "")
      .slice(0, 8)
      .replace(/(\d{5})(\d)/, "$1-$2")
  }

  async function buscarEnderecoPorCep(valorCep = cep) {
    const cepLimpo = String(valorCep || "").replace(/\D/g, "")

    if (cepLimpo.length !== 8) {
      return
    }

    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const dados = await resposta.json()

      if (dados.erro) {
        alert("CEP não encontrado")
        return
      }

      setEndereco(dados.logradouro || "")
      setBairro(dados.bairro || "")
      setCidade(dados.localidade || "")
      setEstado(dados.uf || "")
    } catch (error) {
      alert("Erro ao buscar CEP")
      console.error(error)
    }
  }

  async function adicionarAnexos(e) {
    const arquivos = Array.from(e.target.files)

    if (arquivos.length === 0) {
      return
    }

    const formData = new FormData()

    arquivos.forEach((arquivo) => {
      formData.append("arquivos", arquivo)
    })

    try {
      const resposta = await api.post(
        "/clientes/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      )

      setAnexos([...anexos, ...resposta.data])
    } catch (error) {
      alert("Erro ao enviar arquivo")
      console.error(error)
    }
  }

  async function salvarCliente() {
    if (!nome || !cpf || !telefone) {
      alert("Preencha Cliente, CPF e Telefone")
      return
    }

    const dadosCliente = {
      nome,
      cpf,
      telefone,
      email,
      cnpj,
      regime,
      cep,
      endereco,
      numero,
      bairro,
      complemento,
      cidade,
      estado,
      dataNascimento,
      tituloEleitor,
      codigoSimplesNacional,
      senhaGovBr,
      cnaePrincipal,
      inscricaoMunicipal,
      inscricaoEstadual,
      alvara,
      observacao,
      anexos,
      anotacoes: clienteSelecionado?.anotacoes || [],
      proximasAcoes: clienteSelecionado?.proximasAcoes || [],
    }

    try {
      if (editandoId !== null) {
        const resposta = await api.put(`/clientes/${editandoId}`, dadosCliente)
        const listaAtualizada = await carregarClientes()
        const clienteAtualizado =
          resposta.data || listaAtualizada.find((item) => item.id === editandoId)

        setClienteSelecionado(clienteAtualizado)
        setEditandoId(clienteAtualizado?.id || editandoId)
        setTela("detalhes")

        alert("Cliente corrigido com sucesso")
        return
      }

      await api.post("/clientes", dadosCliente)
      await carregarClientes()
      limparCampos()
      setTela("lista")

      alert("Cliente cadastrado com sucesso")
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Erro ao salvar cliente na API"
      )
      console.error(error)
    }
  }

  function rolarParaTopo() {
    const opcoes = { top: 0, left: 0, behavior: "smooth" }

    window.scrollTo(opcoes)
    document.documentElement?.scrollTo?.(opcoes)
    document.body?.scrollTo?.(opcoes)

    const possiveisContainers = [
      document.querySelector("main"),
      document.querySelector("#root"),
      document.querySelector(".content"),
      document.querySelector(".main-content"),
      document.querySelector("[data-scroll-container]"),
    ].filter(Boolean)

    possiveisContainers.forEach((container) => {
      if (container && typeof container.scrollTo === "function") {
        container.scrollTo(opcoes)
      }
    })
  }

  function visualizarCliente(cliente) {
    setClienteSelecionado(cliente)
    setEditandoId(cliente.id)
    setTela("detalhes")

    requestAnimationFrame(() => {
      rolarParaTopo()
      setTimeout(rolarParaTopo, 80)
    })
  }

  function rolarParaSecao(secao) {
    if (secao === "resumo") {
      rolarParaTopo()
      return
    }

    const elemento = document.getElementById(`central-${secao}`)

    if (elemento) {
      elemento.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }


  function abrirFinanceiroDoCliente() {
    if (!clienteSelecionado?.nome) return

    localStorage.setItem("nexaFiltroFinanceiroCliente", clienteSelecionado.nome)

    if (typeof setPage === "function") {
      setPage("Financeiro")
    } else {
      alert("Filtro financeiro preparado para este cliente.")
    }
  }

  function abrirFiscalDoCliente() {
    if (!clienteSelecionado?.nome) return

    localStorage.setItem("nexaFiltroFiscalCliente", clienteSelecionado.nome)

    if (typeof setPage === "function") {
      setPage("Fiscal")
    } else {
      alert("Filtro fiscal preparado para este cliente.")
    }
  }

  function editarCliente() {
    if (!clienteSelecionado) return

    setNome(clienteSelecionado.nome || "")
    setCpf(clienteSelecionado.cpf || "")
    setTelefone(clienteSelecionado.telefone || "")
    setEmail(clienteSelecionado.email || "")
    setCnpj(clienteSelecionado.cnpj || "")
    setRegime(clienteSelecionado.regime || "")
    setCep(clienteSelecionado.cep || "")
    setEndereco(clienteSelecionado.endereco || "")
    setNumero(clienteSelecionado.numero || "")
    setBairro(clienteSelecionado.bairro || "")
    setComplemento(clienteSelecionado.complemento || "")
    setCidade(clienteSelecionado.cidade || "")
    setEstado(clienteSelecionado.estado || "")
    setDataNascimento(clienteSelecionado.dataNascimento || "")
    setTituloEleitor(clienteSelecionado.tituloEleitor || "")
    setCodigoSimplesNacional(clienteSelecionado.codigoSimplesNacional || "")
    setSenhaGovBr(clienteSelecionado.senhaGovBr || "")
    setCnaePrincipal(clienteSelecionado.cnaePrincipal || "")
    setInscricaoMunicipal(clienteSelecionado.inscricaoMunicipal || "")
    setInscricaoEstadual(clienteSelecionado.inscricaoEstadual || "")
    setAlvara(clienteSelecionado.alvara || "")
    setObservacao(clienteSelecionado.observacao || "")
    setAnexos(clienteSelecionado.anexos || [])

    setEditandoId(clienteSelecionado.id)
    setTela("formulario")
  }

  async function excluirCliente() {
    if (!editandoId) return

    const confirmar = window.confirm(
      "Deseja realmente excluir este cliente?"
    )

    if (!confirmar) return

    try {
      await api.delete(`/clientes/${editandoId}`)
      await carregarClientes()

      setClienteSelecionado(null)
      setEditandoId(null)
      setTela("lista")
    } catch (error) {
      alert("Erro ao excluir cliente da API")
      console.error(error)
    }
  }

  function removerAnexo(index) {
    const novaLista = anexos.filter((_, i) => i !== index)
    setAnexos(novaLista)
  }

  async function abrirArquivo(caminho) {
    try {
      if (!caminho) {
        alert("Arquivo não encontrado.")
        return
      }

      if (caminho.startsWith("http")) {
        window.open(caminho, "_blank")
        return
      }

      const resposta = await api.get(
        `/clientes/anexo-url?path=${encodeURIComponent(caminho)}`
      )

      window.open(resposta.data.url, "_blank")
    } catch (error) {
      alert("Erro ao abrir arquivo")
      console.error(error)
    }
  }

  function novoCliente() {
    limparCampos()
    setClienteSelecionado(null)
    setEditandoId(null)
    setTela("formulario")
  }

  function voltarLista() {
    limparCampos()
    setClienteSelecionado(null)
    setEditandoId(null)
    setTela("lista")
  }

  async function salvarAnotacaoCliente() {
    if (!clienteSelecionado || !novaAnotacao.trim()) {
      alert("Digite uma anotação antes de salvar")
      return
    }

    const anotacao = {
      id: Date.now(),
      data: new Date().toISOString(),
      texto: novaAnotacao.trim(),
    }

    const anotacoesAtualizadas = [
      anotacao,
      ...(Array.isArray(clienteSelecionado.anotacoes) ? clienteSelecionado.anotacoes : []),
    ]

    try {
      const resposta = await api.put(`/clientes/${clienteSelecionado.id}`, {
        ...clienteSelecionado,
        anotacoes: anotacoesAtualizadas,
      })

      const clienteAtualizado = resposta.data || {
        ...clienteSelecionado,
        anotacoes: anotacoesAtualizadas,
      }

      setClienteSelecionado(clienteAtualizado)
      setNovaAnotacao("")
      await carregarClientes()
    } catch (error) {
      alert("Erro ao salvar anotação")
      console.error(error)
    }
  }

  async function excluirAnotacaoCliente(anotacaoId) {
    if (!clienteSelecionado) return

    const confirmar = window.confirm("Deseja realmente excluir esta anotação?")
    if (!confirmar) return

    const anotacoesAtuais = Array.isArray(clienteSelecionado.anotacoes)
      ? clienteSelecionado.anotacoes
      : []

    const anotacoesAtualizadas = anotacoesAtuais.filter(
      (item) => String(item.id || item.data) !== String(anotacaoId)
    )

    try {
      const resposta = await api.put(`/clientes/${clienteSelecionado.id}`, {
        ...clienteSelecionado,
        anotacoes: anotacoesAtualizadas,
      })

      const clienteAtualizado = resposta.data || {
        ...clienteSelecionado,
        anotacoes: anotacoesAtualizadas,
      }

      setClienteSelecionado(clienteAtualizado)
      await carregarClientes()
    } catch (error) {
      alert("Erro ao excluir anotação")
      console.error(error)
    }
  }

    async function salvarProximaAcaoCliente() {
    if (!clienteSelecionado || !novaAcao.trim()) {
      alert("Digite a próxima ação antes de salvar")
      return
    }

    const acao = {
      id: Date.now(),
      dataCriacao: new Date().toISOString(),
      descricao: novaAcao.trim(),
      vencimento: vencimentoAcao || "",
      status: "Pendente",
    }

    const proximasAcoesAtualizadas = [
      acao,
      ...(Array.isArray(clienteSelecionado.proximasAcoes) ? clienteSelecionado.proximasAcoes : []),
    ]

    try {
      const resposta = await api.put(`/clientes/${clienteSelecionado.id}`, {
        ...clienteSelecionado,
        proximasAcoes: proximasAcoesAtualizadas,
      })

      const clienteAtualizado = resposta.data || {
        ...clienteSelecionado,
        proximasAcoes: proximasAcoesAtualizadas,
      }

      setClienteSelecionado(clienteAtualizado)
      setNovaAcao("")
      setVencimentoAcao("")
      await carregarClientes()
    } catch (error) {
      alert("Erro ao salvar próxima ação")
      console.error(error)
    }
  }

  async function concluirProximaAcaoCliente(acaoId) {
    if (!clienteSelecionado) return

    const proximasAcoesAtuais = Array.isArray(clienteSelecionado.proximasAcoes)
      ? clienteSelecionado.proximasAcoes
      : []

    const acaoConcluida = proximasAcoesAtuais.find(
      (item) => String(item.id || item.dataCriacao) === String(acaoId)
    )

    if (!acaoConcluida) return

    const proximasAcoesAtualizadas = proximasAcoesAtuais.filter(
      (item) => String(item.id || item.dataCriacao) !== String(acaoId)
    )

    const anotacaoAutomatica = {
      id: Date.now(),
      data: new Date().toISOString(),
      tipo: "Ação concluída",
      texto: `✔ ${acaoConcluida.descricao}`,
    }

    const anotacoesAtualizadas = [
      anotacaoAutomatica,
      ...(Array.isArray(clienteSelecionado.anotacoes) ? clienteSelecionado.anotacoes : []),
    ]

    try {
      const resposta = await api.put(`/clientes/${clienteSelecionado.id}`, {
        ...clienteSelecionado,
        proximasAcoes: proximasAcoesAtualizadas,
        anotacoes: anotacoesAtualizadas,
      })

      const clienteAtualizado = resposta.data || {
        ...clienteSelecionado,
        proximasAcoes: proximasAcoesAtualizadas,
        anotacoes: anotacoesAtualizadas,
      }

      setClienteSelecionado(clienteAtualizado)
      await carregarClientes()
    } catch (error) {
      alert("Erro ao concluir próxima ação")
      console.error(error)
    }
  }

  async function excluirProximaAcaoCliente(acaoId) {
    if (!clienteSelecionado) return

    const confirmar = window.confirm("Deseja realmente excluir esta próxima ação?")
    if (!confirmar) return

    const proximasAcoesAtuais = Array.isArray(clienteSelecionado.proximasAcoes)
      ? clienteSelecionado.proximasAcoes
      : []

    const proximasAcoesAtualizadas = proximasAcoesAtuais.filter(
      (item) => String(item.id || item.dataCriacao) !== String(acaoId)
    )

    try {
      const resposta = await api.put(`/clientes/${clienteSelecionado.id}`, {
        ...clienteSelecionado,
        proximasAcoes: proximasAcoesAtualizadas,
      })

      const clienteAtualizado = resposta.data || {
        ...clienteSelecionado,
        proximasAcoes: proximasAcoesAtualizadas,
      }

      setClienteSelecionado(clienteAtualizado)
      await carregarClientes()
    } catch (error) {
      alert("Erro ao excluir próxima ação")
      console.error(error)
    }
  }

  function limparCampos() {
    setNome("")
    setCpf("")
    setTelefone("")
    setEmail("")
    setCnpj("")
    setRegime("")
    setCep("")
    setEndereco("")
    setNumero("")
    setBairro("")
    setComplemento("")
    setCidade("")
    setEstado("")
    setDataNascimento("")
    setTituloEleitor("")
    setCodigoSimplesNacional("")
    setSenhaGovBr("")
    setCnaePrincipal("")
    setInscricaoMunicipal("")
    setInscricaoEstadual("")
    setAlvara("")
    setObservacao("")
    setAnexos([])
  }

  const clientesOrdenados = [...clientes].sort((a, b) =>
    String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" })
  )

  const clientesFiltrados = clientesOrdenados.filter((cliente) =>
    String(cliente.nome || "").toLowerCase().includes(pesquisaCliente.toLowerCase())
  )

  const proximasAcoesCliente = Array.isArray(clienteSelecionado?.proximasAcoes)
    ? clienteSelecionado.proximasAcoes
    : []

  const anotacoesCliente = Array.isArray(clienteSelecionado?.anotacoes)
    ? clienteSelecionado.anotacoes
    : []

  const anexosCliente = Array.isArray(clienteSelecionado?.anexos)
    ? clienteSelecionado.anexos
    : []

  const ultimaAnotacao = anotacoesCliente
    .slice()
    .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))[0]

  const proximaAcaoMaisProxima = proximasAcoesCliente
    .slice()
    .sort((a, b) => String(a.vencimento || "9999-12-31").localeCompare(String(b.vencimento || "9999-12-31")))[0]

  const ultimoAnexo = anexosCliente[anexosCliente.length - 1]

  const ultimaAnotacaoTexto = ultimaAnotacao?.texto
    ? String(ultimaAnotacao.texto).slice(0, 42) + (String(ultimaAnotacao.texto).length > 42 ? "..." : "")
    : "sem registro"

  const ultimoAnexoNome = ultimoAnexo?.nome
    ? String(ultimoAnexo.nome).slice(0, 34) + (String(ultimoAnexo.nome).length > 34 ? "..." : "")
    : "nenhum arquivo"

  const proximaAcaoDetalhe = proximaAcaoMaisProxima?.vencimento
    ? `Mais próxima: ${formatarDataBR(proximaAcaoMaisProxima.vencimento)}`
    : proximaAcaoMaisProxima?.descricao || "nenhuma ação pendente"

  const localidadeCliente = [clienteSelecionado?.cidade, clienteSelecionado?.estado]
    .filter(Boolean)
    .join(" / ")

  return (
    <div style={box}>
      {tela === "lista" && (
        <>
          <div style={topo}>
            <h2>Clientes</h2>

            <button style={button} onClick={novoCliente}>
              Novo Cliente
            </button>
          </div>

          <div style={pesquisaBox}>
            <input
              style={input}
              placeholder="Pesquisar cliente pelo nome..."
              value={pesquisaCliente}
              onChange={(e) => setPesquisaCliente(e.target.value)}
            />
          </div>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Cliente</th>
                <th style={th}>CPF</th>
                <th style={th}>Telefone</th>
                <th style={th}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {clientesFiltrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td style={td}>{cliente.nome}</td>
                  <td style={td}>{cliente.cpf}</td>
                  <td style={td}>{cliente.telefone}</td>

                  <td style={td}>
                    <button
                      style={viewButton}
                      onClick={() => visualizarCliente(cliente)}
                    >
                      Visualizar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tela === "formulario" && (
        <>
          <div style={topo}>
            <h2>
              {editandoId !== null ? "Corrigir Cliente" : "Novo Cliente"}
            </h2>

            <button style={backButton} onClick={voltarLista}>
              Voltar
            </button>
          </div>

          <div style={form}>
            <input
              style={input}
              placeholder="Cliente"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <input
              style={input}
              placeholder="CPF"
              value={cpf}
              onChange={(e) => setCpf(formatarCPF(e.target.value))}
            />

            <input
              style={input}
              placeholder="Telefone"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
            />

            <input
              style={input}
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              style={input}
              placeholder="CNPJ"
              value={cnpj}
              onChange={(e) => setCnpj(formatarCNPJ(e.target.value))}
            />

            <select
              style={input}
              value={regime}
              onChange={(e) => setRegime(e.target.value)}
            >
              <option value="">Selecione o regime</option>

              {regimes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <input
              style={input}
              placeholder="CEP"
              value={cep}
              onChange={(e) => setCep(formatarCEP(e.target.value))}
              onBlur={() => buscarEnderecoPorCep()}
            />

            <input
              style={input}
              placeholder="Endereço"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />

            <input
              style={input}
              placeholder="Número"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />

            <input
              style={input}
              placeholder="Bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
            />

            <input
              style={input}
              placeholder="Cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
            />

            <select
              style={input}
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">Selecione o estado</option>

              {estados.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>

            <input
              style={input}
              placeholder="Complemento"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
            />

            <div style={dateBox}>
              <span style={dateLabel}>Data de nascimento</span>

              <input
                style={input}
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
              />
            </div>

            <input
              style={input}
              placeholder="Título de Eleitor"
              value={tituloEleitor}
              onChange={(e) => setTituloEleitor(e.target.value)}
            />

            <input
              style={input}
              placeholder="Código Simples Nacional"
              value={codigoSimplesNacional}
              onChange={(e) => setCodigoSimplesNacional(e.target.value)}
            />

            <input
              style={input}
              placeholder="Senha Gov.br"
              value={senhaGovBr}
              onChange={(e) => setSenhaGovBr(e.target.value)}
            />

            <input
              style={input}
              placeholder="CNAE Principal"
              value={cnaePrincipal}
              onChange={(e) => setCnaePrincipal(e.target.value)}
            />

            <input
              style={input}
              placeholder="Inscrição Municipal"
              value={inscricaoMunicipal}
              onChange={(e) => setInscricaoMunicipal(e.target.value)}
            />

            <input
              style={input}
              placeholder="Inscrição Estadual"
              value={inscricaoEstadual}
              onChange={(e) => setInscricaoEstadual(e.target.value)}
            />

            <input
              style={input}
              placeholder="Alvará"
              value={alvara}
              onChange={(e) => setAlvara(e.target.value)}
            />

            <textarea
              style={textarea}
              placeholder="Observação"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />

            <div style={uploadBox}>
              <label style={uploadLabel}>
                Anexar Arquivo
                <input
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={adicionarAnexos}
                />
              </label>

              {anexos.length > 0 && (
                <div style={arquivosLista}>
                  {anexos.map((arquivo, index) => (
                    <div key={index} style={arquivoItem}>
                      <span>📎 {arquivo.nome}</span>

                      <div style={fileActions}>
                        <button
                          style={openFileButton}
                          onClick={() => abrirArquivo(arquivo.caminho)}
                        >
                          Abrir
                        </button>

                        <button
                          style={removeFileButton}
                          onClick={() => removerAnexo(index)}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button style={button} onClick={salvarCliente}>
              {editandoId !== null ? "Salvar Correção" : "Salvar Cliente"}
            </button>
          </div>
        </>
      )}

      {tela === "detalhes" && clienteSelecionado && (
        <>
          <div id="central-resumo" style={centralHero}>
            <div style={centralHeroInfo}>
              <div style={clienteAvatar}>
                {String(clienteSelecionado.nome || "N").slice(0, 1).toUpperCase()}
              </div>

              <div>
                <span style={centralBadge}>Central do Cliente</span>
                <h2 style={centralTitulo}>{clienteSelecionado.nome}</h2>

                <div style={centralMeta}>
                  <span>{clienteSelecionado.regime || "Regime não informado"}</span>
                  <span>•</span>
                  <span>{localidadeCliente || "Cidade não informada"}</span>
                  <span>•</span>
                  <span>{clienteSelecionado.cnpj || clienteSelecionado.cpf || "CPF/CNPJ não informado"}</span>
                </div>
              </div>
            </div>

            <div style={centralBotoes}>
              <button style={backButton} onClick={voltarLista}>
                Voltar
              </button>

              <button style={editButton} onClick={editarCliente}>
                Corrigir
              </button>

              <button style={deleteButton} onClick={excluirCliente}>
                Excluir
              </button>
            </div>
          </div>

          <div style={centralMenu}>
            <button style={centralMenuBotao} onClick={() => rolarParaSecao("resumo")}>🏠 Resumo</button>
            <button style={centralMenuBotao} onClick={() => rolarParaSecao("acoes")}>⏰ Próximas Ações</button>
            <button style={centralMenuBotao} onClick={() => rolarParaSecao("historico")}>📝 Histórico</button>
            <button style={centralMenuBotao} onClick={() => rolarParaSecao("documentos")}>📎 Documentos</button>
            <button style={centralMenuBotao} onClick={() => rolarParaSecao("dados")}>📋 Dados</button>
            <button style={centralMenuBotao} onClick={() => rolarParaSecao("financeiro")}>💰 Financeiro</button>
            <button style={centralMenuBotao} onClick={() => rolarParaSecao("fiscal")}>🏛 Fiscal</button>
          </div>

          <div style={contatoRapido}>
            <Info label="Telefone" value={clienteSelecionado.telefone} />
            <Info label="E-mail" value={clienteSelecionado.email} />
            <Info label="CNPJ" value={clienteSelecionado.cnpj} />
            <Info label="CPF" value={clienteSelecionado.cpf} />
          </div>

          <div style={resumoGrid}>
            <ResumoCard
              icone="⏰"
              titulo="Próximas ações"
              valor={proximasAcoesCliente.length}
              detalhe={proximaAcaoDetalhe}
              status={proximasAcoesCliente.length > 0 ? "atencao" : "ok"}
              acao="Abrir ações"
              onClick={() => rolarParaSecao("acoes")}
            />

            <ResumoCard
              icone="📝"
              titulo="Histórico"
              valor={anotacoesCliente.length}
              detalhe={ultimaAnotacao ? `Último: ${formatarDataBR(String(ultimaAnotacao.data).slice(0, 10))}` : "sem registro"}
              status={anotacoesCliente.length > 0 ? "ok" : "neutro"}
              acao="Abrir histórico"
              onClick={() => rolarParaSecao("historico")}
            />

            <ResumoCard
              icone="📎"
              titulo="Documentos"
              valor={anexosCliente.length}
              detalhe={ultimoAnexoNome}
              status={anexosCliente.length > 0 ? "ok" : "neutro"}
              acao="Abrir documentos"
              onClick={() => rolarParaSecao("documentos")}
            />

            <ResumoCard
              icone="💰"
              titulo="Financeiro"
              valor={financeiroCardValor}
              detalhe={financeiroCardDetalhe}
              status={financeiroResumoCliente?.emAberto > 0 ? "atencao" : financeiroResumoCliente?.total > 0 ? "ok" : "neutro"}
              acao="Ver resumo"
              onClick={() => rolarParaSecao("financeiro")}
            />

            <ResumoCard
              icone="🏛️"
              titulo="Fiscal"
              valor={fiscalCardValor}
              detalhe={fiscalCardDetalhe}
              status={fiscalResumoCliente?.abertas > 0 ? "atencao" : fiscalResumoCliente?.total > 0 ? "ok" : "neutro"}
              acao="Ver resumo"
              onClick={() => rolarParaSecao("fiscal")}
            />

            <ResumoCard
              icone="📌"
              titulo="Último atendimento"
              valor={ultimaAnotacao ? formatarDataBR(String(ultimaAnotacao.data).slice(0, 10)) : "-"}
              detalhe={ultimaAnotacaoTexto}
              status={ultimaAnotacao ? "ok" : "neutro"}
              acao="Ver histórico"
              onClick={() => rolarParaSecao("historico")}
            />
          </div>

          <div id="central-financeiro" style={observacaoBox}>
            <div style={secaoTopo}>
              <div>
                <span style={infoLabel}>Financeiro do Cliente</span>
                <p style={secaoDescricao}>Resumo vindo do módulo Financeiro, sem duplicar lançamentos.</p>
              </div>

              <button style={button} onClick={abrirFinanceiroDoCliente}>
                Abrir Financeiro
              </button>
            </div>

            <div style={miniResumoGrid}>
              <MiniResumo label="Recebido" value={financeiroResumoCliente ? formatarMoeda(financeiroResumoCliente.recebidos) : "-"} destaque="positivo" />
              <MiniResumo label="Em aberto" value={financeiroResumoCliente ? formatarMoeda(financeiroResumoCliente.emAberto) : "-"} destaque={financeiroResumoCliente?.emAberto > 0 ? "atencao" : "positivo"} />
              <MiniResumo label="Lançamentos" value={financeiroResumoCliente?.total ?? "-"} />
              <MiniResumo label="Situação" value={financeiroResumoCliente?.situacao || "-"} destaque={financeiroResumoCliente?.emAberto > 0 ? "atencao" : "positivo"} />
            </div>

            {financeiroResumoCliente?.ultimo ? (
              <div style={resumoLinhaDestaque}>
                <strong>Último lançamento:</strong>
                <span>{financeiroResumoCliente.ultimo.descricao || "Lançamento financeiro"}</span>
                <span>{formatarMoeda(financeiroResumoCliente.ultimo.valorNumber)}</span>
              </div>
            ) : (
              <p style={observacaoTexto}>Nenhum lançamento financeiro encontrado para este cliente.</p>
            )}
          </div>

          <div id="central-fiscal" style={observacaoBox}>
            <div style={secaoTopo}>
              <div>
                <span style={infoLabel}>Fiscal do Cliente</span>
                <p style={secaoDescricao}>Resumo vindo do módulo Fiscal, mantendo o Fiscal como fonte oficial.</p>
              </div>

              <button style={button} onClick={abrirFiscalDoCliente}>
                Abrir Fiscal
              </button>
            </div>

            <div style={miniResumoGrid}>
              <MiniResumo label="Em aberto" value={fiscalResumoCliente?.abertas ?? "-"} destaque={fiscalResumoCliente?.abertas > 0 ? "atencao" : "positivo"} />
              <MiniResumo label="Total fiscal" value={fiscalResumoCliente?.total ?? "-"} />
              <MiniResumo label="Situação" value={fiscalResumoCliente?.situacao || "-"} destaque={fiscalResumoCliente?.abertas > 0 ? "atencao" : "positivo"} />
              <MiniResumo label="Próximo vencimento" value={fiscalResumoCliente?.proxima?.vencimento ? formatarDataBR(fiscalResumoCliente.proxima.vencimento) : "-"} />
            </div>

            {fiscalResumoCliente?.proxima ? (
              <div style={resumoLinhaDestaque}>
                <strong>Próxima obrigação:</strong>
                <span>{fiscalResumoCliente.proxima.obrigacao || "Obrigação fiscal"}</span>
                <span>{formatarDataBR(fiscalResumoCliente.proxima.vencimento)}</span>
              </div>
            ) : fiscalResumoCliente?.ultima ? (
              <div style={resumoLinhaDestaque}>
                <strong>Última obrigação:</strong>
                <span>{fiscalResumoCliente.ultima.obrigacao || "Obrigação fiscal"}</span>
                <span>{fiscalResumoCliente.ultima.status || "-"}</span>
              </div>
            ) : (
              <p style={observacaoTexto}>Nenhuma obrigação fiscal encontrada para este cliente.</p>
            )}
          </div>

          <div id="central-acoes" style={observacaoBox}>
            <div style={secaoTopo}>
              <div>
                <span style={infoLabel}>Próximas Ações</span>
                <p style={secaoDescricao}>Tarefas que ainda precisam ser feitas para este cliente.</p>
              </div>
            </div>

            <div style={acaoForm}>
              <input
                style={input}
                placeholder="Ex: Entregar DAS, emitir NFS-e, fazer declaração..."
                value={novaAcao}
                onChange={(e) => setNovaAcao(e.target.value)}
              />

              <input
                style={input}
                type="date"
                value={vencimentoAcao}
                onChange={(e) => setVencimentoAcao(e.target.value)}
              />

              <button style={button} onClick={salvarProximaAcaoCliente}>
                Salvar Ação
              </button>
            </div>

            <div style={anotacoesLista}>
              {proximasAcoesCliente.length > 0 ? (
                proximasAcoesCliente
                  .slice()
                  .sort((a, b) => String(a.vencimento || "9999-12-31").localeCompare(String(b.vencimento || "9999-12-31")))
                  .map((item) => (
                    <div key={item.id || item.dataCriacao} style={acaoItem}>
                      <div>
                        <strong style={acaoTitulo}>{item.descricao}</strong>
                        <span style={acaoData}>
                          {item.vencimento ? `Vence em ${formatarDataBR(item.vencimento)}` : "Sem vencimento"}
                        </span>
                      </div>

                      <div style={acaoBotoes}>
                        <button
                          type="button"
                          style={botaoConcluirAcao}
                          onClick={() => concluirProximaAcaoCliente(item.id || item.dataCriacao)}
                        >
                          Concluir
                        </button>

                        <button
                          type="button"
                          title="Excluir ação"
                          style={botaoLixeiraAnotacao}
                          onClick={() => excluirProximaAcaoCliente(item.id || item.dataCriacao)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <p style={observacaoTexto}>Nenhuma próxima ação cadastrada.</p>
              )}
            </div>
          </div>

          <div id="central-historico" style={observacaoBox}>
            <div style={secaoTopo}>
              <div>
                <span style={infoLabel}>Histórico / Anotações do Cliente</span>
                <p style={secaoDescricao}>Linha do tempo do que já foi feito ou combinado com o cliente.</p>
              </div>
            </div>

            <textarea
              style={anotacaoTextarea}
              placeholder="Ex: Feita declaração IRPF 2025, emitida NFS-e, cliente enviou documentos..."
              value={novaAnotacao}
              onChange={(e) => setNovaAnotacao(e.target.value)}
            />

            <button style={button} onClick={salvarAnotacaoCliente}>
              Salvar Anotação
            </button>

            <div style={anotacoesLista}>
              {anotacoesCliente.length > 0 ? (
                anotacoesCliente
                  .slice()
                  .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
                  .map((item) => (
                    <div key={item.id || item.data} style={anotacaoItem}>
                      <div style={anotacaoTopo}>
                        <span style={anotacaoData}>{item.tipo ? `${item.tipo} • ` : ""}{formatarDataHoraBR(item.data)}</span>

                        <button
                          type="button"
                          title="Excluir anotação"
                          style={botaoLixeiraAnotacao}
                          onClick={() => excluirAnotacaoCliente(item.id || item.data)}
                        >
                          🗑️
                        </button>
                      </div>

                      <p style={observacaoTexto}>{item.texto}</p>
                    </div>
                  ))
              ) : (
                <p style={observacaoTexto}>Nenhuma anotação registrada.</p>
              )}
            </div>
          </div>

          <div id="central-documentos" style={observacaoBox}>
            <div style={secaoTopo}>
              <div>
                <span style={infoLabel}>Arquivos Anexados</span>
                <p style={secaoDescricao}>Documentos do cadastro do cliente.</p>
              </div>
            </div>

            {anexosCliente.length > 0 ? (
              <div style={arquivosLista}>
                {anexosCliente.map((arquivo, index) => (
                  <div key={index} style={arquivoItem}>
                    <span>📎 {arquivo.nome}</span>

                    <button
                      style={openFileButton}
                      onClick={() => abrirArquivo(arquivo.caminho)}
                    >
                      Abrir
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={observacaoTexto}>
                Nenhum arquivo anexado.
              </p>
            )}
          </div>

          <div id="central-dados" style={observacaoBox}>
            <div style={secaoTopo}>
              <div>
                <span style={infoLabel}>Dados Cadastrais</span>
                <p style={secaoDescricao}>Informações completas do cadastro.</p>
              </div>
            </div>

            <div style={detailsGrid}>
              <Info label="Cliente" value={clienteSelecionado.nome} />
              <Info label="CPF" value={clienteSelecionado.cpf} />
              <Info label="Telefone" value={clienteSelecionado.telefone} />
              <Info label="E-mail" value={clienteSelecionado.email} />
              <Info label="CNPJ" value={clienteSelecionado.cnpj} />
              <Info label="Regime" value={clienteSelecionado.regime} />
              <Info label="CEP" value={clienteSelecionado.cep} />
              <Info label="Endereço" value={clienteSelecionado.endereco} />
              <Info label="Número" value={clienteSelecionado.numero} />
              <Info label="Bairro" value={clienteSelecionado.bairro} />
              <Info label="Cidade" value={clienteSelecionado.cidade} />
              <Info label="Estado" value={clienteSelecionado.estado} />
              <Info label="Complemento" value={clienteSelecionado.complemento} />
              <Info label="Data Nascimento" value={formatarDataBR(clienteSelecionado.dataNascimento)} />
              <Info label="Título de Eleitor" value={clienteSelecionado.tituloEleitor} />
              <Info label="Código Simples Nacional" value={clienteSelecionado.codigoSimplesNacional} />
              <Info label="Senha Gov.br" value={clienteSelecionado.senhaGovBr} />
              <Info label="CNAE Principal" value={clienteSelecionado.cnaePrincipal} />
              <Info label="Inscrição Municipal" value={clienteSelecionado.inscricaoMunicipal} />
              <Info label="Inscrição Estadual" value={clienteSelecionado.inscricaoEstadual} />
              <Info label="Alvará" value={clienteSelecionado.alvara} />
            </div>
          </div>

          <div style={observacaoBox}>
            <span style={infoLabel}>Observação</span>

            <p style={observacaoTexto}>
              {clienteSelecionado.observacao || "Não informado"}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function formatarDataBR(data) {
  if (!data) return ""

  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR")
}

function formatarDataHoraBR(data) {
  if (!data) return ""

  return new Date(data).toLocaleString("pt-BR")
}

function Info({ label, value }) {
  return (
    <div style={infoBox}>
      <span style={infoLabel}>{label}</span>
      <strong style={infoValue}>{value || "Não informado"}</strong>
    </div>
  )
}

function ResumoCard({ icone, titulo, valor, detalhe, status = "neutro", acao, onClick }) {
  return (
    <button type="button" style={{ ...resumoCard, ...resumoCardStatus(status) }} onClick={onClick}>
      <div style={resumoCardTopo}>
        <span style={resumoIcone}>{icone}</span>
        <span style={resumoStatusPonto(status)} />
      </div>

      <span style={resumoTitulo}>{titulo}</span>
      <strong style={resumoValor}>{valor}</strong>
      <small style={resumoDetalhe}>{detalhe}</small>

      <span style={resumoAcao}>{acao || "Abrir"}</span>
    </button>
  )
}

const centralHero = {
  scrollMarginTop: "96px",
  background: "linear-gradient(135deg, rgba(0,168,255,.18), rgba(55,255,116,.10))",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: "22px",
  padding: "24px",
  marginBottom: "18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  flexWrap: "wrap",
}

const centralHeroInfo = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
}

const clienteAvatar = {
  width: "72px",
  height: "72px",
  borderRadius: "22px",
  background: "linear-gradient(135deg, #00a8ff, #37ff74)",
  color: "#00112b",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "32px",
  fontWeight: "900",
  flexShrink: 0,
}

const centralBadge = {
  display: "inline-block",
  color: "#37ff74",
  background: "rgba(55,255,116,.10)",
  border: "1px solid rgba(55,255,116,.18)",
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: "800",
  marginBottom: "8px",
  textTransform: "uppercase",
  letterSpacing: ".06em",
}

const centralTitulo = {
  margin: 0,
  color: "white",
  fontSize: "30px",
  lineHeight: "36px",
}

const centralMeta = {
  marginTop: "8px",
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  color: "#c4d4ea",
  fontWeight: "600",
}

const centralBotoes = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
}

const centralMenu = {
  position: "sticky",
  top: "12px",
  zIndex: 5,
  background: "rgba(3,18,42,.94)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: "18px",
  padding: "12px",
  marginBottom: "18px",
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  boxShadow: "0 14px 30px rgba(0,0,0,.20)",
}

const centralMenuBotao = {
  padding: "10px 13px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.08)",
  color: "white",
  fontWeight: "800",
  cursor: "pointer",
  fontSize: "13px",
}

const centralMenuBotaoPreparado = {
  ...centralMenuBotao,
  color: "#37ff74",
  background: "rgba(55,255,116,.10)",
}

const contatoRapido = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
  marginBottom: "18px",
}

const resumoGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "24px",
}

const resumoCard = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "18px",
  textAlign: "left",
  cursor: "pointer",
  transition: "transform .18s ease, border .18s ease, background .18s ease",
  color: "white",
  minHeight: "172px",
}

function resumoCardStatus(status) {
  if (status === "ok") {
    return {
      border: "1px solid rgba(55,255,116,.35)",
      background: "linear-gradient(180deg, rgba(55,255,116,.12), #061f47)",
    }
  }

  if (status === "atencao") {
    return {
      border: "1px solid rgba(255,193,7,.42)",
      background: "linear-gradient(180deg, rgba(255,193,7,.13), #061f47)",
    }
  }

  if (status === "urgente") {
    return {
      border: "1px solid rgba(255,77,79,.42)",
      background: "linear-gradient(180deg, rgba(255,77,79,.14), #061f47)",
    }
  }

  if (status === "preparado") {
    return {
      border: "1px dashed rgba(0,168,255,.45)",
      background: "linear-gradient(180deg, rgba(0,168,255,.10), #061f47)",
    }
  }

  return {}
}

function resumoStatusPonto(status) {
  const cores = {
    ok: "#37ff74",
    atencao: "#ffd166",
    urgente: "#ff7072",
    preparado: "#00a8ff",
    neutro: "#7f93ad",
  }

  return {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: cores[status] || cores.neutro,
    boxShadow: `0 0 12px ${cores[status] || cores.neutro}`,
  }
}

const resumoCardTopo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
}

const resumoIcone = {
  fontSize: "26px",
  lineHeight: "30px",
}

const resumoTitulo = {
  display: "block",
  color: "#a9b8cc",
  fontSize: "13px",
  marginBottom: "8px",
  textTransform: "uppercase",
  letterSpacing: ".5px",
}

const resumoValor = {
  display: "block",
  color: "white",
  fontSize: "26px",
  lineHeight: "32px",
  marginBottom: "6px",
}

const resumoDetalhe = {
  display: "block",
  color: "#c4d4ea",
  marginTop: "6px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}

const resumoAcao = {
  display: "inline-block",
  color: "#37ff74",
  fontSize: "12px",
  fontWeight: "bold",
  marginTop: "12px",
}

const secaoTopo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "14px",
}

const secaoDescricao = {
  margin: "4px 0 0",
  color: "#a9b8cc",
  fontSize: "14px",
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const topo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "25px",
}

const pesquisaBox = {
  marginBottom: "18px",
}

const form = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
}

const input = {
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
}

const dateBox = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
}

const dateLabel = {
  color: "#a9b8cc",
  fontSize: "13px",
  paddingLeft: "4px",
}

const textarea = {
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
  minHeight: "120px",
  resize: "vertical",
  gridColumn: "1 / -1",
}

const uploadBox = {
  gridColumn: "1 / -1",
}

const uploadLabel = {
  display: "inline-block",
  padding: "14px 20px",
  borderRadius: "12px",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const arquivosLista = {
  marginTop: "15px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
}

const arquivoItem = {
  background: "#061f47",
  padding: "12px",
  borderRadius: "10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
}

const fileActions = {
  display: "flex",
  gap: "8px",
}

const openFileButton = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "none",
  background: "#37ff74",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const removeFileButton = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "none",
  background: "#ff4d4f",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const button = {
  padding: "15px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const backButton = {
  padding: "12px 18px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const viewButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#37ff74",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const table = {
  width: "100%",
  borderCollapse: "collapse",
}

const th = {
  textAlign: "left",
  padding: "16px",
  color: "#a9b8cc",
}

const td = {
  padding: "16px",
}

const detailsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px",
  marginBottom: "20px",
}

const infoBox = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "16px",
  padding: "18px",
}

const infoLabel = {
  display: "block",
  color: "#a9b8cc",
  fontSize: "13px",
  marginBottom: "8px",
}

const infoValue = {
  color: "white",
  fontSize: "16px",
}

const observacaoBox = {
  scrollMarginTop: "96px",
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "16px",
  padding: "18px",
  marginBottom: "25px",
}

const observacaoTexto = {
  color: "white",
  lineHeight: "28px",
  margin: 0,
}

const anotacaoTextarea = {
  ...textarea,
  minHeight: "90px",
  marginBottom: "12px",
}

const anotacoesLista = {
  marginTop: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
}

const anotacaoItem = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.10)",
  borderRadius: "12px",
  padding: "14px",
}

const anotacaoData = {
  display: "block",
  color: "#37ff74",
  fontWeight: "bold",
  fontSize: "13px",
  marginBottom: "8px",
}

const acaoForm = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) 180px auto",
  gap: "12px",
  marginBottom: "16px",
}

const acaoItem = {
  background: "rgba(0,168,255,.08)",
  border: "1px solid rgba(0,168,255,.18)",
  borderRadius: "12px",
  padding: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
}

const acaoTitulo = {
  display: "block",
  color: "white",
  fontSize: "15px",
  marginBottom: "6px",
}

const acaoData = {
  color: "#a9b8cc",
  fontSize: "13px",
}

const acaoBotoes = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
}

const botaoConcluirAcao = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "none",
  background: "#37ff74",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const actions = {
  display: "flex",
  gap: "12px",
}

const editButton = {
  padding: "12px 18px",
  borderRadius: "12px",
  border: "none",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const deleteButton = {
  padding: "12px 18px",
  borderRadius: "12px",
  border: "none",
  background: "#ff4d4f",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

 const anotacaoTopo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  marginBottom: "8px",
}

 const botaoLixeiraAnotacao = {
  border: "none",
  background: "rgba(255,77,79,.18)",
  color: "#ff7072",
  borderRadius: "8px",
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: "16px",
}

 const financeiroCardValor = {
  color: "#37ff74",
  fontSize: "20px",
  fontWeight: "bold",
  marginTop: "6px",
}

const miniResumoGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
}

 const financeiroCardDetalhe = {
  color: "#a9b8cc",
  fontSize: "13px",
  marginTop: "4px",
}

const miniResumoCard = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.10)",
  borderRadius: "14px",
  padding: "16px",
}

function miniResumoStatus(status) {
  if (status === "positivo") return { borderColor: "rgba(55,255,116,.28)" }
  if (status === "atencao") return { borderColor: "rgba(255,159,67,.32)" }
  return {}
}

const miniResumoLabel = {
  display: "block",
  color: "#a9b8cc",
  fontSize: "13px",
  marginBottom: "8px",
}

const miniResumoValor = {
  color: "white",
  fontSize: "20px",
}

const resumoLinhaDestaque = {
  background: "rgba(0,168,255,.08)",
  border: "1px solid rgba(0,168,255,.16)",
  borderRadius: "12px",
  padding: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  color: "white",
}
