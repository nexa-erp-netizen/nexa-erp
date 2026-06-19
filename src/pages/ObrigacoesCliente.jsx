import { useEffect, useState } from "react"
import api from "../services/api"
import {
  FaCheckCircle,
  FaDownload,
  FaFileInvoiceDollar,
} from "react-icons/fa"

export default function ObrigacoesCliente() {
  const [fiscal, setFiscal] = useState([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    carregarFiscal()
  }, [])

  async function carregarFiscal() {
    setCarregando(true)

    try {
      const resposta = await api.get("/fiscal")
      setFiscal(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("ERRO PENDÊNCIAS CLIENTE:", error)
      setFiscal([])
    } finally {
      setCarregando(false)
    }
  }

  function formatarData(data) {
    if (!data) return "-"
    return new Date(data + "T00:00:00").toLocaleDateString("pt-BR")
  }

  function obterTitulo(item) {
    return item.obrigacao || item.titulo || item.descricao || "Pendência"
  }

  function estaPagoOuConcluido(item) {
    const status = String(item.status || "")
      .trim()
      .toLowerCase()

    return (
      status.includes("pago") ||
      status.includes("concluído") ||
      status.includes("concluido")
    )
  }

  function estaVencido(item) {
    if (!item.vencimento || estaPagoOuConcluido(item)) return false

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const vencimento = new Date(item.vencimento + "T00:00:00")

    return vencimento < hoje
  }

  async function obterUrlAnexo(item) {
    if (!item.anexos || item.anexos.length === 0) return ""

    const arquivo = item.anexos[0]
    const caminho = arquivo.caminho || arquivo.url || ""

    if (!caminho) return ""

    const resposta = await api.get(
      `/fiscal/anexo-url?path=${encodeURIComponent(caminho)}`
    )

    return resposta.data.url
  }

  async function baixarGuia(item) {
    try {
      const url = await obterUrlAnexo(item)

      if (!url) {
        alert("Nenhum PDF disponível para baixar.")
        return
      }

      window.open(url, "_blank")
    } catch (error) {
      console.error(error)
      alert("Erro ao baixar documento.")
    }
  }

  async function marcarPago(item) {
    const confirmar = window.confirm(
      "Confirmar que você já pagou esta pendência?"
    )

    if (!confirmar) return

    try {
      await api.patch(`/fiscal/${item.id}/marcar-pago-cliente`)
      await carregarFiscal()
    } catch (error) {
      console.error(error)
      alert("Erro ao confirmar pagamento.")
    }
  }

  function statusVisual(item) {
    if (estaPagoOuConcluido(item)) {
      return { label: "Pago", className: "green" }
    }

    if (estaVencido(item)) {
      return { label: "Vencido", className: "red" }
    }

    return { label: "Pendente", className: "yellow" }
  }

  const pendencias = fiscal
    .filter((item) => !estaPagoOuConcluido(item))
    .slice()
    .sort((a, b) =>
      String(a.vencimento || "").localeCompare(String(b.vencimento || ""))
    )

  return (
    <div className="fc-page">
      <style>{`
        .fc-page {
          color: white;
          padding: 10px;
        }

        .fc-header {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 22px;
          padding: 18px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .fc-header-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: #061f47;
          color: #3cbcff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .fc-header h2 {
          margin: 0;
          font-size: 26px;
          font-weight: 900;
          line-height: 1.1;
        }

        .fc-header p {
          margin: 4px 0 0;
          color: #c9d6e6;
          line-height: 22px;
        }

        .fc-list {
          display: grid;
          gap: 10px;
        }

        .fc-item {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 14px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
        }

        .fc-item-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          font-weight: 900;
          font-size: 16px;
        }

        .fc-meta {
          color: #c9d6e6;
          font-size: 14px;
          line-height: 22px;
        }

        .fc-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 28px;
          padding: 0 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          margin-top: 8px;
        }

        .fc-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .fc-btn {
          min-height: 40px;
          border: none;
          border-radius: 11px;
          padding: 9px 13px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          white-space: nowrap;
        }

        .fc-btn-blue {
          background: #00a8ff;
          color: white;
        }

        .fc-btn-green {
          background: linear-gradient(90deg, #00a8ff, #37ff74);
          color: #00112b;
        }

        .green { color: #32f06d !important; }
        .red { color: #ff5c70 !important; }
        .yellow { color: #ffc107 !important; }

        .fc-status.green {
          background: #37ff74;
          color: #00112b !important;
        }

        .fc-status.red {
          background: #ff4d4f;
          color: white !important;
        }

        .fc-status.yellow {
          background: #ffc107;
          color: #00112b !important;
        }

        .fc-empty {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 18px;
          color: #c9d6e6;
          line-height: 24px;
        }

        @media (max-width: 768px) {
          .fc-page { padding: 0 !important; }
          .fc-header { padding: 16px 14px !important; }
          .fc-header h2 { font-size: 24px !important; }
          .fc-item { grid-template-columns: 1fr !important; padding: 14px !important; }
          .fc-actions { justify-content: stretch !important; }
          .fc-btn { width: 100% !important; min-height: 44px !important; }
        }
      `}</style>
      <div className="fc-list">
        {carregando ? (
          <div className="fc-empty">Carregando pendências...</div>
        ) : pendencias.length === 0 ? (
          <div className="fc-empty">
            Nenhuma pendência ou guia disponível no momento.
          </div>
        ) : (
          pendencias.map((item, index) => {
            const status = statusVisual(item)

            return (
              <div className="fc-item" key={item.id || index}>
                <div>
                  <div className="fc-item-title">
                    <FaFileInvoiceDollar className="yellow" />
                    {obterTitulo(item)}
                  </div>

                  <div className="fc-meta">
                    Competência: {item.competencia || "-"}
                    <br />
                    Vence: {formatarData(item.vencimento)}
                    <br />
                    Valor: {item.valor || "R$ 0,00"}
                  </div>

                  <span className={`fc-status ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="fc-actions">
                  {item.anexos?.length > 0 && (
                    <button
                      type="button"
                      className="fc-btn fc-btn-blue"
                      onClick={() => baixarGuia(item)}
                    >
                      <FaDownload />
                      Baixar PDF
                    </button>
                  )}

                  <button
                    type="button"
                    className="fc-btn fc-btn-green"
                    onClick={() => marcarPago(item)}
                  >
                    <FaCheckCircle />
                    Já paguei
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
