import { useState } from "react"
import api from "../services/api"
import logo from "../assets/logo.png"

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")

  async function entrar() {
    if (!email || !senha) {
      alert("Preencha e-mail e senha")
      return
    }

    try {
      const resposta = await api.post("/auth/login", {
        email,
        senha,
      })

      localStorage.setItem("token", resposta.data.token)
      localStorage.setItem(
        "usuario",
        JSON.stringify(resposta.data.usuario)
      )

      onLogin(resposta.data.usuario)
    } catch (error) {
      alert("E-mail ou senha inválidos")

      setEmail("")
      setSenha("")

      console.error(error)
    }
  }

  return (
    <div style={page}>
      <div style={card}>
        <img src={logo} alt="Nexa" style={logoStyle} />

        <h1 style={title}>Acesso ao Sistema</h1>

        <p style={subtitle}>
          Nexa Contábil Digital
        </p>

        <input
          style={input}
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          style={input}
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              entrar()
            }
          }}
        />

        <button style={button} onClick={entrar}>
          Entrar
        </button>

        <p style={aviso}>
          Acesso exclusivo para usuários autorizados pelo escritório.
        </p>
      </div>
    </div>
  )
}

const page = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #00112b, #00275c, #00112b)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
}

const card = {
  width: "100%",
  maxWidth: "430px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "28px",
  padding: "36px",
  boxShadow: "0 0 50px rgba(0,0,0,.45)",
}

const logoStyle = {
  width: "210px",
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
}