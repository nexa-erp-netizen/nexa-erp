import { useEffect, useMemo, useRef, useState } from "react"
import api from "../services/api"
import {
  abrirConversaNexa,
  atualizarConversaNexa,
  conversarComNexa,
  excluirConversaNexa,
  excluirMemoriaNexa,
  listarConversasNexa,
  listarMemoriasNexa,
  verificarProvedores,
} from "../services/conversaNexaService"
import {
  limparConversaVoz,
  obterContextoVoz,
  registrarClienteVoz,
  registrarConversaVoz,
} from "../services/nexaVoiceService"

const SUGESTOES = [
  "Bom dia",
  "Qual a categoria do código 1163 do INSS?",
  "Quais clientes precisam de atenção?",
  "Abra Clientes",
]

const STATUS_INICIAL = {
  verificando: true,
  groq: { configurada: false, online: false, modelo: "" },
  ollama: { online: false, instalado: false, modelo: "" },
}

export default function ConversaNexa({ usuario, setPage }) {
  const [clientes, setClientes] = useState([])
  const [conversas, setConversas] = useState([])
  const [conversaId, setConversaId] = useState(null)
  const [tipoContexto, setTipoContexto] = useState("geral")
  const [clienteId, setClienteId] = useState("")
  const [interessadoNome, setInteressadoNome] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [carregandoConversa, setCarregandoConversa] = useState(false)
  const [erro, setErro] = useState("")
  const [provedores, setProvedores] = useState(STATUS_INICIAL)
  const [conversa, setConversa] = useState([boasVindas()])
  const [memorias, setMemorias] = useState([])
  const [mostrarMemorias, setMostrarMemorias] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900)
  const fimRef = useRef(null)
  const contextoInicialAplicadoRef = useRef(false)
  const consultaAutomaticaAplicadaRef = useRef(false)

  useEffect(() => {
    const atualizar = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener("resize", atualizar)
    return () => window.removeEventListener("resize", atualizar)
  }, [])

  useEffect(() => {
    let ativo = true

    verificarProvedores()
      .then((status) => {
        if (ativo) setProvedores({ verificando: false, ...status })
      })
      .catch(() => {
        if (ativo) setProvedores({ ...STATUS_INICIAL, verificando: false })
      })

    Promise.allSettled([api.get("/clientes"), listarConversasNexa()]).then(([clientesResultado, conversasResultado]) => {
      if (!ativo) return
      if (clientesResultado.status === "fulfilled") {
        setClientes(Array.isArray(clientesResultado.value.data) ? clientesResultado.value.data : [])
      }
      if (conversasResultado.status === "fulfilled") {
        setConversas(conversasResultado.value)
      }
    })

    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (contextoInicialAplicadoRef.current || !conversas.length) return
    contextoInicialAplicadoRef.current = true

    const contexto = obterContextoVoz()
    if (!contexto.conversaId) return
    const conversaAtual = conversas.find((item) => String(item.id) === String(contexto.conversaId))
    if (conversaAtual) selecionarConversa(conversaAtual)
  }, [conversas])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversa, enviando])

  useEffect(() => {
    if (consultaAutomaticaAplicadaRef.current) return

    const consulta = localStorage.getItem("nexaConsultaAutomatica")
    if (!consulta) return

    consultaAutomaticaAplicadaRef.current = true
    localStorage.removeItem("nexaConsultaAutomatica")
    enviar(consulta)
  }, [])

  useEffect(() => {
    carregarMemorias()
  }, [conversaId, clienteId])

  useEffect(() => {
    const sincronizarConversa = async (evento) => {
      const id = evento?.detail?.conversaId
      if (!id || enviando || String(id) === String(conversaId)) return

      try {
        const dados = await abrirConversaNexa(id)
        const sessao = dados.conversa
        if (!sessao) return
        setConversaId(sessao.id)
        setTipoContexto(sessao.tipoContexto || "geral")
        setClienteId(sessao.clienteId ? String(sessao.clienteId) : "")
        setInteressadoNome(sessao.interessadoNome || "")
        const mensagens = Array.isArray(dados.mensagens)
          ? dados.mensagens.map(mapearMensagemPersistida)
          : []
        setConversa(mensagens.length ? mensagens : [boasVindas()])
      } catch (error) {
        console.warn("[Nexa] Não foi possível sincronizar a conversa ativa:", error)
      }
    }

    window.addEventListener("nexa:conversa-atualizada", sincronizarConversa)
    return () => window.removeEventListener("nexa:conversa-atualizada", sincronizarConversa)
  }, [conversaId, enviando])

  const cliente = useMemo(
    () => clientes.find((item) => String(item.id) === String(clienteId)),
    [clientes, clienteId]
  )

  const algumProvedorDisponivel = provedores.groq.online || (provedores.ollama.online && provedores.ollama.instalado)

  async function recarregarConversas() {
    try {
      setConversas(await listarConversasNexa())
    } catch (error) {
      console.error(error)
    }
  }

  async function carregarMemorias() {
    try {
      const filtros = {}
      if (tipoContexto === "cliente" && clienteId) {
        filtros.escopo = "cliente"
        filtros.clienteId = clienteId
      } else if (tipoContexto === "interessado" && conversaId) {
        filtros.escopo = "interessado"
        filtros.conversaId = conversaId
      } else {
        filtros.escopo = "escritorio"
      }
      setMemorias(await listarMemoriasNexa(filtros))
    } catch (error) {
      console.error(error)
    }
  }

  async function selecionarConversa(item) {
    if (!item?.id || carregandoConversa) return
    setCarregandoConversa(true)
    setErro("")

    try {
      const dados = await abrirConversaNexa(item.id)
      const sessao = dados.conversa || item
      setConversaId(sessao.id)
      registrarConversaVoz(sessao.id)
      setTipoContexto(sessao.tipoContexto || "geral")
      setClienteId(sessao.clienteId ? String(sessao.clienteId) : "")
      if (sessao.clienteId) {
        const clienteSessao = clientes.find((item) => String(item.id) === String(sessao.clienteId))
        if (clienteSessao) registrarClienteVoz(clienteSessao)
      }
      setInteressadoNome(sessao.interessadoNome || "")

      const mensagens = Array.isArray(dados.mensagens)
        ? dados.mensagens.map(mapearMensagemPersistida)
        : []
      setConversa(mensagens.length ? mensagens : [boasVindas()])
    } catch (error) {
      console.error(error)
      setErro(error.response?.data?.message || "Não consegui abrir essa conversa.")
    } finally {
      setCarregandoConversa(false)
    }
  }

  function novaConversa() {
    limparConversaVoz()
    setConversaId(null)
    setTipoContexto("geral")
    setClienteId("")
    setInteressadoNome("")
    setMensagem("")
    setErro("")
    setConversa([boasVindas()])
  }

  async function removerConversa(event, id) {
    event.stopPropagation()
    if (!window.confirm("Excluir esta conversa?")) return

    try {
      await excluirConversaNexa(id)
      if (String(conversaId) === String(id)) novaConversa()
      await recarregarConversas()
    } catch (error) {
      setErro(error.response?.data?.message || "Não consegui excluir a conversa.")
    }
  }

  async function alterarContexto(novoTipo) {
    setTipoContexto(novoTipo)
    if (novoTipo !== "cliente") setClienteId("")
    if (novoTipo !== "interessado") setInteressadoNome("")

    if (conversaId) {
      try {
        await atualizarConversaNexa(conversaId, {
          tipoContexto: novoTipo,
          clienteId: novoTipo === "cliente" ? clienteId || null : null,
          interessadoNome: novoTipo === "interessado" ? interessadoNome : "",
        })
        await recarregarConversas()
      } catch (error) {
        console.error(error)
      }
    }
  }

  async function atualizarClienteContexto(novoClienteId) {
    setClienteId(novoClienteId)
    const clienteSelecionado = clientes.find((item) => String(item.id) === String(novoClienteId))
    if (clienteSelecionado) registrarClienteVoz(clienteSelecionado)
    if (conversaId) {
      try {
        await atualizarConversaNexa(conversaId, {
          tipoContexto: "cliente",
          clienteId: novoClienteId || null,
        })
        await recarregarConversas()
      } catch (error) {
        console.error(error)
      }
    }
  }

  function executarAcaoNexa(acao) {
    if (!acao || acao.tipo !== "navegar" || typeof setPage !== "function") return

    const pagina = String(acao.pagina || "").trim()
    const clienteAcao = acao.cliente || null
    const clienteNome = String(clienteAcao?.nome || "").trim()
    const clienteAcaoId = clienteAcao?.id ? String(clienteAcao.id) : ""

    if (!pagina) return
    if (clienteAcaoId) registrarClienteVoz(clienteAcao)

    if (acao.alvo === "central-cliente" && clienteAcaoId) {
      localStorage.setItem("nexaAbrirClienteId", clienteAcaoId)
      localStorage.setItem("nexaAbrirClienteNome", clienteNome)
      if (acao.secao) localStorage.setItem("nexaAbrirSecaoCliente", String(acao.secao))
    }
    if (pagina === "Fiscal") {
      if (clienteNome) localStorage.setItem("nexaFiltroFiscalCliente", clienteNome)
      else localStorage.removeItem("nexaFiltroFiscalCliente")
      window.dispatchEvent(new CustomEvent("nexa:filtro-fiscal-atualizado", {
        detail: { clienteId: clienteAcaoId, clienteNome },
      }))
    }
    if (pagina === "Documentos Digitais" && clienteNome) localStorage.setItem("nexaFiltroDocumentoCliente", clienteNome)
    if (pagina === "Pendências Clientes" && clienteNome) localStorage.setItem("nexaFiltroPendenciaCliente", clienteNome)
    if (pagina === "Movimentos Clientes" && clienteNome) localStorage.setItem("nexaFiltroMovimentosCliente", clienteNome)
    if (pagina === "Movimentos Clientes" && clienteAcaoId) localStorage.setItem("nexaFiltroMovimentosClienteId", clienteAcaoId)
    if (pagina === "Lançamentos Contábeis" && clienteNome) localStorage.setItem("nexaFiltroLancamentosCliente", clienteNome)
    if (pagina === "DRE Gerencial" && clienteNome) localStorage.setItem("nexaFiltroDreCliente", clienteNome)
    if (pagina === "Certificados Digitais" && clienteAcaoId) localStorage.setItem("nexaCertificadoClienteId", clienteAcaoId)
    if (pagina === "Procurações e-CAC" && clienteAcaoId) localStorage.setItem("nexaProcuracaoClienteId", clienteAcaoId)
    if (pagina === "Memória da Nexa" && clienteAcaoId) localStorage.setItem("nexaMemoriaClienteId", clienteAcaoId)
    if (pagina === "Segundo Contador" && clienteAcaoId) localStorage.setItem("nexaSegundoContadorClienteId", clienteAcaoId)
    if (pagina === "Consultora Tributária" && clienteAcaoId) localStorage.setItem("nexaConsultoraClienteId", clienteAcaoId)

    setPage(pagina)
  }

  async function enviar(texto = mensagem) {
    const pergunta = String(texto || "").trim()
    if (!pergunta || enviando) return

    if (tipoContexto === "cliente" && !clienteId) {
      setErro("Selecione o cliente ou use o modo Conversa geral.")
      return
    }

    const itemUsuario = {
      id: `u-${Date.now()}`,
      autor: "Você",
      texto: pergunta,
      data: new Date().toISOString(),
    }

    setConversa((atual) => [...atual.filter((item) => item.id !== "boas-vindas"), itemUsuario])
    setMensagem("")
    setErro("")
    setEnviando(true)

    try {
      const resposta = await conversarComNexa({
        mensagem: pergunta,
        clienteId: tipoContexto === "cliente" ? clienteId || null : null,
        historico: conversa,
        conversaId,
        tipoContexto,
        interessadoNome,
        origem: "texto",
        paginaAtual: "Conversa com a Nexa",
      })

      if (resposta.conversaId) {
        setConversaId(resposta.conversaId)
        registrarConversaVoz(resposta.conversaId)
      }

      if (resposta.clienteIdConfirmado) {
        const idConfirmado = String(resposta.clienteIdConfirmado)
        const clienteConfirmado = clientes.find((item) => String(item.id) === idConfirmado)
        setTipoContexto("cliente")
        setClienteId(idConfirmado)
        registrarClienteVoz(clienteConfirmado || {
          id: resposta.clienteIdConfirmado,
          nome: resposta.clienteNomeConfirmado || "",
        })

        const conversaConfirmadaId = resposta.conversaId || conversaId
        if (conversaConfirmadaId) {
          await atualizarConversaNexa(conversaConfirmadaId, {
            tipoContexto: "cliente",
            clienteId: resposta.clienteIdConfirmado,
          })
        }
      }

      setConversa((atual) => [...atual, {
        id: `n-${Date.now()}`,
        autor: "Nexa",
        texto: resposta.resposta,
        pontos: resposta.pontos || [],
        recomendacao: resposta.recomendacao || "",
        fundamentos: resposta.fundamentos || [],
        provedor: resposta.provedor || "groq",
        modelo: resposta.modelo || "",
        fallback: Boolean(resposta.fallback),
        acao: resposta.acao || null,
        consulta: resposta.consulta || null,
        memoriaRegistrada: Boolean(resposta.memoriaRegistrada),
        data: resposta.respondidoEm || new Date().toISOString(),
      }])

      if (resposta.acao) setTimeout(() => executarAcaoNexa(resposta.acao), 450)
      await Promise.all([recarregarConversas(), carregarMemorias()])
    } catch (error) {
      console.error(error)
      const mensagemErro = error.response?.data?.message || error.message || "Não consegui concluir a resposta agora."
      setErro(mensagemErro)
      setConversa((atual) => [...atual, {
        id: `e-${Date.now()}`,
        autor: "Nexa",
        texto: "Não consegui responder agora.",
        data: new Date().toISOString(),
        erro: true,
      }])
    } finally {
      setEnviando(false)
    }
  }

  async function removerMemoria(id) {
    try {
      await excluirMemoriaNexa(id)
      await carregarMemorias()
    } catch (error) {
      setErro(error.response?.data?.message || "Não consegui remover a memória.")
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <span style={styles.badge}>Nexa Conversacional v2 • voz, texto, memória e contexto</span>
          <h2 style={styles.title}>Conversa com a Nexa</h2>
          <p style={styles.subtitle}>Converse normalmente. A Nexa acompanha o assunto, consulta o ERP e navega sem exigir frases prontas.</p>
        </div>
        <div style={styles.heroActions}>
          <button style={styles.memoryButton} onClick={() => setMostrarMemorias((valor) => !valor)}>
            Memória ativa • {memorias.length}
          </button>
          <button style={styles.newButton} onClick={novaConversa}>+ Nova conversa</button>
        </div>
      </header>

      <div style={{ ...styles.providerStatus, ...(algumProvedorDisponivel ? styles.providerOnline : styles.providerOffline) }}>
        <strong>{provedores.verificando ? "Verificando IA..." : provedores.groq.online ? "Groq conectada — IA online" : "Groq indisponível"}</strong>
        <span>{provedores.ollama.online && provedores.ollama.instalado ? `Ollama pronto como alternativa local • ${provedores.ollama.modelo}` : "Ollama local opcional"}</span>
      </div>

      {mostrarMemorias && (
        <section style={styles.memoryPanel}>
          <div style={styles.memoryHeader}>
            <div>
              <strong>Memórias da Nexa</strong>
              <span>Use “Lembre que...” para registrar e “Esqueça...” para remover pela conversa.</span>
            </div>
            <button style={styles.closeMemory} onClick={() => setMostrarMemorias(false)}>Fechar</button>
          </div>
          {!memorias.length ? (
            <span style={styles.emptyText}>Nenhuma memória registrada neste contexto.</span>
          ) : (
            <div style={styles.memoryList}>
              {memorias.map((item) => (
                <div key={item.id} style={styles.memoryItem}>
                  <div>
                    <span style={styles.memoryScope}>{rotuloEscopo(item.escopo)}</span>
                    <p>{item.conteudo}</p>
                  </div>
                  <button style={styles.deleteMemory} onClick={() => removerMemoria(item.id)}>Excluir</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div style={{ ...styles.workspace, gridTemplateColumns: isMobile ? "1fr" : "260px minmax(0,1fr)" }}>
        <aside style={styles.sidebar}>
          <button style={styles.sidebarNew} onClick={novaConversa}>+ Nova conversa</button>
          <span style={styles.sidebarTitle}>Histórico</span>
          <div style={styles.conversationList}>
            {!conversas.length && <span style={styles.emptyText}>As conversas salvas aparecerão aqui.</span>}
            {conversas.map((item) => (
              <button
                key={item.id}
                type="button"
                style={{ ...styles.conversationItem, ...(String(conversaId) === String(item.id) ? styles.conversationActive : {}) }}
                onClick={() => selecionarConversa(item)}
              >
                <div style={styles.conversationInfo}>
                  <strong>{item.titulo || "Nova conversa"}</strong>
                  <span>{rotuloContexto(item.tipoContexto, item.interessadoNome)}</span>
                </div>
                <span style={styles.deleteConversation} onClick={(event) => removerConversa(event, item.id)}>×</span>
              </button>
            ))}
          </div>
        </aside>

        <main style={styles.main}>
          <section style={styles.context}>
            <div>
              <label style={styles.label}>Tipo de conversa</label>
              <select style={styles.select} value={tipoContexto} onChange={(event) => alterarContexto(event.target.value)}>
                <option value="geral">Conversa geral</option>
                <option value="cliente">Cliente cadastrado</option>
                <option value="interessado">Novo cliente / interessado</option>
              </select>
            </div>

            {tipoContexto === "cliente" && (
              <div>
                <label style={styles.label}>Cliente</label>
                <select style={styles.select} value={clienteId} onChange={(event) => atualizarClienteContexto(event.target.value)}>
                  <option value="">Selecione</option>
                  {[...clientes].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""))).map((item) => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {tipoContexto === "interessado" && (
              <div>
                <label style={styles.label}>Identificação do atendimento</label>
                <input
                  style={styles.input}
                  value={interessadoNome}
                  onChange={(event) => setInteressadoNome(event.target.value)}
                  onBlur={() => conversaId && atualizarConversaNexa(conversaId, { interessadoNome })}
                  placeholder="Ex.: Interessado — eletricista"
                />
              </div>
            )}

            <span style={styles.contextText}>{textoContexto(tipoContexto, cliente, interessadoNome)}</span>
          </section>

          <div style={styles.suggestions}>
            {SUGESTOES.map((item) => <button key={item} style={styles.suggestion} onClick={() => enviar(item)}>{item}</button>)}
          </div>

          <section style={styles.chat}>
            {carregandoConversa && <div style={styles.typing}>Abrindo conversa...</div>}
            {!carregandoConversa && conversa.map((item) => (
              <article key={item.id} style={{ ...styles.message, ...(item.autor === "Você" ? styles.userMessage : styles.nexaMessage), ...(item.erro ? styles.errorMessage : {}) }}>
                <div style={styles.messageHeader}>
                  <strong>{item.autor}</strong>
                  <span>{item.provedor ? `${nomeProvedor(item.provedor, item.modelo)} • ` : ""}{formatarHora(item.data)}</span>
                </div>
                <p style={styles.messageText}>{item.texto}</p>
                {item.fallback && <div style={styles.fallbackNotice}>Resposta gerada pelo Ollama local.</div>}
                {item.memoriaRegistrada && <div style={styles.memoryNotice}>✓ Informação adicionada à memória.</div>}
                {item.acao && <div style={styles.actionNotice}>✓ Pronto.</div>}
                {item.consulta && <ResultadoConsulta consulta={item.consulta} onAbrir={() => executarAcaoNexa(item.consulta.acaoSugerida)} />}
                {!item.consulta && !!item.pontos?.length && <ul style={styles.list}>{item.pontos.map((ponto) => <li key={ponto}>{ponto}</li>)}</ul>}
                {item.recomendacao && <div style={styles.recommendation}><span>Recomendação</span><strong>{item.recomendacao}</strong></div>}
                {!!item.fundamentos?.length && <details style={styles.details}><summary>Ver fundamentos</summary><ul style={styles.list}>{item.fundamentos.map((f) => <li key={f}>{f}</li>)}</ul></details>}
              </article>
            ))}
            {enviando && <div style={styles.typing}>A Nexa está pensando...</div>}
            <div ref={fimRef} />
          </section>

          {erro && <div style={styles.error}>{erro}</div>}

          <section style={styles.composer}>
            <textarea
              style={styles.textarea}
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  enviar()
                }
              }}
              placeholder="Pergunte qualquer coisa para a Nexa..."
              rows={3}
            />
            <button style={styles.send} onClick={() => enviar()} disabled={enviando || !mensagem.trim()}>
              {enviando ? "Respondendo..." : "Enviar"}
            </button>
          </section>
        </main>
      </div>
    </div>
  )
}

function mapearMensagemPersistida(item) {
  const dados = item?.dados || {}
  return {
    id: `db-${item.id}`,
    autor: item.autor === "usuario" ? "Você" : "Nexa",
    texto: item.texto,
    pontos: dados.pontos || [],
    recomendacao: dados.recomendacao || "",
    fundamentos: dados.fundamentos || [],
    provedor: dados.provedor || "",
    modelo: dados.modelo || "",
    fallback: Boolean(dados.fallback),
    acao: dados.acao || null,
    consulta: dados.consulta || null,
    memoriaRegistrada: Boolean(dados.memoriaRegistrada),
    data: item.createdAt,
  }
}

function boasVindas() {
  return {
    id: "boas-vindas",
    autor: "Nexa",
    texto: "Pode falar.",
    data: new Date().toISOString(),
  }
}

function textoContexto(tipo, cliente, interessadoNome) {
  if (tipo === "cliente") {
    return cliente
      ? `${cliente.nome} • ${cliente.regime || "Regime não informado"}`
      : "Selecione um cliente cadastrado."
  }
  if (tipo === "interessado") return interessadoNome || "Atendimento sem cadastro, com contexto próprio."
  return "Dúvidas gerais, conversa livre e orientação rápida."
}

function rotuloContexto(tipo, interessadoNome) {
  if (tipo === "cliente") return "Cliente cadastrado"
  if (tipo === "interessado") return interessadoNome || "Novo atendimento"
  return "Conversa geral"
}

function rotuloEscopo(escopo) {
  if (escopo === "cliente") return "Cliente"
  if (escopo === "interessado") return "Novo atendimento"
  return "Escritório"
}

function ResultadoConsulta({ consulta, onAbrir }) {
  const itens = Array.isArray(consulta?.itens) ? consulta.itens : []
  const podeAbrir = Boolean(consulta?.acaoSugerida && typeof onAbrir === "function")

  return (
    <div style={styles.consultaCard}>
      <div style={styles.consultaHeader}>
        <div>
          <span style={styles.consultaBadge}>Dados do Nexa</span>
          <strong style={styles.consultaTitle}>{consulta?.titulo || "Resultado da consulta"}</strong>
          {consulta?.resumo && <span style={styles.consultaResumo}>{consulta.resumo}</span>}
        </div>
        <span style={styles.consultaTotal}>{Number(consulta?.total || 0)}</span>
      </div>

      {!!itens.length && (
        <div style={styles.consultaItens}>
          {itens.slice(0, 12).map((registro, indice) => (
            <div key={`${registro.id || registro.clienteId || indice}-${registro.titulo || registro.cliente || indice}`} style={styles.consultaItem}>
              <div style={styles.consultaItemTopo}>
                <strong>{registro.titulo || registro.cliente || "Registro"}</strong>
                {registro.status && <span style={styles.consultaStatus}>{registro.status}</span>}
              </div>
              {registro.cliente && registro.titulo !== registro.cliente && <span style={styles.consultaCliente}>{registro.cliente}</span>}
              {registro.detalhe && <span style={styles.consultaDetalhe}>{registro.detalhe}</span>}
              <div style={styles.consultaRodapeItem}>
                {registro.dataFormatada && <span>{registro.dataFormatada}</span>}
                {registro.valor && <strong>{registro.valor}</strong>}
              </div>
            </div>
          ))}
        </div>
      )}

      {podeAbrir && <button type="button" style={styles.consultaButton} onClick={onAbrir}>Abrir {consulta.paginaSugerida || "tela relacionada"}</button>}
    </div>
  )
}

function nomeProvedor(provedor, modelo = "") {
  const nome = String(provedor || "").toLowerCase()
  if (nome === "ollama") return "Ollama local"
  if (nome === "sistema" && String(modelo).includes("Memory")) return "Memória da Nexa"
  if (nome === "sistema" && String(modelo).includes("Consultas")) return "Nexa Consultas"
  if (nome === "sistema") return "Nexa Actions"
  return "Groq online"
}

function formatarHora(data) {
  if (!data) return ""
  return new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "14px" },
  hero: { background: "linear-gradient(135deg,#061f47,#063875)", border: "1px solid rgba(0,168,255,.30)", borderRadius: "22px", padding: "22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "15px", flexWrap: "wrap" },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "8px 0", fontSize: "30px" },
  subtitle: { margin: 0, color: "#b8c7dc" },
  heroActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  newButton: { background: "linear-gradient(135deg,#00a8ff,#2eff78)", color: "#001b34", border: 0, borderRadius: "10px", padding: "11px 15px", fontWeight: "bold", cursor: "pointer" },
  memoryButton: { background: "rgba(255,255,255,.08)", color: "#aaffc2", border: "1px solid rgba(55,255,116,.28)", borderRadius: "10px", padding: "11px 15px", cursor: "pointer" },
  providerStatus: { borderRadius: "12px", padding: "11px 14px", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", fontSize: "13px" },
  providerOnline: { background: "rgba(55,255,116,.08)", border: "1px solid rgba(55,255,116,.25)", color: "#aaffc2" },
  providerOffline: { background: "rgba(255,184,77,.09)", border: "1px solid rgba(255,184,77,.28)", color: "#ffd298" },
  memoryPanel: { background: "#05244f", border: "1px solid rgba(55,255,116,.27)", borderRadius: "16px", padding: "15px" },
  memoryHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", marginBottom: "12px" },
  closeMemory: { background: "transparent", color: "#a9c5df", border: "1px solid rgba(255,255,255,.14)", borderRadius: "8px", padding: "7px 10px", cursor: "pointer" },
  memoryList: { display: "grid", gap: "8px" },
  memoryItem: { display: "flex", justifyContent: "space-between", gap: "12px", background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.09)", borderRadius: "10px", padding: "10px" },
  memoryScope: { color: "#66ff9b", fontSize: "10px", textTransform: "uppercase", fontWeight: "bold" },
  deleteMemory: { alignSelf: "center", background: "rgba(255,95,101,.10)", color: "#ffb5b8", border: "1px solid rgba(255,95,101,.25)", borderRadius: "8px", padding: "6px 9px", cursor: "pointer" },
  workspace: { display: "grid", gap: "14px", alignItems: "start" },
  sidebar: { background: "#041a3a", border: "1px solid rgba(255,255,255,.10)", borderRadius: "16px", padding: "12px", minHeight: "480px", maxHeight: "75vh", overflow: "hidden", display: "flex", flexDirection: "column", gap: "10px" },
  sidebarNew: { background: "rgba(0,168,255,.13)", color: "#8bd7ff", border: "1px solid rgba(0,168,255,.30)", borderRadius: "10px", padding: "10px", cursor: "pointer", fontWeight: "bold" },
  sidebarTitle: { color: "#91a6bf", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".06em" },
  conversationList: { display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto" },
  conversationItem: { width: "100%", display: "flex", justifyContent: "space-between", gap: "8px", textAlign: "left", background: "transparent", color: "#dce8f8", border: "1px solid transparent", borderRadius: "10px", padding: "10px", cursor: "pointer" },
  conversationActive: { background: "rgba(0,168,255,.12)", borderColor: "rgba(0,168,255,.32)" },
  conversationInfo: { minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" },
  deleteConversation: { color: "#91a6bf", fontSize: "18px", lineHeight: 1 },
  main: { minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" },
  context: { background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.10)", borderRadius: "16px", padding: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "12px", alignItems: "end" },
  label: { display: "block", color: "#a9b8cc", fontSize: "12px", marginBottom: "6px" },
  select: { width: "100%", background: "#061f47", color: "white", border: "1px solid rgba(255,255,255,.18)", borderRadius: "10px", padding: "11px" },
  input: { width: "100%", boxSizing: "border-box", background: "#061f47", color: "white", border: "1px solid rgba(255,255,255,.18)", borderRadius: "10px", padding: "11px" },
  contextText: { color: "#a9b8cc", fontSize: "12px", paddingBottom: "10px" },
  suggestions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  suggestion: { background: "rgba(0,168,255,.10)", color: "#8bd7ff", border: "1px solid rgba(0,168,255,.28)", borderRadius: "999px", padding: "8px 12px", cursor: "pointer" },
  chat: { background: "#041a3a", border: "1px solid rgba(255,255,255,.10)", borderRadius: "20px", padding: "16px", minHeight: "390px", maxHeight: "62vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" },
  message: { maxWidth: "84%", borderRadius: "16px", padding: "14px", border: "1px solid rgba(255,255,255,.10)" },
  userMessage: { alignSelf: "flex-end", background: "#07539a" },
  nexaMessage: { alignSelf: "flex-start", background: "#082b5d" },
  errorMessage: { borderColor: "rgba(255,95,101,.5)" },
  messageHeader: { display: "flex", justifyContent: "space-between", gap: "20px", color: "#a9b8cc", fontSize: "12px" },
  messageText: { whiteSpace: "pre-wrap", lineHeight: 1.55, margin: "10px 0 0" },
  fallbackNotice: { marginTop: "10px", color: "#ffd298", fontSize: "12px" },
  memoryNotice: { marginTop: "10px", color: "#aaffc2", fontSize: "12px", fontWeight: "bold" },
  actionNotice: { marginTop: "10px", color: "#aaffc2", fontSize: "12px", fontWeight: "bold" },
  list: { margin: "10px 0 0", paddingLeft: "20px", color: "#dce8f8", lineHeight: 1.65 },
  recommendation: { marginTop: "12px", background: "rgba(55,255,116,.08)", border: "1px solid rgba(55,255,116,.20)", borderRadius: "11px", padding: "11px", display: "flex", flexDirection: "column", gap: "4px" },
  details: { marginTop: "11px", color: "#a9c5df" },
  consultaCard: { marginTop: "12px", background: "rgba(2,18,43,.58)", border: "1px solid rgba(55,255,116,.25)", borderRadius: "14px", padding: "13px", display: "flex", flexDirection: "column", gap: "11px" },
  consultaHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" },
  consultaBadge: { display: "block", color: "#66ff9b", fontSize: "11px", fontWeight: "bold", marginBottom: "4px", textTransform: "uppercase" },
  consultaTitle: { display: "block", fontSize: "15px", color: "#f5fbff" },
  consultaResumo: { display: "block", marginTop: "4px", color: "#a9c5df", fontSize: "12px" },
  consultaTotal: { minWidth: "38px", height: "38px", borderRadius: "50%", background: "rgba(55,255,116,.12)", border: "1px solid rgba(55,255,116,.34)", display: "grid", placeItems: "center", color: "#66ff9b", fontWeight: "bold" },
  consultaItens: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "8px" },
  consultaItem: { background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.09)", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  consultaItemTopo: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", fontSize: "12px" },
  consultaStatus: { color: "#9decb8", fontSize: "10px", textAlign: "right" },
  consultaCliente: { color: "#8bd7ff", fontSize: "11px", fontWeight: "bold" },
  consultaDetalhe: { color: "#c6d5e8", fontSize: "11px", lineHeight: 1.4, overflowWrap: "anywhere" },
  consultaRodapeItem: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "3px", color: "#91a6bf", fontSize: "10px" },
  consultaButton: { alignSelf: "flex-start", background: "linear-gradient(135deg,#00a8ff,#2eff78)", color: "#001b34", border: 0, borderRadius: "9px", padding: "9px 13px", fontWeight: "bold", cursor: "pointer" },
  typing: { color: "#8bd7ff", fontStyle: "italic" },
  composer: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "10px", alignItems: "stretch" },
  textarea: { resize: "vertical", minHeight: "78px", background: "#061f47", color: "white", border: "1px solid rgba(255,255,255,.18)", borderRadius: "14px", padding: "13px", fontFamily: "inherit" },
  send: { background: "linear-gradient(135deg,#00a8ff,#2eff78)", color: "#001b34", border: 0, borderRadius: "14px", padding: "0 24px", fontWeight: "bold", cursor: "pointer" },
  error: { background: "rgba(255,95,101,.12)", border: "1px solid rgba(255,95,101,.35)", borderRadius: "12px", padding: "12px", color: "#ffb5b8" },
  emptyText: { color: "#8295ae", fontSize: "12px" },
}
