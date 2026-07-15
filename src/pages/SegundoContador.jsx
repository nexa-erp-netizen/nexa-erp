import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { carregarRecomendacoesCliente } from "../services/recomendacoesNexaService"

export default function SegundoContador() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState("")
  const [analise, setAnalise] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState("")
  const [abertos, setAbertos] = useState({})

  useEffect(() => {
    async function iniciar() {
      try {
        const resposta = await api.get("/clientes")
        const lista = Array.isArray(resposta.data) ? resposta.data : []
        setClientes(lista)
        const salvo = localStorage.getItem("nexaSegundoContadorClienteId")
        if (salvo && lista.some((item) => String(item.id) === String(salvo))) setClienteId(String(salvo))
      } catch (error) {
        console.error(error)
        setErro("Não foi possível carregar os clientes.")
      }
    }
    iniciar()
  }, [])

  useEffect(() => {
    if (!clienteId) {
      setAnalise(null)
      return
    }
    localStorage.setItem("nexaSegundoContadorClienteId", String(clienteId))
    analisar()
  }, [clienteId])

  async function analisar() {
    if (!clienteId) return
    setCarregando(true)
    setErro("")
    try {
      setAnalise(await carregarRecomendacoesCliente(clienteId))
      setAbertos({})
    } catch (error) {
      console.error(error)
      setErro(error.response?.data?.message || error.message || "Erro ao gerar a análise.")
      setAnalise(null)
    } finally {
      setCarregando(false)
    }
  }

  const clienteSelecionado = useMemo(
    () => clientes.find((item) => String(item.id) === String(clienteId)),
    [clientes, clienteId]
  )

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <span style={styles.badge}>Módulo 4 • Etapa 2</span>
          <h2 style={styles.title}>Segundo Contador</h2>
          <p style={styles.subtitle}>Opiniões técnicas fundamentadas nos dados reais disponíveis na Nexa.</p>
        </div>
        <button style={styles.analisar} onClick={analisar} disabled={!clienteId || carregando}>
          {carregando ? "Analisando..." : "Analisar novamente"}
        </button>
      </header>

      <section style={styles.selectorCard}>
        <label style={styles.label}>Cliente analisado</label>
        <select style={styles.select} value={clienteId} onChange={(event) => setClienteId(event.target.value)}>
          <option value="">Selecione um cliente...</option>
          {[...clientes].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""))).map((cliente) => (
            <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
          ))}
        </select>
        {clienteSelecionado && <span style={styles.meta}>{clienteSelecionado.regime || "Regime não informado"} • {clienteSelecionado.ramo || "Ramo não informado"}</span>}
      </section>

      {erro && <div style={styles.error}>{erro}</div>}
      {!clienteId && <div style={styles.empty}>Selecione um cliente para a Nexa emitir uma análise técnica.</div>}
      {carregando && <div style={styles.empty}>A Nexa está confrontando os dados fiscais, financeiros, documentais e digitais...</div>}

      {!carregando && analise && (
        <>
          <section style={styles.parecer}>
            <span style={styles.parecerLabel}>Parecer da Nexa</span>
            <strong style={styles.parecerTexto}>{analise.parecer}</strong>
            <span style={styles.aviso}>{analise.aviso}</span>
          </section>

          <div style={styles.grid}>
            {(analise.recomendacoes || []).map((item, indice) => {
              const chave = item.codigo || String(indice)
              const aberto = Boolean(abertos[chave])
              return (
                <article key={chave} style={{ ...styles.card, borderColor: corPrioridade(item.prioridade) }}>
                  <div style={styles.cardHeader}>
                    <div>
                      <span style={{ ...styles.priority, color: corPrioridade(item.prioridade) }}>{item.prioridade}</span>
                      <span style={styles.category}>{item.categoria}</span>
                    </div>
                    <span style={styles.order}>#{indice + 1}</span>
                  </div>
                  <h3 style={styles.cardTitle}>{item.titulo}</h3>
                  <p style={styles.opinion}>{item.opiniao}</p>
                  <div style={styles.actionBox}>
                    <span style={styles.actionLabel}>Próximo passo recomendado</span>
                    <strong>{item.acao}</strong>
                  </div>
                  <button style={styles.whyButton} onClick={() => setAbertos((atual) => ({ ...atual, [chave]: !aberto }))}>
                    {aberto ? "Ocultar fundamento" : "Por que a Nexa recomenda isso?"}
                  </button>
                  {aberto && (
                    <div style={styles.details}>
                      <p style={styles.reason}>{item.motivo}</p>
                      {!!item.evidencias?.length && (
                        <ul style={styles.list}>
                          {item.evidencias.map((evidencia) => <li key={evidencia}>{evidencia}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function corPrioridade(prioridade) {
  return { Crítica: "#ff5f65", Alta: "#ffad42", Média: "#ffd84d", Baixa: "#37ff74" }[prioridade] || "#00a8ff"
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: { background: "linear-gradient(135deg,#061f47,#063875)", border: "1px solid rgba(0,168,255,.28)", borderRadius: "22px", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "8px 0", fontSize: "30px" },
  subtitle: { margin: 0, color: "#b8c7dc" },
  analisar: { background: "#00a8ff", color: "white", border: 0, borderRadius: "10px", padding: "11px 16px", fontWeight: "bold", cursor: "pointer" },
  selectorCard: { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: "18px", padding: "20px" },
  label: { display: "block", color: "#a9b8cc", fontSize: "13px", marginBottom: "7px" },
  select: { width: "100%", background: "#061f47", color: "white", border: "1px solid rgba(255,255,255,.18)", borderRadius: "10px", padding: "12px" },
  meta: { display: "block", color: "#a9b8cc", marginTop: "9px", fontSize: "13px" },
  parecer: { background: "rgba(55,255,116,.08)", border: "1px solid rgba(55,255,116,.24)", borderRadius: "18px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" },
  parecerLabel: { color: "#37ff74", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" },
  parecerTexto: { fontSize: "18px", lineHeight: 1.5 },
  aviso: { color: "#a9b8cc", fontSize: "12px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "15px" },
  card: { background: "#061f47", border: "1px solid", borderRadius: "18px", padding: "19px", boxShadow: "0 10px 28px rgba(0,0,0,.18)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" },
  priority: { fontWeight: "bold", marginRight: "10px" },
  category: { color: "#a9b8cc", fontSize: "12px" },
  order: { color: "#7186a3", fontWeight: "bold" },
  cardTitle: { margin: "13px 0 8px", fontSize: "19px" },
  opinion: { color: "#dce8f8", lineHeight: 1.55 },
  actionBox: { background: "rgba(255,255,255,.055)", borderRadius: "12px", padding: "13px", display: "flex", flexDirection: "column", gap: "5px" },
  actionLabel: { color: "#a9b8cc", fontSize: "11px", textTransform: "uppercase" },
  whyButton: { marginTop: "13px", width: "100%", border: "1px solid rgba(0,168,255,.35)", background: "rgba(0,168,255,.10)", color: "#8bd7ff", borderRadius: "10px", padding: "10px", cursor: "pointer", fontWeight: "bold" },
  details: { marginTop: "12px", borderTop: "1px solid rgba(255,255,255,.10)", paddingTop: "12px" },
  reason: { color: "#c3d2e6", lineHeight: 1.5, margin: 0 },
  list: { color: "#a9b8cc", lineHeight: 1.65, paddingLeft: "20px" },
  empty: { background: "rgba(255,255,255,.05)", borderRadius: "15px", padding: "22px", color: "#a9b8cc", textAlign: "center" },
  error: { background: "rgba(255,95,101,.12)", border: "1px solid rgba(255,95,101,.35)", borderRadius: "14px", padding: "15px", color: "#ffb5b8" },
}
