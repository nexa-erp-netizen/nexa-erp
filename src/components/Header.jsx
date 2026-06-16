export default function Header({
  title,
  usuario,
  onLogout,
}) {
  const mobile =
    typeof window !== "undefined" &&
    window.innerWidth <= 768

  return (
    <header
      style={{
        ...styles.header,
        ...(mobile ? styles.headerMobile : {}),
      }}
    >
      <div>
        <h1
          style={{
            ...styles.title,
            ...(mobile ? styles.titleMobile : {}),
          }}
        >
          {title}
        </h1>

        <p
          style={{
            ...styles.subtitle,
            ...(mobile ? styles.subtitleMobile : {}),
          }}
        >
          Sistema ERP Contábil Inteligente
        </p>
      </div>

      <div
        style={{
          ...styles.userBox,
          ...(mobile ? styles.userBoxMobile : {}),
        }}
      >
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

  headerMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "15px",
  },

  title: {
    fontSize: "42px",
    margin: 0,
  },

  titleMobile: {
    fontSize: "24px",
    lineHeight: "30px",
    wordBreak: "break-word",
  },

  subtitle: {
    color: "#a9b8cc",
    fontSize: "18px",
    marginTop: "8px",
  },

  subtitleMobile: {
    fontSize: "14px",
    lineHeight: "20px",
  },

  userBox: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    background: "#06234d",
    padding: "12px 16px",
    borderRadius: "15px",
  },

  userBoxMobile: {
    width: "100%",
    justifyContent: "space-between",
    boxSizing: "border-box",
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