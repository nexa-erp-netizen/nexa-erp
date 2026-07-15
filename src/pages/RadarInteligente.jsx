import { useEffect, useMemo, useState } from "react"
import { carregarRadarNexa } from "../services/radarNexaService"

const cores = {
  Crítico: "#ff5a66",
  Urgente: "#ff9f43",
  Atenção: "#ffd166",
  Informativo: "#37ff74",
}

export default function RadarInteligente({ setPage, usuario }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    setErro("")
    try {
      setDados(await carregarRadarNexa())
    } catch (error) {
      console.error(error)
      setErro("Não consegui carregar o Radar Inteligente agora.")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const nomeUsuario = usuario?.nome || JSON.parse(localStorage.getItem("usuario") || "{}").nome || "Administrador"
  const itens = useMemo(() => dados?.itens || [], [dados])

  function resolver(item) {
    if (item.destino && setPage) setPage(item.destino)
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <span style={styles.badge}>Nexa IA</span>
          <h1 style={styles.title}>Radar Inteligente</h1>
          <p style={styles.subtitle}>{dados?.mensagem || `${nomeUsuario}, estou analisando o escritório para localizar riscos e oportunidades.`}</p>
        </div>
        <button onClick={carregar} style={styles.refresh}>Atualizar radar</button>
      </div>

      {carregando && <div style={styles.state}>Analisando o escritório...</div>}
      {erro && <div style={{...styles.state, borderColor: "#ff5a66"}}>{erro}</div>}

      {!carregando && !erro && (
        <>
          <div style={styles.summaryGrid}>
            {Object.entries(dados?.resumo || {}).map(([chave, valor]) => (
              <div key={chave} style={styles.summaryCard}>
                <span style={styles.summaryLabel}>{chave}</span>
                <strong style={styles.summaryValue}>{valor}</strong>
              </div>
            ))}
          </div>

          <div style={styles.list}>
            {itens.length === 0 ? (
              <div style={styles.state}>Nenhum risco relevante foi encontrado neste momento.</div>
            ) : itens.map((item, index) => (
              <div key={`${item.tipo}-${item.id || index}`} style={styles.card}>
                <div style={styles.cardTop}>
                  <span style={{...styles.level, color: cores[item.nivel] || "white", borderColor: cores[item.nivel] || "white"}}>{item.nivel}</span>
                  <span style={styles.score}>{item.pontos} pts</span>
                </div>
                <h3 style={styles.cardTitle}>{item.titulo}</h3>
                <p style={styles.cardText}>{item.descricao}</p>
                {item.cliente && <p style={styles.client}>Cliente: <strong>{item.cliente}</strong></p>}
                <div style={styles.actions}>
                  <span style={styles.reason}>{item.motivo}</span>
                  {item.destino && <button onClick={() => resolver(item)} style={styles.actionButton}>Resolver agora</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  page: { color: "white" },
  hero: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 22 },
  badge: { display: "inline-block", padding: "7px 12px", borderRadius: 999, background: "rgba(55,255,116,.12)", color: "#37ff74", fontWeight: 800 },
  title: { margin: "10px 0 6px", fontSize: 34 },
  subtitle: { margin: 0, color: "#b7c7dc", maxWidth: 780, lineHeight: 1.6 },
  refresh: { background: "#00a8ff", color: "white", border: 0, padding: "12px 18px", borderRadius: 12, fontWeight: 800, cursor: "pointer" },
  state: { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", padding: 18, borderRadius: 16 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 },
  summaryCard: { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: 16, padding: 16 },
  summaryLabel: { display: "block", color: "#9fb1c8", textTransform: "capitalize", marginBottom: 8 },
  summaryValue: { fontSize: 28, color: "#37ff74" },
  list: { display: "grid", gap: 14 },
  card: { background: "linear-gradient(135deg,#061f47,#03265a)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 18, padding: 18 },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 10 },
  level: { border: "1px solid", padding: "5px 9px", borderRadius: 999, fontWeight: 800, fontSize: 12 },
  score: { color: "#9fb1c8", fontWeight: 800 },
  cardTitle: { margin: "14px 0 8px" },
  cardText: { color: "#dbe8f7", lineHeight: 1.6, margin: 0 },
  client: { color: "#9fc9ff" },
  actions: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 14 },
  reason: { color: "#9fb1c8", fontSize: 13, flex: 1 },
  actionButton: { background: "#37ff74", color: "#00142f", border: 0, borderRadius: 10, padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
}
