import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { FaCheckCircle, FaDownload, FaFileAlt } from "react-icons/fa"

export default function DeclaracoesCliente() {
  const [declaracoes, setDeclaracoes] = useState([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    carregarDeclaracoes()
  }, [])

  async function carregarDeclaracoes() {
    setCarregando(true)

    try {
      const resposta = await api.get("/declaracoes")
      setDeclaracoes(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("Erro ao carregar declarações:", error)
      setDeclaracoes([])
    } finally {
      setCarregando(false)
    }
  }

  function formatarData(data) {
    if (!data) return "-"
    return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR")
  }

  function statusVisual(status) {
    const texto = String(status || "Pendente").toLowerCase()

    if (texto.includes("conclu") || texto.includes("entregue")) {
      return { label: "Concluída", className: "green" }
    }

    if (texto.includes("documentos enviados")) {
      return { label: "Enviado ao escritório", className: "blue" }
    }

    if (texto.includes("análise") || texto.includes("analise")) {
      return { label: "Em análise", className: "blue" }
    }

    return { label: status || "Pendente", className: "yellow" }
  }

  async function obterUrlAnexo(item) {
    if (!item.anexos || item.anexos.length === 0) return ""

    const arquivo = item.anexos[0]
    const caminho = arquivo.caminho || arquivo.url || ""

    if (!caminho) return ""

    const resposta = await api.get(
      `/declaracoes/anexo-url?path=${encodeURIComponent(caminho)}`
    )

    return resposta.data.url
  }

  async function baixarDeclaracao(item) {
    try {
      const url = await obterUrlAnexo(item)

      if (!url) {
        alert("Nenhum documento disponível para baixar.")
        return
      }

      window.open(url, "_blank")
    } catch (error) {
      console.error(error)
      alert("Erro ao baixar documento.")
    }
  }

  async function marcarDocumentosEnviados(item) {
    if (!window.confirm("Confirmar que os documentos foram enviados ao escritório?")) return

    try {
      await api.patch(`/declaracoes/${item.id}/documentos-enviados`)
      await carregarDeclaracoes()
    } catch (error) {
      console.error(error)
      alert("Erro ao confirmar envio dos documentos.")
    }
  }

  function podeEnviarDocumentos(item) {
    const status = String(item.status || "").toLowerCase()

    return (
      !status.includes("conclu") &&
      !status.includes("documentos enviados") &&
      !status.includes("entregue")
    )
  }

  const lista = useMemo(() => {
    return declaracoes
      .slice()
      .sort((a, b) => String(b.ano || "").localeCompare(String(a.ano || "")))
  }, [declaracoes])

  return (
    <div className="dc-page">
      <style>{`
        .dc-page { color: white; padding: 10px; }
        .dc-header {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 22px;
          padding: 18px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .dc-icon {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: 14px;
          background: #061f47;
          color: #3cbcff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .dc-header h2 { margin: 0; font-size: 26px; font-weight: 900; }
        .dc-list { display: grid; gap: 10px; }
        .dc-item {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 14px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
        }
        .dc-title { font-size: 16px; font-weight: 900; margin-bottom: 7px; display: flex; gap: 8px; align-items: center; }
        .dc-meta { color: #c9d6e6; font-size: 14px; line-height: 22px; }
        .dc-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          margin-top: 8px;
        }
        .dc-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
        .dc-btn {
          min-height: 40px;
          border: none;
          border-radius: 11px;
          padding: 9px 13px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }
        .dc-btn-blue { background: #00a8ff; color: white; }
        .dc-btn-green { background: linear-gradient(90deg,#00a8ff,#37ff74); color: #00112b; }
        .dc-status.green { background: #37ff74; color: #00112b; }
        .dc-status.blue { background: #00a8ff; color: white; }
        .dc-status.yellow { background: #ffc107; color: #00112b; }
        .yellow-text { color: #ffc107; }
        .dc-empty { background: rgba(255,255,255,.06); border-radius: 18px; padding: 18px; color: #c9d6e6; }
        @media (max-width: 768px) {
          .dc-page { padding: 0 !important; }
          .dc-item { grid-template-columns: 1fr !important; }
          .dc-actions { justify-content: stretch !important; }
          .dc-btn { width: 100%; justify-content: center; }
        }
      `}</style>

      <section className="dc-header">
        <div className="dc-icon"><FaFileAlt /></div>
        <h2>Declarações</h2>
      </section>

      <div className="dc-list">
        {carregando ? (
          <div className="dc-empty">Carregando declarações...</div>
        ) : lista.length === 0 ? (
          <div className="dc-empty">Nenhuma declaração disponível no momento.</div>
        ) : (
          lista.map((item) => {
            const status = statusVisual(item.status)

            return (
              <div className="dc-item" key={item.id}>
                <div>
                  <div className="dc-title"><FaFileAlt className="yellow-text" /> {item.tipo} {item.ano}</div>
                  <div className="dc-meta">
                    Vencimento: {formatarData(item.vencimento)}
                    <br />
                    {item.observacao || "Acompanhe a situação da sua declaração pelo portal."}
                  </div>
                  <span className={`dc-status ${status.className}`}>{status.label}</span>
                </div>

                <div className="dc-actions">
                  {item.anexos?.length > 0 && (
                    <button type="button" className="dc-btn dc-btn-blue" onClick={() => baixarDeclaracao(item)}>
                      <FaDownload /> Baixar
                    </button>
                  )}

                  {podeEnviarDocumentos(item) && (
                    <button type="button" className="dc-btn dc-btn-green" onClick={() => marcarDocumentosEnviados(item)}>
                      <FaCheckCircle /> Já enviei documentos
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
