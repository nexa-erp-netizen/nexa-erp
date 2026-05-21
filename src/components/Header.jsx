export default function Header({
  title,
  usuario,
  onLogout,
}) {
  return (
    <header style={styles.header}>
      <div>
        <h1 style={styles.title}>
          {title}
        </h1>

        <p style={styles.subtitle}>
          Sistema ERP Contábil Inteligente
        </p>
      </div>

      <div style={styles.userBox}>
        <div>
          <strong style={styles.userName}>
            {usuario?.perfil}
          </strong>

          <span style={styles.userEmail}>
            {usuario?.email}
          </span>
        </div>

        <button
          style={styles.logout}
          onClick={onLogout}
        >
          Sair
        </button>
      </div>
    </header>
  )
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "35px",
  },

  title: {
    fontSize: "42px",
    margin: 0,
  },

  subtitle: {
    color: "#a9b8cc",
    fontSize: "18px",
    marginTop: "8px",
  },

  userBox: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    background: "#06234d",
    padding: "12px 16px",
    borderRadius: "15px",
  },

  userName: {
    display: "block",
    color: "#37ff74",
    fontSize: "14px",
  },

  userEmail: {
    display: "block",
    color: "#a9b8cc",
    fontSize: "12px",
    marginTop: "3px",
  },

  logout: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    background: "#ff4d4f",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  },
}