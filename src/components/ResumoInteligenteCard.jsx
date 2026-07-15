export default function ResumoInteligenteCard({ memoria }) {
  if (!memoria) return null

  const totais = memoria.resumo?.totais || {}
  const alertas = memoria.resumo?.alertas || []

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <span style={styles.badge}>Resumo da Nexa</span>
          <h3 style={styles.title}>{memoria.cliente?.nome}</h3>
        </div>
        <span style={styles.updated}>
          Atualizado em {new Date(memoria.atualizadoEm).toLocaleString("pt-BR")}
        </span>
      </div>

      <p style={styles.text}>{memoria.resumo?.texto}</p>

      <div style={styles.grid}>
        <Info label="Eventos" value={totais.eventos || 0} />
        <Info label="Pendências" value={totais.pendencias || 0} />
        <Info label="Fiscal" value={totais.fiscais || 0} />
        <Info label="Financeiro" value={totais.financeiros || 0} />
        <Info label="Documentos" value={totais.documentos || 0} />
        <Info label="Acessos e-CAC" value={totais.acessosEcac || 0} />
      </div>

      {alertas.length > 0 && (
        <div style={styles.alertBox}>
          <strong style={styles.alertTitle}>Pontos de atenção</strong>
          {alertas.map((alerta) => (
            <span key={alerta} style={styles.alertItem}>• {alerta}</span>
          ))}
        </div>
      )}
    </section>
  )
}

function Info({ label, value }) {
  return (
    <div style={styles.info}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  )
}

const styles = {
  card: { background: "linear-gradient(145deg,#061f47,#07346d)", border: "1px solid rgba(55,255,116,.22)", borderRadius: "20px", padding: "22px" },
  header: { display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", alignItems: "flex-start" },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "6px 0 0", fontSize: "25px" },
  updated: { color: "#a9b8cc", fontSize: "12px" },
  text: { color: "#dce8f8", lineHeight: 1.6, margin: "18px 0" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "10px" },
  info: { background: "rgba(255,255,255,.06)", borderRadius: "13px", padding: "13px" },
  infoLabel: { display: "block", color: "#a9b8cc", fontSize: "12px" },
  infoValue: { display: "block", marginTop: "4px", fontSize: "21px" },
  alertBox: { marginTop: "16px", padding: "15px", borderRadius: "14px", background: "rgba(255,184,77,.10)", border: "1px solid rgba(255,184,77,.25)", display: "flex", flexDirection: "column", gap: "7px" },
  alertTitle: { color: "#ffd54a" },
  alertItem: { color: "#f2f6fc" },
}
