import logo from "../assets/logo.png"

const VERSAO_ATUAL = "3.2.0"
const RELEASE = "WhatsApp Inteligente"
const DATA_RELEASE = "09/07/2026"

export default function Sobre() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src={logo} alt="Nexa ERP" style={styles.logo} />

        <h1 style={styles.title}>Sobre o Nexa ERP</h1>
        <p style={styles.subtitle}>Sistema de gestão contábil digital</p>

        <div style={styles.versionBox}>
          <span style={styles.label}>Versão atual</span>
          <strong style={styles.version}>v{VERSAO_ATUAL}</strong>
          <span style={styles.release}>{RELEASE}</span>
        </div>

        <div style={styles.grid}>
          <div style={styles.infoBox}>
            <span style={styles.infoLabel}>Release</span>
            <strong style={styles.infoText}>{RELEASE}</strong>
          </div>

          <div style={styles.infoBox}>
            <span style={styles.infoLabel}>Atualização</span>
            <strong style={styles.infoText}>{DATA_RELEASE}</strong>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Incluído nesta versão</h2>
          <ul style={styles.list}>
            <li>Central WhatsApp Inteligente</li>
            <li>Modelos de mensagens com dados do cliente</li>
            <li>Abertura manual pelo WhatsApp Web</li>
            <li>Estrutura preparada para futura API oficial</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: "100%",
    padding: "24px",
    boxSizing: "border-box",
    color: "white",
  },

  card: {
    maxWidth: "760px",
    margin: "0 auto",
    background: "linear-gradient(180deg, #061f47, #03142f)",
    border: "1px solid rgba(55,255,116,.22)",
    borderRadius: "22px",
    padding: "30px",
    boxShadow: "0 18px 55px rgba(0,0,0,.28)",
  },

  logo: {
    width: "150px",
    display: "block",
    margin: "0 auto 18px",
  },

  title: {
    textAlign: "center",
    margin: "0 0 6px",
    fontSize: "30px",
  },

  subtitle: {
    textAlign: "center",
    margin: "0 0 24px",
    color: "#a9b8cc",
  },

  versionBox: {
    background: "rgba(0,168,255,.12)",
    border: "1px solid rgba(0,168,255,.28)",
    borderRadius: "18px",
    padding: "18px",
    textAlign: "center",
    marginBottom: "18px",
  },

  label: {
    display: "block",
    color: "#a9b8cc",
    fontSize: "13px",
    marginBottom: "6px",
  },

  version: {
    display: "block",
    color: "#37ff74",
    fontSize: "34px",
    lineHeight: 1,
  },

  release: {
    display: "block",
    marginTop: "8px",
    color: "#d9e8ff",
    fontWeight: "bold",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    marginBottom: "18px",
  },

  infoBox: {
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: "16px",
    padding: "15px",
  },

  infoLabel: {
    display: "block",
    color: "#a9b8cc",
    fontSize: "12px",
    marginBottom: "6px",
  },

  infoText: {
    color: "white",
    fontSize: "15px",
  },

  section: {
    background: "rgba(55,255,116,.08)",
    border: "1px solid rgba(55,255,116,.20)",
    borderRadius: "16px",
    padding: "18px",
  },

  sectionTitle: {
    margin: "0 0 10px",
    fontSize: "18px",
  },

  list: {
    margin: 0,
    paddingLeft: "20px",
    color: "#d9e8ff",
    lineHeight: 1.8,
  },
}
