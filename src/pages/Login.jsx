import { useState } from "react"
import api from "../services/api"
import logo from "../assets/logo.png"
import NEXA_VERSION from "../config/version"

export default function Login({ onLogin }) {
  const [tipoAcesso, setTipoAcesso] = useState("escritorio")
  const [login, setLogin] = useState("")
  const [senha, setSenha] = useState("")
  const [escritorioCodigo, setEscritorioCodigo] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function entrar() {
    if (!login || !senha) {
      alert("Preencha usuário, CPF, e-mail ou CNPJ e senha")
      return
    }

    if (carregando) return

    setCarregando(true)

    try {
      const resposta = await api.post("/auth/login", {
        login,
        email: login,
        senha,
        escritorioCodigo:
          tipoAcesso === "escritorio"
            ? escritorioCodigo.trim() || undefined
            : undefined,
      })

      localStorage.setItem("token", resposta.data.token)
      localStorage.setItem("usuario", JSON.stringify(resposta.data.usuario))

      onLogin(resposta.data.usuario)
    } catch (error) {
      alert("Usuário ou senha inválidos")
      setLogin("")
      setSenha("")
      console.error(error)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="login-page" style={page}>
      <style>{`
        .nexa-loading-bar {
          width: 100%;
          height: 16px;
          background: #dbeafe;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 18px;
          position: relative;
        }

        .nexa-loading-fill {
          width: 45%;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #00a8ff, #37ff74, #00a8ff);
          animation: nexaLoadingMove 1.1s ease-in-out infinite;
        }

        @keyframes nexaLoadingMove {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(260%); }
        }

        @media (max-width: 900px) {
          .login-page {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 100dvh !important;
            padding: 18px !important;
            overflow-x: hidden !important;
            box-sizing: border-box !important;
          }

          .login-area {
            width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
            background: transparent !important;
          }

          .login-card {
            width: 100% !important;
            max-width: 390px !important;
            margin: 0 auto !important;
          }

          .login-logo {
            width: 185px !important;
            height: auto !important;
            object-fit: contain !important;
            image-rendering: auto !important;
            margin-bottom: 24px !important;
          }

          .login-card h1 {
            font-size: 34px !important;
            line-height: 1.05 !important;
            white-space: normal !important;
            word-break: normal !important;
          }

          .login-card input,
          .login-card button {
            box-sizing: border-box !important;
          }

          .login-password-input {
            width: 100% !important;
            padding-right: 58px !important;
          }

          .login-eye-button {
            width: 42px !important;
            min-width: 42px !important;
            max-width: 42px !important;
            height: 42px !important;
            right: 8px !important;
            padding: 0 !important;
            flex: none !important;
          }

          .login-hero {
            display: none !important;
          }
        }

        @media (max-width: 430px) {
          .login-card h1 {
            font-size: 30px !important;
          }

          .login-logo {
            width: 170px !important;
          }
        }
      `}</style>

      {carregando && (
        <div style={overlay}>
          <div style={loadingBox}>
            <div className="nexa-loading-bar">
              <div className="nexa-loading-fill" />
            </div>

            <strong style={loadingText}>Carregando o sistema Nexa...</strong>
          </div>
        </div>
      )}

      <div className="login-area" style={loginArea}>
        <div className="login-card" style={card}>
          <img className="login-logo" src={logo} alt="Nexa" style={logoStyle} />

          <h1 style={title}>Acesso ao Sistema</h1>

          <p style={subtitle}>Nexa Contábil Digital</p>

          <div style={accessTypeBox}>
            <button
              type="button"
              style={{
                ...accessTypeButton,
                ...(tipoAcesso === "escritorio" ? accessTypeButtonActive : {}),
              }}
              disabled={carregando}
              onClick={() => setTipoAcesso("escritorio")}
            >
              Acesso do Escritório
            </button>

            <button
              type="button"
              style={{
                ...accessTypeButton,
                ...(tipoAcesso === "cliente" ? accessTypeButtonActive : {}),
              }}
              disabled={carregando}
              onClick={() => {
                setTipoAcesso("cliente")
                setEscritorioCodigo("")
              }}
            >
              Acesso do Cliente
            </button>
          </div>

          <input
            style={input}
            placeholder="Usuário, CPF, E-mail ou CNPJ"
            value={login}
            disabled={carregando}
            onChange={(e) => setLogin(e.target.value)}
          />

          {tipoAcesso === "escritorio" && (
            <input
              style={input}
              placeholder="Código do escritório"
              value={escritorioCodigo}
              disabled={carregando}
              onChange={(e) => setEscritorioCodigo(e.target.value.toLowerCase())}
            />
          )}

          <div style={passwordBox}>
            <input
              className="login-password-input"
              style={passwordInput}
              type={mostrarSenha ? "text" : "password"}
              placeholder="Senha"
              value={senha}
              disabled={carregando}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") entrar()
              }}
            />

            <button
              className="login-eye-button"
              type="button"
              style={eyeButton}
              onClick={() => setMostrarSenha(!mostrarSenha)}
              disabled={carregando}
              title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrarSenha ? "🙈" : "👁️"}
            </button>
          </div>

          <button style={button} onClick={entrar} disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>

          <p style={aviso}>Acesso exclusivo para usuários autorizados pelo escritório.</p>

          <p style={versionLogin}>v{NEXA_VERSION.version} • {NEXA_VERSION.release}</p>
        </div>
      </div>

      <div className="login-hero" style={hero}>
        <div style={heroOverlay}>
          <h2 style={heroTitle}>Seu escritório contábil conectado ao cliente todos os dias</h2>

          <p style={heroText}>Organize guias, declarações, documentos e solicitações em um só lugar.</p>
        </div>
      </div>
    </div>
  )
}

