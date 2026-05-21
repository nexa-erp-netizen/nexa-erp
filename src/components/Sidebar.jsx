import logo from "../assets/logo.png"

export default function Sidebar({
  page,
  setPage,
  usuario,
}) {
  const menusPorPerfil = {
  Administrador: [
    "Dashboard",
    "Escritório Digital",
    "Clientes",
    "Serviços",
    "Plano de Contas",
    "Lançamentos Contábeis",
    "Fiscal",
    "Financeiro",
    "Acesso Rápido Fiscal",
    "Portal Cliente",
    "Documentos Digitais",
    "Relatórios",
    "Backup Sistema",
  ],

  Funcionário: [
    "Dashboard",
    "Escritório Digital",
    "Clientes",
    "Lançamentos Contábeis",
    "Fiscal",
    "Financeiro",
    "Acesso Rápido Fiscal",
    "Portal Cliente",
    "Documentos Digitais",
    "Relatórios",
  ],

  Cliente: [
    "Portal Cliente",
    "Documentos Digitais",
    "Fiscal",
  ],
}

  const menu =
    menusPorPerfil[usuario?.perfil] ||
    menusPorPerfil.Cliente

  return (
    <aside style={styles.sidebar}>
      <img
        src={logo}
        alt="Nexa"
        style={styles.logo}
      />

      <div style={styles.perfilBox}>
        <span style={styles.perfilLabel}>
          Perfil
        </span>

        <strong style={styles.perfilNome}>
          {usuario?.perfil}
        </strong>
      </div>

      {menu.map((item) => (
        <button
          key={item}
          onClick={() => setPage(item)}
          style={{
            ...styles.menuButton,
            ...(page === item
              ? styles.menuActive
              : {}),
          }}
        >
          {item}
        </button>
      ))}
    </aside>
  )
}

const styles = {
  sidebar: {
    background: "#00142f",
    padding: "30px 20px",
    height: "100vh",
    overflowY: "auto",
    overflowX: "hidden",
  },

  logo: {
    width: "190px",
    display: "block",
    margin: "0 auto 25px",
  },

  perfilBox: {
    background: "#061f47",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "16px",
    padding: "14px",
    marginBottom: "25px",
  },

  perfilLabel: {
    display: "block",
    color: "#a9b8cc",
    fontSize: "12px",
    marginBottom: "5px",
  },

  perfilNome: {
    color: "#37ff74",
    fontSize: "16px",
  },

  menuButton: {
    width: "100%",
    padding: "17px",
    marginBottom: "12px",
    borderRadius: "14px",
    border: "none",
    background: "transparent",
    color: "white",
    fontSize: "17px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: ".3s",
    textAlign: "left",
  },

  menuActive: {
    background:
      "linear-gradient(90deg, #00a8ff, #37ff74)",
    color: "#00112b",
  },
}