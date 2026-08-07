import { useEffect, useState } from "react"
import api from "../services/api"
import { abrirWhatsAppWeb, montarMensagemWhatsApp } from "../services/whatsappService"
import DasMeiAnual from "../components/DasMeiAnual"

export default function Fiscal() {
  const [cliente, setCliente] = useState("")
  const [clienteFiltro, setClienteFiltro] = useState("")
  const [obrigacao, setObrigacao] = useState("")
  const [competencia, setCompetencia] = useState("")
  const [vencimento, setVencimento] = useState("")
  const [status, setStatus] = useState("")
  const [valor, setValor] = useState("")
  const [observacao, setObservacao] = useState("")
  const [parcelamento, setParcelamento] = useState({
    orgao: "Receita Federal",
    descricao: "Parcelamento",
    parcelaAtual: "",
    totalParcelas: "",
    diaVencimento: "",
  })
  const [anexos, setAnexos] = useState([])
  const [editandoId, setEditandoId] = useState(null)
  const [arquivoAberto, setArquivoAberto] = useState(null)

  const [clientesCadastrados, setClientesCadastrados] = useState([])
  const [obrigacoes, setObrigacoes] = useState([])

  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}")
  const clienteDasMei = clientesCadastrados.find((item) => item.nome === clienteFiltro) || null

  useEffect(() => {
    carregarObrigacoes()
    carregarClientes()

    if (usuario?.perfil === "Cliente") {
      setCliente(usuario.clienteVinculado || "")
      setClienteFiltro(usuario.clienteVinculado || "")
      return
    }

    const clienteDashboard = localStorage.getItem("nexaFiltroFiscalCliente") || ""

    if (clienteDashboard) {
      setCliente(clienteDashboard)
      setClienteFiltro(clienteDashboard)
    }
  }, [])

  useEffect(() => {
    if (usuario?.perfil === "Cliente") return

    const clienteDashboard = localStorage.getItem("nexaFiltroFiscalCliente") || ""

    if (!clienteDashboard || clientesCadastrados.length === 0) return

    const clienteEncontrado = clientesCadastrados.find(
      (item) => String(item.nome || "").trim() === clienteDashboard.trim()
    )

    if (clienteEncontrado) {
      setCliente(clienteEncontrado.nome)
      setClienteFiltro(clienteEncontrado.nome)
    }
  }, [clientesCadastrados])

  useEffect(() => {
    if (usuario?.perfil === "Cliente") return undefined

    function atualizarFiltroFiscal(evento) {
      const clienteNome = String(evento?.detail?.clienteNome || "").trim()

      if (!clienteNome) {
        setCliente("")
        setClienteFiltro("")
        return
      }

      const clienteEncontrado = clientesCadastrados.find(
        (item) => String(item.nome || "").trim() === clienteNome
      )
      const nome = clienteEncontrado?.nome || clienteNome
      setCliente(nome)
      setClienteFiltro(nome)
    }

    window.addEventListener("nexa:filtro-fiscal-atualizado", atualizarFiltroFiscal)
    return () => window.removeEventListener("nexa:filtro-fiscal-atualizado", atualizarFiltroFiscal)
  }, [clientesCadastrados, usuario?.perfil])

  async function carregarObrigacoes() {
    try {
      const resposta = await api.get("/fiscal")
      setObrigacoes(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      alert("Erro ao carregar obrigações")
      console.error(error)
    }
  }

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientesCadastrados(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      alert("Erro ao carregar clientes")
      console.error(error)
    }
  }

  function formatarValor(valorDigitado) {
    const somenteNumeros = String(valorDigitado).replace(/\D/g, "")
    const numero = Number(somenteNumeros) / 100

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function formatarCompetencia(valorDigitado) {
    let valor = String(valorDigitado).replace(/\D/g, "")

    if (valor.length > 6) valor = valor.slice(0, 6)
    if (valor.length >= 3) valor = valor.slice(0, 2) + "/" + valor.slice(2)

    return valor
  }


  function atualizarCampoParcelamento(campo, valorCampo) {
    setParcelamento((atual) => ({
      ...atual,
      [campo]: valorCampo,
    }))
  }

  function limparNumeroInteiro(valorCampo) {
    return String(valorCampo || "").replace(/\D/g, "")
  }

  function montarObservacaoParcelamento() {
    if (obrigacao !== "Parcelamento") return observacao

    const atual = limparNumeroInteiro(parcelamento.parcelaAtual)
    const total = limparNumeroInteiro(parcelamento.totalParcelas)
    const dia = limparNumeroInteiro(parcelamento.diaVencimento)
    const orgao = parcelamento.orgao || "Não informado"
    const descricao = parcelamento.descricao || "Parcelamento"

    const linhasParcelamento = [
      "[PARCELAMENTO]",
      `Órgão: ${orgao}`,
      `Descrição: ${descricao}`,
      `Parcela: ${atual || "-"}/${total || "-"}`,
      `Vencimento recorrente: dia ${dia || "-"}`,
      "[/PARCELAMENTO]",
    ]

    const observacaoSemBloco = String(observacao || "")
      .replace(/\[PARCELAMENTO\][\s\S]*?\[\/PARCELAMENTO\]/g, "")
      .trim()

    return [linhasParcelamento.join("\n"), observacaoSemBloco]
      .filter(Boolean)
      .join("\n\n")
  }

  function obterDadosParcelamento(item = {}) {
    if (item.parcelamento && typeof item.parcelamento === "object") {
      return item.parcelamento
    }

    const texto = String(item.observacao || "")
    const bloco = texto.match(/\[PARCELAMENTO\]([\s\S]*?)\[\/PARCELAMENTO\]/)

    if (!bloco) {
      return {
        orgao: "Receita Federal",
        descricao: item.obrigacao === "Parcelamento" ? "Parcelamento" : "",
        parcelaAtual: "",
        totalParcelas: "",
        diaVencimento: "",
      }
    }

    const conteudo = bloco[1]
    const parcela = conteudo.match(/Parcela:\s*(\d+|-)\/(\d+|-)/i)
    const dia = conteudo.match(/Vencimento recorrente:\s*dia\s*(\d+|-)/i)
    const orgao = conteudo.match(/Órgão:\s*(.*)/i)
    const descricao = conteudo.match(/Descrição:\s*(.*)/i)

    return {
      orgao: orgao?.[1]?.trim() || "Receita Federal",
      descricao: descricao?.[1]?.trim() || "Parcelamento",
      parcelaAtual: parcela?.[1] === "-" ? "" : parcela?.[1] || "",
      totalParcelas: parcela?.[2] === "-" ? "" : parcela?.[2] || "",
      diaVencimento: dia?.[1] === "-" ? "" : dia?.[1] || "",
    }
  }

  function removerBlocoParcelamento(texto) {
    return String(texto || "")
      .replace(/\[PARCELAMENTO\][\s\S]*?\[\/PARCELAMENTO\]/g, "")
      .trim()
  }

  function calcularProximoVencimento(dataAtual, diaRecorrente) {
    if (!dataAtual) return ""

    const data = new Date(`${String(dataAtual).slice(0, 10)}T00:00:00`)
    if (Number.isNaN(data.getTime())) return ""

    const dia = Number(limparNumeroInteiro(diaRecorrente)) || data.getDate()
    const proxima = new Date(data.getFullYear(), data.getMonth() + 1, 1)
    const ultimoDiaMes = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate()
    proxima.setDate(Math.min(dia, ultimoDiaMes))

    return proxima.toISOString().slice(0, 10)
  }

  function proximaCompetencia(competenciaAtual) {
    const partes = String(competenciaAtual || "").split("/")
    if (partes.length !== 2) return competenciaAtual

    const mes = Number(partes[0])
    const ano = Number(partes[1])

    if (!mes || !ano) return competenciaAtual

    const proximoMes = mes === 12 ? 1 : mes + 1
    const proximoAno = mes === 12 ? ano + 1 : ano

    return `${String(proximoMes).padStart(2, "0")}/${proximoAno}`
  }

  async function obterUrlAnexo(item) {
    if (!item.anexos || item.anexos.length === 0) return ""

    const arquivo = item.anexos[0]
    const caminho = arquivo.caminho || arquivo.url || ""

    if (!caminho) return ""

    const resposta = await api.get(
      `/fiscal/anexo-url?path=${encodeURIComponent(caminho)}`
    )

    return resposta.data.url
  }

  async function abrirAnexo(item) {
    try {
      const url = await obterUrlAnexo(item)

      if (!url) {
        alert("Nenhum anexo disponível.")
        return
      }

      setArquivoAberto(url)
    } catch (error) {
      console.error(error)
      alert("Erro ao abrir anexo.")
    }
  }

  async function adicionarAnexos(e) {
    const arquivos = Array.from(e.target.files || [])
    e.target.value = ""

    if (arquivos.length === 0) return

    const formData = new FormData()
    arquivos.forEach((arquivo) => formData.append("arquivos", arquivo))

    try {
      const resposta = await api.post("/fiscal/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      setAnexos((anteriores) => [...anteriores, ...resposta.data])
    } catch (error) {
      alert("Erro ao enviar arquivo fiscal")
      console.error(error)
    }
  }

  function removerAnexo(index) {
    setAnexos((anteriores) => anteriores.filter((_, i) => i !== index))
  }

  async function salvarObrigacao() {
    if (!cliente || !obrigacao || !competencia || !vencimento || !status) {
      alert("Preencha os campos obrigatórios")
      return
    }

    if (obrigacao === "Parcelamento") {
      if (!parcelamento.parcelaAtual || !parcelamento.totalParcelas || !parcelamento.diaVencimento) {
        alert("Informe parcela atual, total de parcelas e dia de vencimento do parcelamento.")
        return
      }
    }

    const novaObrigacao = {
      cliente,
      obrigacao,
      competencia,
      vencimento,
      status,
      valor,
      observacao: montarObservacaoParcelamento(),
      parcelamento: obrigacao === "Parcelamento" ? parcelamento : null,
      anexos,
    }

    try {
      if (editandoId !== null) {
        await api.put(`/fiscal/${editandoId}`, novaObrigacao)
      } else {
        await api.post("/fiscal", novaObrigacao)
      }

      await carregarObrigacoes()
      limparCampos()
    } catch (error) {
      alert("Erro ao salvar pendência")
      console.error(error)
    }
  }

  function editarObrigacao(item) {
    setCliente(item.cliente || "")
    setObrigacao(item.obrigacao || "")
    setCompetencia(item.competencia || "")
    setVencimento(item.vencimento || "")
    setStatus(item.status || "")
    setValor(item.valor || "")
    setParcelamento(obterDadosParcelamento(item))
    setObservacao(removerBlocoParcelamento(item.observacao || ""))
    setAnexos(Array.isArray(item.anexos) ? item.anexos : [])
    setEditandoId(item.id)

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function concluirObrigacao(item) {
    const isParcelamento = item.obrigacao === "Parcelamento"
    const dadosParcelamento = obterDadosParcelamento(item)
    const parcelaAtual = Number(limparNumeroInteiro(dadosParcelamento.parcelaAtual))
    const totalParcelas = Number(limparNumeroInteiro(dadosParcelamento.totalParcelas))
    const temProximaParcela = isParcelamento && parcelaAtual > 0 && totalParcelas > 0 && parcelaAtual < totalParcelas

    const mensagemConfirmacao = isParcelamento
      ? `Confirmar envio/conclusão da parcela ${parcelaAtual || "-"}/${totalParcelas || "-"}?${temProximaParcela ? "\n\nO Nexa já criará a próxima parcela automaticamente." : "\n\nEsta é a última parcela ou o total não foi informado."}`
      : "Deseja concluir esta obrigação e gerar lançamento contábil automático?"

    const confirmar = window.confirm(mensagemConfirmacao)

    if (!confirmar) return

    try {
      if (temProximaParcela) {
        const proximoParcelamento = {
          ...dadosParcelamento,
          parcelaAtual: String(parcelaAtual + 1),
          totalParcelas: String(totalParcelas),
        }

        const observacaoAtualizada = String(item.observacao || "")
          .replace(/\[PARCELAMENTO\][\s\S]*?\[\/PARCELAMENTO\]/g, "")
          .trim()

        const linhasParcelamento = [
          "[PARCELAMENTO]",
          `Órgão: ${proximoParcelamento.orgao || "Receita Federal"}`,
          `Descrição: ${proximoParcelamento.descricao || "Parcelamento"}`,
          `Parcela: ${proximoParcelamento.parcelaAtual}/${proximoParcelamento.totalParcelas}`,
          `Vencimento recorrente: dia ${proximoParcelamento.diaVencimento || "-"}`,
          "[/PARCELAMENTO]",
        ]

        await api.post("/fiscal", {
          cliente: item.cliente,
          obrigacao: "Parcelamento",
          competencia: proximaCompetencia(item.competencia),
          vencimento: calcularProximoVencimento(item.vencimento, proximoParcelamento.diaVencimento),
          status: "Pendente",
          valor: item.valor || "",
          observacao: [linhasParcelamento.join("\n"), observacaoAtualizada]
            .filter(Boolean)
            .join("\n\n"),
          parcelamento: proximoParcelamento,
          anexos: [],
        })
      }

      await api.patch(`/fiscal/${item.id}/concluir`)
      await carregarObrigacoes()
    } catch (error) {
      alert("Erro ao concluir obrigação")
      console.error(error)
    }
  }

  async function excluirObrigacao(item) {
    const confirmar = window.confirm("Deseja realmente excluir esta obrigação?")

    if (!confirmar) return

    try {
      if (!item?.id) {
        alert("Não foi possível excluir: ID da obrigação não encontrado.")
        return
      }

      await api.delete(`/fiscal/${item.id}`)
      await carregarObrigacoes()
      alert("Obrigação excluída com sucesso")
    } catch (error) {
      console.error("ERRO AO EXCLUIR OBRIGAÇÃO:", error)
      alert(error?.response?.data?.message || "Erro ao excluir obrigação")
    }
  }

  function limparCampos() {
    setCliente(usuario?.perfil === "Cliente" ? usuario.clienteVinculado || "" : "")
    setObrigacao("")
    setCompetencia("")
    setVencimento("")
    setStatus("")
    setValor("")
    setObservacao("")
    setParcelamento({
      orgao: "Receita Federal",
      descricao: "Parcelamento",
      parcelaAtual: "",
      totalParcelas: "",
      diaVencimento: "",
    })
    setAnexos([])
    setEditandoId(null)
  }

  function corStatusFiscal(statusFiscal) {
    if (statusFiscal === "Concluído") return badgeBlue
    if (statusFiscal === "Pago pelo cliente" || statusFiscal === "Pago") return badgeSuccess
    if (statusFiscal === "Atrasado") return badgeDanger
    if (statusFiscal === "Pendente" || statusFiscal === "Em andamento") return badgeWarning
    return {}
  }

  function limparTelefoneWhatsApp(telefone) {
    let numero = String(telefone || "").replace(/\D/g, "")

    if (!numero) return ""

    if (numero.startsWith("55")) return numero

    return `55${numero}`
  }

  function formatarDataBrasil(data) {
    if (!data) return "Não informado"

    const partes = String(data).split("-")

    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`
    }

    return data
  }

  function obterClienteCadastrado(nomeCliente) {
    return clientesCadastrados.find(
      (item) => String(item.nome || "").trim() === String(nomeCliente || "").trim()
    )
  }

  async function registrarWhatsAppNoHistorico(clienteCadastrado, modeloTitulo, mensagem) {
    if (!clienteCadastrado?.id) return

    const anotacao = {
      id: Date.now(),
      data: new Date().toISOString(),
      tipo: "WhatsApp",
      texto: `💬 WhatsApp enviado pelo Fiscal — ${modeloTitulo}`,
      mensagem,
    }

    const anotacoesAtualizadas = [
      anotacao,
      ...(Array.isArray(clienteCadastrado.anotacoes) ? clienteCadastrado.anotacoes : []),
    ]

    try {
      await api.put(`/clientes/${clienteCadastrado.id}`, {
        ...clienteCadastrado,
        anotacoes: anotacoesAtualizadas,
      })

      await carregarClientes()
    } catch (error) {
      console.error("Erro ao registrar WhatsApp no histórico do cliente", error)
      alert("WhatsApp aberto, mas não foi possível registrar no histórico.")
    }
  }

  async function abrirWhatsApp(item, tipoMensagem) {
    const clienteCadastrado = obterClienteCadastrado(item.cliente)

    if (!clienteCadastrado?.telefone) {
      alert("Este cliente não possui telefone cadastrado.")
      return
    }

    const modelosPorTipo = {
      nova: "novaPendencia",
      tresDias: "venceTresDias",
      hoje: "venceHoje",
    }

    const modeloKey = modelosPorTipo[tipoMensagem] || "novaPendencia"
    const titulosPorTipo = {
      nova: "Nova pendência",
      tresDias: "Vence em 3 dias",
      hoje: "Vence hoje",
    }

    const mensagem = montarMensagemWhatsApp(modeloKey, {
      cliente: item.cliente || clienteCadastrado?.nome || "cliente",
      telefone: clienteCadastrado.telefone,
      obrigacao: item.obrigacao || "pendência",
      competencia: item.competencia || "Não informada",
      vencimento: item.vencimento,
      valor: item.valor || "",
    })

    try {
      abrirWhatsAppWeb({ telefone: clienteCadastrado.telefone, mensagem })
      await registrarWhatsAppNoHistorico(clienteCadastrado, titulosPorTipo[tipoMensagem] || "Mensagem", mensagem)
    } catch (error) {
      alert(error.message || "Erro ao abrir WhatsApp")
    }
  }

  const obrigacoesVisiveis = obrigacoes.filter((item) => {
    const statusAtual = String(item.status || "").toLowerCase()
    const concluido = statusAtual.includes("concluído") || statusAtual.includes("concluido")

    if (concluido) return false

    if (usuario?.perfil === "Cliente") {
      return item.cliente === usuario.clienteVinculado
    }

    if (!clienteFiltro) return false

    return item.cliente === clienteFiltro
  })

  return (
    <div style={box}>
      {usuario?.perfil !== "Cliente" && (
        <div style={form}>
          <select style={input} value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="">Selecione o cliente</option>
            {clientesCadastrados.map((item) => (
              <option key={item.id} value={item.nome}>{item.nome}</option>
            ))}
          </select>

          <select style={input} value={obrigacao} onChange={(e) => setObrigacao(e.target.value)}>
            <option value="">Obrigação</option>
            <option value="DAS">DAS</option>
            <option value="Honorários Contábeis">Honorários Contábeis</option>
            <option value="Parcelamento">Parcelamento</option>
            <option value="DCTFWeb">DCTFWeb</option>
            <option value="SPED Fiscal">SPED Fiscal</option>
            <option value="DEFIS">DEFIS</option>
            <option value="PGDAS-D">PGDAS-D</option>
          </select>

          <input
            style={input}
            placeholder="00/0000"
            value={competencia}
            onChange={(e) => setCompetencia(formatarCompetencia(e.target.value))}
          />

          <input type="date" style={input} value={vencimento} onChange={(e) => setVencimento(e.target.value)} />

          <select style={input} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Enviado">Enviado</option>
            <option value="Pago">Pago</option>
            <option value="Pago pelo cliente">Pago pelo cliente</option>
            <option value="Concluído">Concluído</option>
            <option value="Atrasado">Atrasado</option>
          </select>

          <input style={input} placeholder="R$ 0,00" value={valor} onChange={(e) => setValor(formatarValor(e.target.value))} />

          {obrigacao === "Parcelamento" && (
            <div style={parcelamentoBox}>
              <div style={parcelamentoHeader}>
                <strong>Controle de Parcelamento</strong>
                <span>O Nexa controla a parcela atual e já prepara a próxima ao concluir.</span>
              </div>

              <div style={parcelamentoGrid}>
                <input
                  style={input}
                  placeholder="Órgão. Ex: Receita Federal"
                  value={parcelamento.orgao}
                  onChange={(e) => atualizarCampoParcelamento("orgao", e.target.value)}
                />

                <input
                  style={input}
                  placeholder="Descrição. Ex: Parcelamento Simples Nacional"
                  value={parcelamento.descricao}
                  onChange={(e) => atualizarCampoParcelamento("descricao", e.target.value)}
                />

                <input
                  style={input}
                  placeholder="Parcela atual. Ex: 10"
                  value={parcelamento.parcelaAtual}
                  onChange={(e) => atualizarCampoParcelamento("parcelaAtual", limparNumeroInteiro(e.target.value))}
                />

                <input
                  style={input}
                  placeholder="Total de parcelas. Ex: 60"
                  value={parcelamento.totalParcelas}
                  onChange={(e) => atualizarCampoParcelamento("totalParcelas", limparNumeroInteiro(e.target.value))}
                />

                <input
                  style={input}
                  placeholder="Dia de vencimento mensal. Ex: 28"
                  value={parcelamento.diaVencimento}
                  onChange={(e) => atualizarCampoParcelamento("diaVencimento", limparNumeroInteiro(e.target.value).slice(0, 2))}
                />
              </div>
            </div>
          )}

          <textarea style={textarea} placeholder="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />

          <div style={uploadBox}>
            <label style={uploadLabel}>
              Anexar Guia / Documento
              <input type="file" multiple style={{ display: "none" }} onChange={adicionarAnexos} />
            </label>

            {anexos.length > 0 && (
              <div style={arquivosLista}>
                {anexos.map((arquivo, index) => (
                  <div key={`${arquivo.caminho || arquivo.nome || "arquivo"}-${index}`} style={arquivoItem}>
                    <span>📎 {arquivo.nome || "Arquivo anexado"}</span>

                    <button type="button" style={botaoExcluirAnexo} onClick={() => removerAnexo(index)}>
                      Excluir anexo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="button" style={button} onClick={salvarObrigacao}>
            {editandoId !== null ? "Salvar Correção" : "Salvar Pendência"}
          </button>

          {editandoId !== null && (
            <button type="button" style={buttonSecondary} onClick={limparCampos}>
              Cancelar Correção
            </button>
          )}
        </div>
      )}

      {usuario?.perfil === "Cliente" && (
        <div style={clienteAviso}>
          <strong>Pendências e Guias</strong>
          <span>Visualize guias, honorários, vencimentos e documentos enviados pelo escritório.</span>
        </div>
      )}

      {usuario?.perfil !== "Cliente" && (
        <div style={filterBox}>
          <strong style={{ color: "white" }}>Visualizar cliente</strong>
          <select style={filterInput} value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)}>
            <option value="">Selecione um cliente</option>
            {clientesCadastrados.map((item) => (
              <option key={item.id} value={item.nome}>{item.nome}</option>
            ))}
          </select>
        </div>
      )}

      {usuario?.perfil !== "Cliente" && clienteDasMei && (
        <DasMeiAnual cliente={clienteDasMei} onAtualizarFiscal={carregarObrigacoes} />
      )}

      <div style={tableWrapper}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={th}>Obrigação</th>
              <th style={th}>Competência</th>
              <th style={th}>Vencimento</th>
              <th style={th}>Status</th>
              <th style={th}>Valor</th>
              <th style={th}>Alerta</th>
              <th style={th}>Dias</th>
              <th style={th}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {obrigacoesVisiveis.map((item) => (
              <tr key={item.id}>
                <td style={td}>{item.cliente}</td>
                <td style={td}>
                  <strong>{item.obrigacao}</strong>
                  {item.obrigacao === "Parcelamento" && (() => {
                    const dados = obterDadosParcelamento(item)
                    return (
                      <div style={parcelamentoResumoTabela}>
                        Parcela {dados.parcelaAtual || "-"}/{dados.totalParcelas || "-"}
                        {dados.orgao ? ` • ${dados.orgao}` : ""}
                      </div>
                    )
                  })()}
                </td>
                <td style={td}>{item.competencia}</td>
                <td style={td}>{item.vencimento}</td>

                <td style={td}>
                  <span style={{ ...badge, ...corStatusFiscal(item.status) }}>{item.status}</span>
                </td>

                <td style={td}>{item.valor || "Não informado"}</td>

                <td style={td}>
                  <span
                    style={{
                      ...badge,
                      ...(item.alertaFiscal === "Vencido" ? badgeDanger : {}),
                      ...(item.alertaFiscal === "Vencendo" || item.alertaFiscal === "Vence hoje" ? badgeWarning : {}),
                      ...(item.alertaFiscal === "Regularizado" ? badgeSuccess : {}),
                    }}
                  >
                    {item.alertaFiscal || "Em dia"}
                  </span>
                </td>

                <td style={td}>{item.diasParaVencer !== null && item.diasParaVencer !== undefined ? item.diasParaVencer : "-"}</td>

                <td style={td}>
                  <select
                    style={actionSelect}
                    defaultValue=""
                    onChange={async (e) => {
                      const acao = e.target.value
                      e.target.value = ""

                      if (acao === "visualizar") abrirAnexo(item)

                      if (acao === "baixar") {
                        const url = await obterUrlAnexo(item)
                        if (url) window.open(url, "_blank")
                      }

                      if (acao === "whatsapp-nova") abrirWhatsApp(item, "nova")
                      if (acao === "whatsapp-tres-dias") abrirWhatsApp(item, "tresDias")
                      if (acao === "whatsapp-hoje") abrirWhatsApp(item, "hoje")
                      if (acao === "concluir") concluirObrigacao(item)
                      if (acao === "editar") editarObrigacao(item)
                      if (acao === "excluir") excluirObrigacao(item)
                    }}
                  >
                    <option value="">Ações</option>

                    {item.anexos?.length > 0 && (
                      <>
                        <option value="visualizar">Visualizar</option>
                        <option value="baixar">Baixar</option>
                      </>
                    )}

                    {usuario?.perfil !== "Cliente" && (
                      <>
                        <option value="whatsapp-nova">WhatsApp - Nova pendência</option>
                        <option value="whatsapp-tres-dias">WhatsApp - Vence em 3 dias</option>
                        <option value="whatsapp-hoje">WhatsApp - Vence hoje</option>
                      </>
                    )}

                    {usuario?.perfil !== "Cliente" && item.status !== "Concluído" && (
                      <option value="concluir">Concluir</option>
                    )}

                    {usuario?.perfil !== "Cliente" && (
                      <>
                        <option value="editar">Editar</option>
                        <option value="excluir">Excluir</option>
                      </>
                    )}
                  </select>
                </td>
              </tr>
            ))}

            {obrigacoesVisiveis.length === 0 && (
              <tr>
                <td style={td} colSpan="9">Selecione um cliente para visualizar pendências ativas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {arquivoAberto && (
        <div style={modalBg}>
          <div style={modalPdf}>
            <div style={modalHeader}>
              <strong>Visualizar Documento</strong>
              <button style={modalClose} onClick={() => setArquivoAberto(null)}>Fechar</button>
            </div>

            <iframe src={arquivoAberto} title="Documento Fiscal" style={iframePdf} />
          </div>
        </div>
      )}
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const form = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginBottom: "30px",
}

const input = {
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
}

const textarea = {
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
  minHeight: "100px",
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
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
}

const botaoExcluirAnexo = {
  background: "#ff4d4f",
  border: "none",
  color: "white",
  padding: "7px 12px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
}

const actionSelect = {
  padding: "9px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
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

const buttonSecondary = {
  ...button,
  background: "#ff4d4f",
  color: "white",
}

const clienteAviso = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "16px",
  padding: "18px",
  marginBottom: "22px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
}

const filterBox = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: "18px",
  padding: "18px",
  marginBottom: "22px",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
}

const filterInput = {
  ...input,
  minWidth: "260px",
}

const tableWrapper = {
  width: "100%",
  overflowX: "auto",
}

const table = {
  width: "100%",
  borderCollapse: "collapse",
}

const th = {
  textAlign: "left",
  padding: "16px",
  color: "#a9b8cc",
  whiteSpace: "nowrap",
}

const td = {
  padding: "12px 10px",
  fontSize: "14px",
  verticalAlign: "middle",
}

const badge = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: "999px",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  fontSize: "12px",
  whiteSpace: "nowrap",
}

const badgeBlue = { background: "#00a8ff", color: "white" }
const badgeDanger = { background: "#ff4d4f", color: "white" }
const badgeWarning = { background: "#ffc107", color: "#00112b" }
const badgeSuccess = { background: "#37ff74", color: "#00112b" }

const parcelamentoBox = {
  gridColumn: "1 / -1",
  background: "rgba(55,255,116,.08)",
  border: "1px solid rgba(55,255,116,.24)",
  borderRadius: "18px",
  padding: "18px",
}

const parcelamentoHeader = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  marginBottom: "14px",
  color: "white",
}

const parcelamentoGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "12px",
}

const parcelamentoResumoTabela = {
  marginTop: "6px",
  color: "#37ff74",
  fontSize: "12px",
  fontWeight: "bold",
}

const modalBg = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.7)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
}

const modalPdf = {
  width: "90%",
  height: "90%",
  background: "#061f47",
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,.15)",
  overflow: "hidden",
}

const modalHeader = {
  height: "58px",
  padding: "0 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "white",
}

const modalClose = {
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  background: "#ff4d4f",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const iframePdf = {
  width: "100%",
  height: "calc(100% - 58px)",
  border: "none",
  background: "white",
}
