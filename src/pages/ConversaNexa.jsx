import { useEffect, useMemo, useRef, useState } from "react"
import api from "../services/api"
import { conversarComNexa } from "../services/conversaNexaService"

const SUGESTOES = [
  "Como está o escritório hoje?",
  "Quais clientes precisam de atenção?",
  "Quais certificados vencem em breve?",
  "O que você recomenda fazer agora?",
]

export default function ConversaNexa({ usuario }) {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState("")
  const [conversa, setConversa] = useState(() => {
    try {
      const salva = JSON.parse(localStorage.getItem("nexaConversaNatural") || "[]")
      return Array.isArray(salva) && salva.length ? salva : [boasVindas()]
    } catch {
      return [boasVindas()]
    }
  })
  const fimRef = useRef(null)

  useEffect(() => {
    async function carregarClientes() {
      try {
        const resposta = await api.get("/clientes")
        setClientes(Array.isArray(resposta.data) ? resposta.data : [])
      } catch (error) {
        console.error(error)
      }
    }
    carregarClientes()
  }, [])

  useEffect(() => {
    localStorage.setItem("nexaConversaNatural", JSON.stringify(conversa.slice(-60)))
    fimRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversa])

  const cliente = useMemo(
    () => clientes.find((item) => String(item.id) === String(clienteId)),
    [clientes, clienteId]
  )

  async function enviar(texto = mensagem) {
    const pergunta = String(texto || "").trim()
    if (!pergunta || enviando) return

    const itemUsuario = { id: `u-${Date.now()}`, autor: "Você", texto: pergunta, data: new Date().toISOString() }
    setConversa((atual) => [...atual, itemUsuario])
    setMensagem("")
    setErro("")
    setEnviando(true)

    try {
      const resposta = await conversarComNexa({
        mensagem: pergunta,
        clienteId: clienteId || null,
        historico: conversa,
      })
      setConversa((atual) => [...atual, {
        id: `n-${Date.now()}`,
        autor: "Nexa",
        texto: resposta.resposta,
        pontos: resposta.pontos || [],
        recomendacao: resposta.recomendacao || "",
        fundamentos: resposta.fundamentos || [],
        data: resposta.respondidoEm || new Date().toISOString(),
      }])
    } catch (error) {
      console.error(error)
      setErro(error.response?.data?.message || "Não consegui concluir a análise agora.")
      setConversa((atual) => [...atual, {
        id: `e-${Date.now()}`, autor: "Nexa",
        texto: `${usuario?.nome || "Administrador"}, encontrei um problema ao consultar os dados. Vamos tentar novamente em alguns instantes.`,
        data: new Date().toISOString(), erro: true,
      }])
    } finally {
      setEnviando(false)
    }
  }

  function limpar() {
    const inicial = [boasVindas()]
    setConversa(inicial)
    localStorage.setItem("nexaConversaNatural", JSON.stringify(inicial))
  }

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <span style={styles.badge}>Nexa Assist • Etapa 4.1</span>
          <h2 style={styles.title}>Conversa com a Nexa</h2>
          <p style={styles.subtitle}>Conversa generativa baseada nos dados reais da Nexa. Cada resposta é criada para a sua pergunta e para o contexto atual.</p>
        </div>
        <button style={styles.clear} onClick={limpar}>Nova conversa</button>
      </header>

      <section style={styles.context}>
        <div>
          <label style={styles.label}>Contexto do cliente (opcional)</label>
          <select style={styles.select} value={clienteId} onChange={(event) => setClienteId(event.target.value)}>
            <option value="">Escritório inteiro</option>
            {[...clientes].sort((a,b) => String(a.nome || "").localeCompare(String(b.nome || ""))).map((item) => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </div>
        <span style={styles.contextText}>{cliente ? `${cliente.regime || "Regime não informado"} • ${cliente.ramo || "Ramo não informado"}` : "Análise geral da carteira e das rotinas do escritório"}</span>
      </section>

      <div style={styles.suggestions}>
        {SUGESTOES.map((item) => <button key={item} style={styles.suggestion} onClick={() => enviar(item)}>{item}</button>)}
      </div>

      <section style={styles.chat}>
        {conversa.map((item) => (
          <article key={item.id} style={{ ...styles.message, ...(item.autor === "Você" ? styles.userMessage : styles.nexaMessage), ...(item.erro ? styles.errorMessage : {}) }}>
            <div style={styles.messageHeader}>
              <strong>{item.autor}</strong>
              <span>{formatarHora(item.data)}</span>
            </div>
            <p style={styles.messageText}>{item.texto}</p>
            {!!item.pontos?.length && <ul style={styles.list}>{item.pontos.map((ponto) => <li key={ponto}>{ponto}</li>)}</ul>}
            {item.recomendacao && <div style={styles.recommendation}><span>Minha recomendação</span><strong>{item.recomendacao}</strong></div>}
            {!!item.fundamentos?.length && <details style={styles.details}><summary>Por que a Nexa respondeu assim?</summary><ul style={styles.list}>{item.fundamentos.map((f) => <li key={f}>{f}</li>)}</ul></details>}
          </article>
        ))}
        {enviando && <div style={styles.typing}>A Nexa está consultando os dados e preparando uma resposta...</div>}
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
          placeholder="Ex.: Nexa, o que merece minha atenção hoje?"
          rows={3}
        />
        <button style={styles.send} onClick={() => enviar()} disabled={enviando || !mensagem.trim()}>
          {enviando ? "Analisando..." : "Enviar"}
        </button>
      </section>
      <p style={styles.notice}>A Nexa usa IA generativa e os dados disponíveis no sistema. Decisões tributárias e ações que alterem dados continuam sob responsabilidade do contador.</p>
    </div>
  )
}

function boasVindas() {
  return {
    id: "boas-vindas", autor: "Nexa",
    texto: `Olá, ${usuario?.nome || JSON.parse(localStorage.getItem("usuario") || "{}").nome || "Administrador"}. Estou pronta para analisar o escritório ou um cliente específico. Pode conversar comigo naturalmente.`,
    data: new Date().toISOString(),
  }
}

function formatarHora(data) {
  if (!data) return ""
  return new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "16px" },
  hero: { background: "linear-gradient(135deg,#061f47,#063875)", border: "1px solid rgba(0,168,255,.30)", borderRadius: "22px", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "15px", flexWrap: "wrap" },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "8px 0", fontSize: "30px" },
  subtitle: { margin: 0, color: "#b8c7dc" },
  clear: { background: "rgba(255,255,255,.08)", color: "white", border: "1px solid rgba(255,255,255,.16)", borderRadius: "10px", padding: "11px 15px", cursor: "pointer" },
  context: { background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.10)", borderRadius: "16px", padding: "16px", display: "grid", gridTemplateColumns: "minmax(230px,360px) 1fr", gap: "14px", alignItems: "end" },
  label: { display: "block", color: "#a9b8cc", fontSize: "12px", marginBottom: "6px" },
  select: { width: "100%", background: "#061f47", color: "white", border: "1px solid rgba(255,255,255,.18)", borderRadius: "10px", padding: "11px" },
  contextText: { color: "#a9b8cc", fontSize: "13px", paddingBottom: "10px" },
  suggestions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  suggestion: { background: "rgba(0,168,255,.10)", color: "#8bd7ff", border: "1px solid rgba(0,168,255,.28)", borderRadius: "999px", padding: "8px 12px", cursor: "pointer" },
  chat: { background: "#041a3a", border: "1px solid rgba(255,255,255,.10)", borderRadius: "20px", padding: "18px", minHeight: "380px", maxHeight: "62vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "13px" },
  message: { maxWidth: "82%", borderRadius: "16px", padding: "15px", border: "1px solid rgba(255,255,255,.10)" },
  userMessage: { alignSelf: "flex-end", background: "#07539a" },
  nexaMessage: { alignSelf: "flex-start", background: "#082b5d" },
  errorMessage: { borderColor: "rgba(255,95,101,.5)" },
  messageHeader: { display: "flex", justifyContent: "space-between", gap: "20px", color: "#a9b8cc", fontSize: "12px" },
  messageText: { whiteSpace: "pre-wrap", lineHeight: 1.55, margin: "10px 0 0" },
  list: { margin: "10px 0 0", paddingLeft: "20px", color: "#dce8f8", lineHeight: 1.65 },
  recommendation: { marginTop: "12px", background: "rgba(55,255,116,.08)", border: "1px solid rgba(55,255,116,.20)", borderRadius: "11px", padding: "11px", display: "flex", flexDirection: "column", gap: "4px" },
  details: { marginTop: "11px", color: "#a9c5df" },
  typing: { color: "#8bd7ff", fontStyle: "italic" },
  composer: { display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "stretch" },
  textarea: { resize: "vertical", minHeight: "78px", background: "#061f47", color: "white", border: "1px solid rgba(255,255,255,.18)", borderRadius: "14px", padding: "13px", fontFamily: "inherit" },
  send: { background: "linear-gradient(135deg,#00a8ff,#2eff78)", color: "#001b34", border: 0, borderRadius: "14px", padding: "0 24px", fontWeight: "bold", cursor: "pointer" },
  error: { background: "rgba(255,95,101,.12)", border: "1px solid rgba(255,95,101,.35)", borderRadius: "12px", padding: "12px", color: "#ffb5b8" },
  notice: { margin: 0, color: "#8295ae", fontSize: "12px" },
}
