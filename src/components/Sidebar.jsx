import { useEffect, useState } from "react"
import logo from "../assets/logo.png"
import {
  FaChartLine,
  FaBuilding,
  FaUsers,
  FaBook,
  FaFileInvoice,
  FaMoneyBillWave,
  FaGlobe,
  FaChartPie,
  FaCog,
  FaBell,
  FaFlask,
} from "react-icons/fa"

const API_URL = "https://nexa-erp-api.onrender.com"

export default function Sidebar({ page, setPage, usuario }) {
  const [grupoAberto, setGrupoAberto] = useState("")
  const [contadorNotificacoes, setContadorNotificacoes] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function verificarMobile() {
      setIsMobile(window.innerWidth <= 768)
    }

    verificarMobile()
    window.addEventListener("resize", verificarMobile)

    return () => window.removeEventListener("resize", verificarMobile)
  }, [])

  useEffect(() => {
    async function carregarContador() {
      if (usuario?.perfil === "Cliente") return

      const usuarioSalvo = JSON.parse(localStorage.getItem("usuario") || "{}")
      const token = localStorage.getItem("token") || usuarioSalvo?.token

      if (!token) return

      try {
        const resposta = await fetch(`${API_URL}/notificacoes/contador`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const dados = await resposta.json()
        setContadorNotificacoes(dados.total || 0)
      } catch (error) {
        console.error("Erro ao carregar contador de notificações:", error)
      }
    }

    carregarContador()
  }, [usuario, page])

  const gruposEscritorio = [
    {
      titulo: "Contábil",
      icon: <FaBook />,
      itens: [
        "Plano de Contas",
        "Lançamentos Contábeis",
        "Movimentos Clientes",
        "DRE Gerencial",
      ],
    },
    {
      titulo: "Fiscal",
      icon: <FaFileInvoice />,
      itens: ["Fiscal"],
    },
    {
      titulo: "Financeiro",
      icon: <FaMoneyBillWave />,
      itens: ["Financeiro", "Serviços"],
    },
    {
      titulo: "Atendimento",
      icon: <FaGlobe />,
      itens: ["Pendências Clientes", "Documentos Digitais", "WhatsApp Inteligente", "Assistente do Dia"],
    },
    {
      titulo: "Ferramentas",
      icon: <FaFlask />,
      itens: ["Laboratório Tributário", "Memória da Nexa", "Identidade Digital", "Central e-CAC", "Certificados Digitais", "Procurações e-CAC"],
    },
    {
      titulo: "Configurações",
      icon: <FaCog />,
      itens: ["Usuários", "Backup Sistema", "Sobre"],
    },
  ]

  const menuCliente = [
    "Portal Cliente",
    "Pendências e Guias",
    "Movimentos",
    "Documentos Digitais",
  ]

  function abrirGrupo(titulo) {
    setGrupoAberto(grupoAberto === titulo ? "" : titulo)
  }

  function botaoMenu(item, icon = null) {
    const itemReal = item.startsWith("Notificações") ? "Notificações" : item
    const ativo = page === itemReal || page === item

    return (
      <button
        key={item}
        onClick={() => setPage(itemReal)}
        style={{
          ...styles.menuButton,
          ...(isMobile ? styles.menuButtonMobile : {}),
          ...(ativo ? styles.menuActive : {}),
        }}
      >
        <span style={styles.menuIcon}>{icon}</span>
        <span>{item}</span>
      </button>
    )
  }

  function grupoContemPagina(grupo) {
    return grupo.itens.includes(page)
  }

  return (
    <aside
      style={{
        ...styles.sidebar,
        ...(isMobile ? styles.sidebarMobile : {}),
      }}
    >
      <img
        src={logo}
        alt="Nexa"
        style={{
          ...styles.logo,
          ...(isMobile ? styles.logoMobile : {}),
        }}
      />

      <div
        style={{
          ...styles.perfilBox,
          ...(isMobile ? styles.perfilBoxMobile : {}),
        }}
      >
        <span style={styles.perfilLabel}>
          {usuario?.perfil === "Cliente" ? "Empresa" : "Perfil"}
        </span>

        <strong style={styles.perfilNome}>
          {usuario?.perfil === "Cliente"
            ? usuario?.clienteVinculado || usuario?.nome || "Cliente"
            : usuario?.perfil}
        </strong>
      </div>

      {usuario?.perfil === "Cliente" ? (
        <div style={isMobile ? styles.menuClienteMobile : undefined}>
          {menuCliente.map((item) => botaoMenu(item))}
        </div>
      ) : (
        <>
          {botaoMenu("Dashboard", <FaChartLine />)}

          {botaoMenu(
            contadorNotificacoes > 0
              ? `Notificações (${contadorNotificacoes})`
              : "Notificações",
            <FaBell />
          )}

          {botaoMenu("Escritório Digital", <FaBuilding />)}
          {botaoMenu("Clientes", <FaUsers />)}

          {gruposEscritorio.map((grupo) => (
            <div key={grupo.titulo}>
              <button
                onClick={() => abrirGrupo(grupo.titulo)}
                style={{
                  ...styles.groupButton,
                  ...(grupoContemPagina(grupo) ? styles.groupActive : {}),
                }}
              >
                <span style={styles.groupLeft}>
                  <span style={styles.menuIcon}>{grupo.icon}</span>
                  <span>{grupo.titulo}</span>
                </span>

                <span style={styles.arrow}>
                  {grupoAberto === grupo.titulo || grupoContemPagina(grupo)
                    ? "▲"
                    : "▼"}
                </span>
              </button>

              {(grupoAberto === grupo.titulo || grupoContemPagina(grupo)) && (
                <div style={styles.subMenu}>
                  {grupo.itens.map((item) => botaoMenu(item))}
                </div>
              )}
            </div>
          ))}

          {botaoMenu("Relatórios", <FaChartPie />)}
        </>
      )}
    </aside>
  )
}

