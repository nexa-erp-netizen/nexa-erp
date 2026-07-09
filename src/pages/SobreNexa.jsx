import NEXA_VERSION from "../config/version"

export default function SobreNexa() {
  return (
    <div style={box}>
      <div style={hero}>
        <div>
          <span style={badge}>Nexa ERP</span>
          <h2 style={title}>Sobre o sistema</h2>
          <p style={subtitle}>
            Controle de versão, release atual e histórico de evolução do Nexa ERP.
          </p>
        </div>

        <div style={versionCard}>
          <span style={versionLabel}>Versão atual</span>
          <strong style={versionNumber}>v{NEXA_VERSION.version}</strong>
          <span style={buildText}>Build {NEXA_VERSION.build}</span>
        </div>
      </div>

      <div style={cards}>
        <InfoCard label="Release" value={NEXA_VERSION.release} />
        <InfoCard label="Data" value={NEXA_VERSION.date} />
        <InfoCard label="Status" value={NEXA_VERSION.status} />
        <InfoCard label="Frontend" value={NEXA_VERSION.frontend} />
        <InfoCard label="Backend" value={NEXA_VERSION.backend} />
        <InfoCard label="Banco" value={NEXA_VERSION.banco} />
        <InfoCard label="Storage" value={NEXA_VERSION.storage} />
      </div>

      <div style={section}>
        <h3 style={sectionTitle}>Histórico de versões</h3>

        <div style={timeline}>
          {NEXA_VERSION.changelog.map((item) => (
            <div key={item.version} style={releaseBox}>
              <div style={releaseHeader}>
                <div>
                  <strong style={releaseVersion}>v{item.version}</strong>
                  <span style={releaseName}>{item.release}</span>
                </div>

                <span style={releaseDate}>{item.date}</span>
              </div>

              <ul style={list}>
                {item.items.map((linha) => (
                  <li key={linha} style={listItem}>✔ {linha}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div style={card}>
      <span style={cardLabel}>{label}</span>
      <strong style={cardValue}>{value}</strong>
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "stretch",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "24px",
}

const badge = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: "999px",
  background: "rgba(55,255,116,.14)",
  color: "#37ff74",
  fontWeight: "bold",
  marginBottom: "10px",
}

const title = {
  margin: 0,
  color: "white",
  fontSize: "34px",
}

const subtitle = {
  color: "#a9b8cc",
  margin: "8px 0 0",
  maxWidth: "680px",
}

const versionCard = {
  minWidth: "220px",
  background: "linear-gradient(135deg, #00a8ff, #37ff74)",
  color: "#00112b",
  borderRadius: "20px",
  padding: "22px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
}

const versionLabel = {
  fontWeight: "bold",
  opacity: 0.8,
}

const versionNumber = {
  fontSize: "38px",
  lineHeight: "44px",
}

const buildText = {
  fontWeight: "bold",
}

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "24px",
}

const card = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "16px",
  padding: "18px",
}

const cardLabel = {
  display: "block",
  color: "#a9b8cc",
  fontSize: "13px",
  marginBottom: "8px",
}

const cardValue = {
  color: "white",
  fontSize: "17px",
}

const section = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "22px",
}

const sectionTitle = {
  color: "white",
  marginTop: 0,
}

const timeline = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
}

const releaseBox = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.10)",
  borderRadius: "14px",
  padding: "16px",
}

const releaseHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "10px",
}

const releaseVersion = {
  color: "#37ff74",
  marginRight: "10px",
}

const releaseName = {
  color: "white",
  fontWeight: "bold",
}

const releaseDate = {
  color: "#a9b8cc",
  fontSize: "13px",
}

const list = {
  margin: 0,
  paddingLeft: "18px",
}

const listItem = {
  color: "#dce8f8",
  lineHeight: "28px",
}
