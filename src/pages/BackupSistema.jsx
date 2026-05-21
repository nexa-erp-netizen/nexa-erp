import { useEffect, useState } from "react"
import api from "../services/api"

export default function BackupSistema() {
  const [backups, setBackups] = useState([])

  useEffect(() => {
    carregarBackups()
  }, [])

  async function carregarBackups() {
    try {
      const resposta = await api.get("/backup")
      setBackups(resposta.data)
    } catch (error) {
      alert("Erro ao carregar backups")
      console.error(error)
    }
  }

  async function gerarBackup() {
    try {
      const resposta = await api.post("/backup/gerar")

      alert(resposta.data.message)

      await carregarBackups()
    } catch (error) {
      alert("Erro ao gerar backup")
      console.error(error)
    }
  }

  return (
    <div style={box}>
      <div style={topo}>
        <div>
          <h2>Backup do Sistema</h2>

          <p style={subtitle}>
            Gere cópias de segurança do banco de dados do ERP.
          </p>
        </div>

        <button
          style={button}
          onClick={gerarBackup}
        >
          Gerar Backup
        </button>
      </div>

      <div style={lista}>
        {backups.length === 0 && (
          <p style={empty}>
            Nenhum backup gerado ainda.
          </p>
        )}

        {backups.map((arquivo, index) => (
          <div key={index} style={item}>
            📦 {arquivo}
          </div>
        ))}
      </div>
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const topo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "25px",
}

const subtitle = {
  color: "#a9b8cc",
}

const button = {
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const lista = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
}

const empty = {
  color: "#a9b8cc",
}

const item = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "14px",
  padding: "16px",
  color: "white",
}