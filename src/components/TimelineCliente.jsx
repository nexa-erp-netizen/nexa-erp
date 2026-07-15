function formatarData(data) {
  if (!data) return "Data não informada"
  const valor = new Date(data)
  return Number.isNaN(valor.getTime()) ? "Data não informada" : valor.toLocaleString("pt-BR")
}

const cores = {
  Fiscal: "#37ff74",
  Financeiro: "#00a8ff",
  Documento: "#ffd54a",
  Movimento: "#c58cff",
  "e-CAC": "#ff9f43",
  Anotação: "#a9b8cc",
}

export default function TimelineCliente({ itens = [] }) {
  return (
    <section style={styles.card}>
      <h3 style={styles.title}>Linha do tempo do cliente</h3>
      {itens.length === 0 ? (
        <p style={styles.empty}>Ainda não existem eventos para este cliente.</p>
      ) : (
        <div style={styles.list}>
          {itens.map((item) => (
            <article key={item.id} style={styles.item}>
              <span style={{ ...styles.dot, background: cores[item.tipo] || "#a9b8cc" }} />
              <div style={styles.content}>
                <div style={styles.itemHeader}>
                  <strong>{item.titulo}</strong>
                  <span style={styles.date}>{formatarData(item.data)}</span>
                </div>
                <p style={styles.description}>{item.descricao}</p>
                <div style={styles.meta}>
                  <span>{item.origem || item.tipo}</span>
                  {item.status && <span>{item.status}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

const styles = {
  card: { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: "18px", padding: "20px" },
  title: { marginTop: 0 },
  empty: { color: "#a9b8cc" },
  list: { display: "flex", flexDirection: "column" },
  item: { position: "relative", display: "flex", gap: "13px", padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,.08)" },
  dot: { width: "11px", height: "11px", borderRadius: "50%", marginTop: "5px", flex: "0 0 auto", boxShadow: "0 0 12px rgba(255,255,255,.25)" },
  content: { flex: 1, minWidth: 0 },
  itemHeader: { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" },
  date: { color: "#a9b8cc", fontSize: "12px" },
  description: { color: "#dce8f8", margin: "7px 0", lineHeight: 1.45 },
  meta: { display: "flex", gap: "10px", flexWrap: "wrap", color: "#8fb1d8", fontSize: "12px" },
}