const page = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #00112b, #00275c, #00112b)",
  display: "grid",
  gridTemplateColumns: "430px 1fr",
  color: "white",
  overflowX: "hidden",
}

const accessTypeBox = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
  marginBottom: "14px",
  padding: "4px",
  borderRadius: "12px",
  background: "rgba(255,255,255,0.08)",
}

const accessTypeButton = {
  minHeight: "42px",
  padding: "8px 10px",
  border: "1px solid transparent",
  borderRadius: "9px",
  background: "transparent",
  color: "#b9cbea",
  fontWeight: 700,
  cursor: "pointer",
}

const accessTypeButtonActive = {
  borderColor: "rgba(55,255,116,0.7)",
  background: "rgba(0,168,255,0.22)",
  color: "#ffffff",
}

const loginArea = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "28px",
  background: "rgba(0,17,43,.92)",
}

const card = {
  width: "100%",
  maxWidth: "390px",
}

const logoStyle = {
  width: "210px",
  height: "auto",
  objectFit: "contain",
  display: "block",
  margin: "0 auto 30px",
}

const title = {
  color: "white",
  textAlign: "center",
  marginBottom: "10px",
}

const subtitle = {
  color: "#a9b8cc",
  textAlign: "center",
  marginBottom: "28px",
}

const input = {
  width: "100%",
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
  marginBottom: "15px",
  boxSizing: "border-box",
}

const passwordBox = {
  position: "relative",
  marginBottom: "15px",
  width: "100%",
}

const passwordInput = {
  ...input,
  marginBottom: 0,
  paddingRight: "60px",
}

const eyeButton = {
  position: "absolute",
  right: "8px",
  top: "50%",
  transform: "translateY(-50%)",
  width: "42px",
  height: "42px",
  minWidth: "42px",
  maxWidth: "42px",
  border: "none",
  borderRadius: "10px",
  background: "rgba(255,255,255,.10)",
  color: "white",
  cursor: "pointer",
  fontSize: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
}

const button = {
  width: "100%",
  padding: "15px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "16px",
}

const aviso = {
  color: "#a9b8cc",
  fontSize: "13px",
  textAlign: "center",
  marginTop: "18px",
  lineHeight: "22px",
}

const hero = {
  position: "relative",
  background:
    "linear-gradient(135deg, rgba(0,39,92,.25), rgba(0,17,43,.85)), url('https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1400&q=80')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px",
}

const heroOverlay = {
  maxWidth: "620px",
}

const heroTitle = {
  fontSize: "52px",
  lineHeight: "1.08",
  margin: 0,
  fontWeight: 900,
  textShadow: "0 10px 30px rgba(0,0,0,.45)",
}

const heroText = {
  marginTop: "20px",
  fontSize: "20px",
  color: "#d9e7ff",
  lineHeight: "30px",
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.65)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
}

const loadingBox = {
  width: "100%",
  maxWidth: "500px",
  background: "white",
  borderRadius: "16px",
  padding: "22px",
  boxShadow: "0 20px 70px rgba(0,0,0,.45)",
  textAlign: "center",
}

const loadingText = {
  color: "#00112b",
  fontSize: "15px",
}


const versionLogin = {
  marginTop: "14px",
  color: "#6f87a8",
  fontSize: "12px",
  fontWeight: "bold",
}
