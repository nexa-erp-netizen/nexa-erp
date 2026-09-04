import { useEffect, useState } from "react"
import api from "../services/api"

export default function BackupSistema() {
  const [backups, setBackups] = useState([])
  const [auditoria, setAuditoria] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [baixando, setBaixando] = useState("")
  const [validando, setValidando] = useState("")
  const [restaurando, setRestaurando] = useState(false)
  const [modal, setModal] = useState(null)
  const [confirmacao, setConfirmacao] = useState("")

  useEffect(() => {
    carregarTudo()
  }, [])

  async function carregarTudo() {
    await Promise.all([
      carregarBackups(),
      carregarAuditoria(),
    ])
  }

  async function carregarBackups() {
    try {
      const resposta = await api.get("/backup")
      setBackups(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      alert("Erro ao carregar backups")
      console.error(error)
    }
  }

  async function carregarAuditoria() {
    try {
      const resposta = await api.get("/backup/auditoria/restauracoes")
      setAuditoria(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("Erro ao carregar auditoria de restaurações", error)
      setAuditoria([])
    }
  }

  async function gerarBackup() {
    try {
      setCarregando(true)
      const resposta = await api.post("/backup/gerar")
      const total = resposta.data?.resumo?.totalRegistros
      const complemento = Number.isFinite(Number(total))
        ? `\n${total} registros protegidos.`
        : ""

      alert(`${resposta.data.message || "Backup gerado com sucesso"}${complemento}`)
      await carregarTudo()
    } catch (error) {
      alert(error.response?.data?.detalhe || "Erro ao gerar backup")
      console.error(error)
    } finally {
      setCarregando(false)
    }
  }

  async function baixarBackup(arquivo) {
    try {
      setBaixando(arquivo)
      const resposta = await api.get(
        `/backup/download/${encodeURIComponent(arquivo)}`,
        { responseType: "blob" }
      )

      const contentType = String(resposta.headers?.["content-type"] || "")

      if (contentType.includes("application/json")) {
        const texto = await resposta.data.text()
        const payload = JSON.parse(texto)

        if (payload?.url) {
          window.open(payload.url, "_blank", "noopener,noreferrer")
          return
        }
      }

      const url = URL.createObjectURL(resposta.data)
      const link = document.createElement("a")
      link.href = url
      link.download = arquivo
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert("Erro ao baixar backup")
      console.error(error)
    } finally {
      setBaixando("")
    }
  }

  async function prepararRestauracao(item) {
    const arquivo = nomeArquivo(item)

    if (!arquivo.toLowerCase().endsWith(".json")) {
      alert("Este backup é legado e está disponível apenas para download.")
      return
    }

    try {
      setValidando(arquivo)
      const resposta = await api.get(`/backup/validar/${encodeURIComponent(arquivo)}`)

      if (!resposta.data?.restauravel) {
        alert((resposta.data?.erros || ["Backup não restaurável"]).join("\n"))
        return
      }

      setConfirmacao("")
      setModal({
        item,
        arquivo,
        validacao: resposta.data,
      })
    } catch (error) {
      const dados = error.response?.data
      const mensagem = dados?.erros?.join("\n")
        || dados?.detalhe
        || dados?.message
        || "Não foi possível validar este backup"
      alert(mensagem)
    } finally {
      setValidando("")
    }
  }

  async function restaurarBackup() {
    if (!modal || confirmacao.trim().toUpperCase() !== "RESTAURAR") return

    const confirmou = window.confirm(
      `Restaurar ${modal.arquivo}?\n\nA Nexa criará um backup de segurança do estado atual antes de alterar qualquer dado.`
    )

    if (!confirmou) return

    try {
      setRestaurando(true)
      const resposta = await api.post(
        `/backup/restaurar/${encodeURIComponent(modal.arquivo)}`,
        {
          confirmacao: "RESTAURAR",
          checksum: modal.validacao.checksumSha256,
        }
      )

      const seguranca = resposta.data?.backupSeguranca
        ? `\n\nBackup de segurança criado: ${resposta.data.backupSeguranca}`
        : ""

      alert(`${resposta.data?.message || "Backup restaurado com sucesso"}${seguranca}`)
      setModal(null)
      setConfirmacao("")
      window.location.reload()
    } catch (error) {
      const dados = error.response?.data
      const mensagem = dados?.erros?.join("\n")
        || dados?.detalhe
        || dados?.message
        || "Erro ao restaurar backup"

      const seguranca = dados?.backupSeguranca
        ? `\n\nO backup de segurança foi preservado: ${dados.backupSeguranca}`
        : ""

      alert(`${mensagem}${seguranca}`)
      console.error(error)
    } finally {
      setRestaurando(false)
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

  function dataHora(data) {
    if (!data) return "-"
    return new Date(data).toLocaleString("pt-BR")
  }

  return (
    <div style={box}>
      <div style={topo}>
        <div>
          <h2 style={titulo}>Backup e Restauração</h2>
          <p style={subtitle}>
            Proteção dos dados do escritório com validação de integridade e restauração controlada.
          </p>
        </div>

        <button
          style={{
            ...button,
            opacity: carregando ? 0.7 : 1,
            cursor: carregando ? "not-allowed" : "pointer",
          }}
          onClick={gerarBackup}
          disabled={carregando || restaurando}
        >
          {carregando ? "Gerando..." : "Gerar Backup"}
        </button>
      </div>

      <div style={alerta}>
        <strong>Backup seguro v3.53+</strong>
        <div style={{ marginTop: 6 }}>
          Cada novo backup recebe checksum de integridade. Antes de uma restauração, a Nexa cria automaticamente
          outro backup com o estado atual e só confirma a operação se os dados restaurados forem validados.
        </div>
      </div>

      <div style={nota}>
        Backups antigos continuam disponíveis para download, mas somente backups gerados a partir da v3.53 podem
        ser restaurados automaticamente. Os arquivos de documentos permanecem no Storage; o backup restaura os
        dados e referências armazenados no PostgreSQL.
      </div>

      <div style={lista}>
        {backups.length === 0 && (
          <p style={empty}>Nenhum backup gerado ainda.</p>
        )}

        {backups.map((item, index) => {
          const arquivo = nomeArquivo(item)
          const ehJson = arquivo.toLowerCase().endsWith(".json")

          return (
            <div key={`${arquivo}-${index}`} style={itemBox}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ overflowWrap: "anywhere" }}>📦 {arquivo}</strong>

                <div style={meta}>
                  {origem(item)} {tamanho(item) && `• ${tamanho(item)}`} {dataBackup(item) && `• ${dataBackup(item)}`}
                </div>
              </div>

              <div style={acoes}>
                <button
                  style={downloadButton}
                  onClick={() => baixarBackup(arquivo)}
                  disabled={baixando === arquivo || restaurando}
                >
                  {baixando === arquivo ? "Baixando..." : "Baixar"}
                </button>

                <button
                  style={{
                    ...restoreButton,
                    opacity: ehJson ? 1 : 0.55,
                    cursor: ehJson ? "pointer" : "not-allowed",
                  }}
                  onClick={() => prepararRestauracao(item)}
                  disabled={!ehJson || validando === arquivo || restaurando}
                  title={!ehJson ? "Backup legado: somente download" : "Validar e restaurar este backup"}
                >
                  {validando === arquivo ? "Validando..." : "Restaurar"}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={auditoriaBox}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Últimas restaurações</h3>

        {auditoria.length === 0 ? (
          <div style={empty}>Nenhuma restauração registrada.</div>
        ) : (
          auditoria.slice(0, 8).map((registro) => (
            <div key={registro.id} style={auditoriaItem}>
              <div>
                <strong>{registro.status === "SUCESSO" ? "✅" : "⚠️"} {registro.arquivo || "Backup"}</strong>
                <div style={meta}>
                  {dataHora(registro.createdAt)}
                  {registro.usuarioEmail ? ` • ${registro.usuarioEmail}` : ""}
                </div>
              </div>

              <div style={{ ...statusPill, ...(registro.status === "SUCESSO" ? statusOk : statusErro) }}>
                {registro.status}
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <div style={overlay}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>Restaurar backup</h3>

            <div style={arquivoModal}>{modal.arquivo}</div>

            <div style={resumoGrid}>
              <div style={resumoCard}>
                <span style={label}>Gerado em</span>
                <strong>{dataHora(modal.validacao.geradoEm)}</strong>
              </div>
              <div style={resumoCard}>
                <span style={label}>Versão</span>
                <strong>{modal.validacao.versaoAplicacao || "-"}</strong>
              </div>
              <div style={resumoCard}>
                <span style={label}>Tabelas</span>
                <strong>{modal.validacao.totalTabelas}</strong>
              </div>
              <div style={resumoCard}>
                <span style={label}>Registros</span>
                <strong>{modal.validacao.totalRegistros}</strong>
              </div>
            </div>

            <div style={dangerBox}>
              A restauração substituirá os dados atuais do escritório pelo estado deste backup. Antes disso,
              a Nexa criará automaticamente um <strong>backup de segurança do estado atual</strong>. Se qualquer
              tabela falhar na validação, toda a restauração será desfeita.
            </div>

            <label style={labelConfirmacao}>
              Para confirmar, digite <strong>RESTAURAR</strong>:
            </label>
            <input
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              style={input}
              autoFocus
              disabled={restaurando}
            />

            <div style={modalActions}>
              <button
                style={cancelButton}
                onClick={() => {
                  if (restaurando) return
                  setModal(null)
                  setConfirmacao("")
                }}
                disabled={restaurando}
              >
                Cancelar
              </button>

              <button
                style={{
                  ...confirmButton,
                  opacity: confirmacao.trim().toUpperCase() === "RESTAURAR" && !restaurando ? 1 : 0.5,
                  cursor: confirmacao.trim().toUpperCase() === "RESTAURAR" && !restaurando ? "pointer" : "not-allowed",
                }}
                onClick={restaurarBackup}
                disabled={confirmacao.trim().toUpperCase() !== "RESTAURAR" || restaurando}
              >
                {restaurando ? "Restaurando e validando..." : "Confirmar restauração"}
              </button>
            </div>
          </div>
        </div>
      )}
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

const titulo = { margin: 0 }

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
  marginBottom: "12px",
}

const nota = {
  color: "#a9b8cc",
  fontSize: "13px",
  lineHeight: 1.5,
  marginBottom: "22px",
}

const button = {
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
}

const lista = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
}

const empty = { color: "#a9b8cc" }

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

const acoes = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
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

const restoreButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(255,196,87,.45)",
  background: "rgba(255,196,87,.12)",
  color: "#ffd98a",
  fontWeight: "bold",
}

const auditoriaBox = {
  marginTop: 26,
  borderTop: "1px solid rgba(255,255,255,.10)",
  paddingTop: 20,
}

const auditoriaItem = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid rgba(255,255,255,.08)",
}

const statusPill = {
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 11,
  fontWeight: 800,
}

const statusOk = {
  background: "rgba(55,255,116,.12)",
  color: "#77ff9e",
}

const statusErro = {
  background: "rgba(255,98,98,.12)",
  color: "#ff9292",
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
  padding: 20,
}

const modalBox = {
  width: "min(620px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#071a36",
  border: "1px solid rgba(255,255,255,.16)",
  boxShadow: "0 24px 80px rgba(0,0,0,.45)",
  borderRadius: 20,
  padding: 24,
  color: "white",
}

const arquivoModal = {
  color: "#a9b8cc",
  fontSize: 13,
  overflowWrap: "anywhere",
  marginBottom: 18,
}

const resumoGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
  marginBottom: 16,
}

const resumoCard = {
  background: "rgba(255,255,255,.06)",
  borderRadius: 12,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 5,
}

const label = {
  color: "#93a8c5",
  fontSize: 12,
}

const dangerBox = {
  background: "rgba(255,196,87,.09)",
  border: "1px solid rgba(255,196,87,.30)",
  color: "#ffe7b0",
  borderRadius: 12,
  padding: 14,
  lineHeight: 1.5,
  marginBottom: 18,
}

const labelConfirmacao = {
  display: "block",
  marginBottom: 8,
  color: "#d6e6ff",
}

const input = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "#03132a",
  color: "white",
  padding: "12px 13px",
  outline: "none",
  fontSize: 15,
}

const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 20,
  flexWrap: "wrap",
}

const cancelButton = {
  border: "1px solid rgba(255,255,255,.18)",
  background: "transparent",
  color: "#d6e6ff",
  borderRadius: 10,
  padding: "11px 15px",
  cursor: "pointer",
}

const confirmButton = {
  border: "none",
  background: "#d58a1f",
  color: "#111827",
  borderRadius: 10,
  padding: "11px 15px",
  fontWeight: 800,
}
