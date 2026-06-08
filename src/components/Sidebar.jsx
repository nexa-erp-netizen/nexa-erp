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
} from "react-icons/fa"
  const API_URL = "https://nexa-erp-api.onrender.com"

export default function Sidebar({
  page,
  setPage,
  usuario,
}) {
  const [grupoAberto, setGrupoAberto] = useState("")

  const [contadorNotificacoes, setContadorNotificacoes] = useState(0)

useEffect(() => {
  async function carregarContador() {
    if (usuario?.perfil === "Cliente") return

    const usuarioSalvo = JSON.parse(localStorage.getItem("usuario"))
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
      itens: [
        "Fiscal",
        "Acesso Rápido Fiscal",
      ],
    },
    {
      titulo: "Financeiro",
      icon: <FaMoneyBillWave />,
      itens: [
        "Financeiro",
        "Serviços",
      ],
    },
    {
      titulo: "Atendimento",
      icon: <FaGlobe />,
      itens: [
        "Pendências Clientes",
        "Documentos Digitais",
      ],
    },
    {
      titulo: "Configurações",
      icon: <FaCog />,
      itens: [
        "Usuários",
        "Backup Sistema",
      ],
    },
  ]

  const menuCliente = [
    "Portal Cliente",
    "Obrigações",
    "Movimentos",
    "Documentos Digitais",
  ]

  function abrirGrupo(titulo) {
    setGrupoAberto(
      grupoAberto === titulo ? "" : titulo
    )
  }

  function botaoMenu(item, icon = null) {
    return (
      <button
        key={item}
        onClick={() =>
          setPage(item.startsWith("Notificações") ? "Notificações" : item)
        }
        style={{
          ...styles.menuButton,
          ...(page === item ||
          (item.startsWith("Notificações") && page === "Notificações")
          ? styles.menuActive
          : {}),
        }}
      >
        <span style={styles.menuIcon}>
          {icon}
        </span>

        <span>{item}</span>
      </button>
    )
  }

  function grupoContemPagina(grupo) {
    return grupo.itens.includes(page)
  }

  return (
    <aside style={styles.sidebar}>
      <img
        src={logo}
        alt="Nexa"
        style={styles.logo}
      />

      <div style={styles.perfilBox}>
        <span style={styles.perfilLabel}>
          {usuario?.perfil === "Cliente"
            ? "Empresa"
            : "Perfil"}
        </span>

        <strong style={styles.perfilNome}>
          {usuario?.perfil === "Cliente"
            ? usuario?.clienteVinculado ||
              usuario?.nome ||
              "Cliente"
            : usuario?.perfil}
        </strong>
      </div>

      {usuario?.perfil === "Cliente" ? (
        <>
          {menuCliente.map((item) =>
            botaoMenu(item)
          )}
        </>
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
                onClick={() =>
                  abrirGrupo(grupo.titulo)
                }
                style={{
                  ...styles.groupButton,
                  ...(grupoContemPagina(grupo)
                    ? styles.groupActive
                    : {}),
                }}
              >
                <span style={styles.groupLeft}>
                  <span style={styles.menuIcon}>
                    {grupo.icon}
                  </span>

                  <span>{grupo.titulo}</span>
                </span>

                <span style={styles.arrow}>
                  {grupoAberto === grupo.titulo ||
                  grupoContemPagina(grupo)
                    ? "▲"
                    : "▼"}
                </span>
              </button>

              {(grupoAberto === grupo.titulo ||
                grupoContemPagina(grupo)) && (
                <div style={styles.subMenu}>
                  {grupo.itens.map((item) =>
                    botaoMenu(item)
                  )}
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
  },

  logo: {
    width: "165px",
    display: "block",
    margin: "0 auto 18px",
  },

  perfilBox: {
    background: "#061f47",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "15px",
    padding: "13px",
    marginBottom: "16px",
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
  },

  menuIcon: {
    width: "18px",
    minWidth: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  menuActive: {
    background:
      "linear-gradient(90deg, #00a8ff, #37ff74)",
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
    opacity: .75,
  },

  subMenu: {
    paddingLeft: "10px",
    marginBottom: "5px",
  },
}