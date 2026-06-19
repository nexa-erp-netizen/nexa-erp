import { useEffect, useState } from "react"
import api from "../services/api"

export default function BackupSistema() {
  const [backups, setBackups] = useState([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    carregarBackups()
  }, [])

  async function carregarBackups() {
    try {
      const resposta = await api.get("/backup")
      setBackups(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      alert("Erro ao carregar backups")
      console.error(error)
    }
  }

  async function gerarBackup() {
    try {
      setCarregando(true)
      const resposta = await api.post("/backup/gerar")
      alert(resposta.data.message || "Backup gerado com sucesso")
      await carregarBackups()
    } catch (error) {
      alert(error.response?.data?.detalhe || "Erro ao gerar backup")
      console.error(error)
    } finally {
      setCarregando(false)
    }
  }

  async function baixarBackup(arquivo) {
    try {
      const resposta = await api.get(`/backup/download/${encodeURIComponent(arquivo)}`)

      if (resposta.data?.url) {
        window.open(resposta.data.url, "_blank")
        return
      }

      window.open(`${api.defaults.baseURL}/backup/download/${encodeURIComponent(arquivo)}`, "_blank")
    } catch (error) {
      alert("Erro ao baixar backup")
      console.error(error)
    }
  }

  function nomeArquivo(item) {
    return typeof item === "string" ? item : item.arquivo
  }

  function origem(item) {
    return typeof item === "string" ? "Local" : item.origem || "Local"
  }

  function tamanho(item) {
    const bytes = typeof item === "string" ? null : item.tamanhoBytes

    if (!bytes) return ""

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  function dataBackup(item) {
    const data = typeof item === "string" ? null : item.criadoEm

    if (!data) return ""

    return new Date(data).toLocaleString("pt-BR")
  }

  return (
    <div style={box}>
      <div style={topo}>
        <div>
          <h2 style={titulo}>Backup do Sistema</h2>

          <p style={subtitle}>
            Cópia de segurança em JSON do banco de dados do Nexa ERP, sem depender do pg_dump.
          </p>
        </div>

        <button
          style={{
            ...button,
            opacity: carregando ? 0.7 : 1,
            cursor: carregando ? "not-allowed" : "pointer",
          }}
          onClick={gerarBackup}
          disabled={carregando}
        >
          {carregando ? "Gerando..." : "Gerar Backup"}
        </button>
      </div>

      <div style={alerta}>
        Este backup salva clientes, fiscal, movimentos, financeiro, lançamentos contábeis,
        usuários, documentos e demais tabelas principais do sistema.
      </div>

      <div style={lista}>
        {backups.length === 0 && (
          <p style={empty}>
            Nenhum backup gerado ainda.
          </p>
        )}

        {backups.map((item, index) => {
          const arquivo = nomeArquivo(item)

          return (
            <div key={`${arquivo}-${index}`} style={itemBox}>
              <div>
                <strong>📦 {arquivo}</strong>

                <div style={meta}>
                  {origem(item)} {tamanho(item) && `• ${tamanho(item)}`} {dataBackup(item) && `• ${dataBackup(item)}`}
                </div>
              </div>

              <button
                style={downloadButton}
                onClick={() => baixarBackup(arquivo)}
              >
                Baixar
              </button>
            </div>
          )
        })}
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
  marginBottom: "18px",
  flexWrap: "wrap",
}

const titulo = {
  margin: 0,
}

const subtitle = {
  color: "#a9b8cc",
  marginBottom: 0,
}

const alerta = {
  background: "#061f47",
  border: "1px solid rgba(55,255,116,.25)",
  borderRadius: "14px",
  padding: "14px 16px",
  color: "#d6e6ff",
  marginBottom: "22px",
}

const button = {
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
}

const lista = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
}

const empty = {
  color: "#a9b8cc",
}

const itemBox = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "14px",
  padding: "16px",
  color: "white",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
}

const meta = {
  marginTop: "7px",
  color: "#a9b8cc",
  fontSize: "13px",
}

const downloadButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}