const styles = {
  sidebar: {
    background: "#00142f",
    padding: "22px 14px",
    height: "100vh",
    overflowY: "auto",
    overflowX: "hidden",
    boxSizing: "border-box",
  },

  sidebarMobile: {
    width: "100%",
    maxWidth: "100%",
    height: "auto",
    minHeight: "auto",
    padding: "16px 12px",
    overflowX: "hidden",
  },

  logo: {
    width: "165px",
    display: "block",
    margin: "0 auto 18px",
  },

  logoMobile: {
    width: "145px",
    margin: "0 auto 12px",
  },

  perfilBox: {
    background: "#061f47",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "15px",
    padding: "13px",
    marginBottom: "16px",
    boxSizing: "border-box",
  },

  perfilBoxMobile: {
    marginBottom: "12px",
  },

  perfilLabel: {
    display: "block",
    color: "#a9b8cc",
    fontSize: "12px",
    marginBottom: "5px",
  },

  perfilNome: {
    color: "#37ff74",
    fontSize: "14px",
    wordBreak: "break-word",
  },

  menuClienteMobile: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },

  menuButton: {
    width: "100%",
    padding: "12px 13px",
    marginBottom: "7px",
    borderRadius: "12px",
    border: "none",
    background: "transparent",
    color: "white",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: ".3s",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    boxSizing: "border-box",
  },

  menuButtonMobile: {
    marginBottom: 0,
    justifyContent: "center",
    textAlign: "center",
    fontSize: "13px",
    padding: "11px 8px",
    minHeight: "44px",
  },

  menuIcon: {
    width: "18px",
    minWidth: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  menuActive: {
    background: "linear-gradient(90deg, #00a8ff, #37ff74)",
    color: "#00112b",
  },

  groupButton: {
    width: "100%",
    padding: "12px 13px",
    marginBottom: "7px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,.08)",
    background: "#061f47",
    color: "white",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxSizing: "border-box",
  },

  groupLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  groupActive: {
    border: "1px solid rgba(55,255,116,.45)",
    color: "#37ff74",
  },

  arrow: {
    fontSize: "10px",
    opacity: 0.75,
  },

  subMenu: {
    paddingLeft: "10px",
    marginBottom: "5px",
  },
}