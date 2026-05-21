export default function Card({ title, value }) {
  return (
    <div style={styles.card}>
      <p style={styles.text}>
        {title}
      </p>

      <h2 style={styles.value}>
        {value}
      </h2>
    </div>
  )
}

const styles = {
  card: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: "22px",
    padding: "28px",
    border: "1px solid rgba(255,255,255,.08)",
  },

  text: {
    color: "#a9b8cc",
    marginBottom: "12px",
    fontSize: "16px",
  },

  value: {
    margin: 0,
    fontSize: "38px",
    fontWeight: "bold",
  },
}