import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { FaClipboardList, FaEye } from "react-icons/fa"

export default function PendenciasCliente() {
  const [pendencias, setPendencias] = useState([])
  const [detalhe, setDetalhe] = useState(null)
  const [resposta, setResposta] = useState("")

  useEffect(() => {
    carregarPendencias()
  }, [])

  async function carregarPendencias() {
    try {
      const respostaApi = await api.get("/solicitacoes-clientes")
      setPendencias(Array.isArray(respostaApi.data) ? respostaApi.data : [])
    } catch (error) {
      console.error("Erro ao carregar pendências:", error)
      setPendencias([])
    }
  }

  async function visualizarPendencia(item) {
    try {
      let itemAtualizado = item

      if (item.status === "Pendente" || item.status === "Aberta") {
        const respostaApi = await api.put(
          `/solicitacoes-clientes/${item.id}`,
          {
            ...item,
            status: "Visualizada",
          }
        )

        itemAtualizado = respostaApi.data
        await carregarPendencias()
      }

      setDetalhe(itemAtualizado)
      setResposta(itemAtualizado.respostaCliente || "")
    } catch (error) {
      console.error(error)
      setDetalhe(item)
    }
  }

    async function enviarResposta() {
    if (!detalhe) return

    if (!resposta.trim()) {
      alert("Digite uma mensagem antes de enviar.")
      return
    }

    try {
      await api.put(`/solicitacoes-clientes/${detalhe.id}`, {
        ...detalhe,
        respostaCliente: resposta,
        dataResposta: new Date(),
        status: "Respondida",
      })

      alert("Mensagem enviada com sucesso.")

      setDetalhe(null)
      setResposta("")

      await carregarPendencias()
    } catch (error) {
      console.error(error)
      alert("Erro ao enviar mensagem.")
    }
  }

  function formatarData(data) {
    if (!data) return "-"
    return new Date(data).toLocaleDateString("pt-BR")
  }

  const resumo = useMemo(() => {
    return {
      abertas: pendencias.filter((p) => p.status !== "Concluída").length,
      analise: pendencias.filter((p) => p.status === "Em análise").length,
      concluidas: pendencias.filter((p) => p.status === "Concluída").length,
      total: pendencias.length,
    }
  }, [pendencias])

  return (
    <div className="pcp-page">
      <style>{`
        .pcp-page { padding: 30px; color: white; }

        .pcp-title {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .pcp-subtitle {
          opacity: .8;
          margin-bottom: 25px;
        }

        .pcp-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }

        .pcp-box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 18px;
        }

        .pcp-box span {
          display: block;
          opacity: .7;
          margin-bottom: 8px;
        }

        .pcp-box strong { font-size: 20px; }

        .yellow { color: #ffc107; }
        .blue { color: #3cbcff; }
        .green { color: #32f06d; }

        .pcp-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .pcp-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          padding: 20px;
        }

        .pcp-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .pcp-icon {
          color: #ffc107;
          font-size: 22px;
        }

        .pcp-categoria {
          opacity: .7;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .pcp-card h3 {
          margin: 0 0 12px;
          font-size: 18px;
        }

        .pcp-status {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .status-pendente {
          background: rgba(255,193,7,.15);
          color: #ffc107;
        }

        .status-analise {
          background: rgba(60,188,255,.15);
          color: #3cbcff;
        }

        .status-visualizada {
          background: rgba(120,120,255,.15);
          color: #8fa8ff;
        }

        .status-respondida {
          background: rgba(170,100,255,.15);
          color: #c38cff;
        }

        .status-concluida {
          background: rgba(50,240,109,.15);
          color: #32f06d;
        }

        .pcp-situacao {
          width: 100%;
          height: 42px;
          margin: 5px 0 14px;
          background: #061f47;
          border: 1px solid rgba(255,255,255,.14);
          color: white;
          border-radius: 12px;
          padding: 0 12px;
          font-weight: 800;
          outline: none;
        }

        .pcp-situacao option {
          background: #061f47;
          color: white;
        }

        .pcp-data {
          opacity: .7;
          font-size: 13px;
          margin-bottom: 14px;
        }

        .pcp-btn {
          border: none;
          border-radius: 12px;
          padding: 11px 14px;
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .pcp-empty {
          background: rgba(255,255,255,.06);
          border-radius: 20px;
          padding: 30px;
          opacity: .75;
        }

        .modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }

        .modal {
          width: 100%;
          max-width: 560px;
          background: #061f47;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 22px;
          padding: 26px;
          color: white;
        }

        .modal h2 { margin-top: 0; }

        .modal p {
          line-height: 26px;
          color: #c9d6e6;
        }

        .resposta-textarea {
          width: 100%;
          min-height: 100px;
          border-radius: 12px;
          background: #082b5d;
          border: 1px solid rgba(255,255,255,.12);
          color: white;
          padding: 12px;
          margin-top: 10px;
          margin-bottom: 15px;
          resize: vertical;
          box-sizing: border-box;
        }

        .modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 18px;
        }

        .modal-close,
        .modal-send {
          height: 48px;
          border: none;
          border-radius: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .modal-close {
          background: #0b2855;
          color: white;
          border: 1px solid rgba(255,255,255,.15);
        }

        .modal-send {
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          color: #00112b;
        }
      `}</style>

      <div className="pcp-title">Solicitações</div>

      <div className="pcp-subtitle">
        Comunicação entre sua empresa e o escritório
      </div>

      <div className="pcp-summary">
        <div className="pcp-box">
          <span>Abertas</span>
          <strong className="yellow">{resumo.abertas}</strong>
        </div>

        <div className="pcp-box">
          <span>Em análise</span>
          <strong className="blue">{resumo.analise}</strong>
        </div>

        <div className="pcp-box">
          <span>Concluídas</span>
          <strong className="green">{resumo.concluidas}</strong>
        </div>

        <div className="pcp-box">
          <span>Total</span>
          <strong>{resumo.total}</strong>
        </div>
      </div>

      <div className="pcp-list">
        {pendencias.map((item) => (
          <div key={item.id} className="pcp-card">
            <div className="pcp-card-top">
              <div className="pcp-categoria">{item.categoria}</div>
              <FaClipboardList className="pcp-icon" />
            </div>

            <h3>{item.titulo}</h3>

            <span
              className={
                item.status === "Concluída"
                  ? "pcp-status status-concluida"
                  : item.status === "Em análise"
                  ? "pcp-status status-analise"
                  : item.status === "Respondida"
                  ? "pcp-status status-respondida"
                  : item.status === "Visualizada"
                  ? "pcp-status status-visualizada"
                  : "pcp-status status-pendente"
              }
            >
              {item.status}
            </span>

            <div className="pcp-data">
              Criado em: {formatarData(item.createdAt)}
            </div>

            <button
              className="pcp-btn"
              onClick={() => visualizarPendencia(item)}
            >
              <FaEye />
              Ver detalhes
            </button>
          </div>
        ))}

        {pendencias.length === 0 && (
          <div className="pcp-empty">
            Nenhuma pendência encontrada.
          </div>
        )}
      </div>

      {detalhe && (
        <div className="modal-bg">
          <div className="modal">
            <h2>{detalhe.titulo}</h2>

            <p>
              <strong>Categoria:</strong> {detalhe.categoria}
            </p>

            <p>
              <strong>Status:</strong> {detalhe.status}
            </p>

            <p>
              <strong>Mensagem:</strong>
              <br />
              {detalhe.mensagem || "Sem detalhes informados."}
            </p>

            <hr />

            <textarea
              className="resposta-textarea"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Digite uma mensagem para o escritório..."
            />

            <div className="modal-actions">
              <button
                className="modal-close"
                onClick={() => setDetalhe(null)}
              >
                Fechar
              </button>

              <button
                className="modal-send"
                onClick={enviarResposta}
              >
                Enviar Mensagem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}