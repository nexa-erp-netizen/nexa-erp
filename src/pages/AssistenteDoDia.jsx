import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import {
  montarFilaAssistenteDia,
  montarResumoAssistenteDia,
} from "../services/assistenteDiaService"

export default function AssistenteDoDia({ setPage }) {
  const [clientes, setClientes] = useState([])
  const [fiscal, setFiscal] = useState([])
  const [pendencias, setPendencias] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [financeiro, setFinanceiro] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    setCarregando(true)

    try {
      const [clientesResp, fiscalResp, pendenciasResp, documentosResp, financeiroResp] =
        await Promise.allSettled([
          api.get("/clientes"),
          api.get("/fiscal"),
          api.get("/solicitacoes-clientes"),
          api.get("/documentos-digitais"),
          api.get("/financeiro"),
        ])

      setClientes(resultadoArray(clientesResp))
      setFiscal(resultadoArray(fiscalResp))
      setPendencias(resultadoArray(pendenciasResp))
      setDocumentos(resultadoArray(documentosResp))
      setFinanceiro(resultadoArray(financeiroResp))
    } catch (error) {
      console.error("Erro ao carregar Assistente do Dia", error)
      alert("Erro ao carregar Assistente do Dia")
    } finally {
      setCarregando(false)
    }
  }

  function resultadoArray(resultado) {
    if (resultado.status !== "fulfilled") return []
    return Array.isArray(resultado.value.data) ? resultado.value.data : []
  }

  const fila = useMemo(() => {
    return montarFilaAssistenteDia({
      clientes,
      fiscal,
      pendencias,
      documentos,
      financeiro,
    })
  }, [clientes, fiscal, pendencias, documentos, financeiro])

  const resumo = useMemo(() => montarResumoAssistenteDia(fila), [fila])

  function abrirDestino(acao) {
    if (!acao || typeof setPage !== "function") return

    if (acao.destino === "Fiscal") {
      localStorage.setItem("nexaFiltroFiscalCliente", acao.cliente || "")
      localStorage.setItem("nexaFiltroFiscalId", String(acao.referenciaId || ""))
    }

    if (acao.destino === "Documentos Digitais") {
      localStorage.setItem("nexaFiltroDocumentoCliente", acao.cliente || "")
      localStorage.setItem("nexaFiltroDocumentoId", String(acao.referenciaId || ""))
    }

    if (acao.destino === "Pendências Clientes") {
      localStorage.setItem("nexaFiltroPendenciaCliente", acao.cliente || "")
      localStorage.setItem("nexaFiltroPendenciaId", String(acao.referenciaId || ""))
    }

    setPage(acao.destino || "Dashboard")
  }

  function nivelTexto(nivel) {
    if (nivel === "urgente") return "🔴 Prioridade Alta"
    if (nivel === "atencao") return "🟡 Atenção"
    return "🟢 Programado"
  }

  return (
    <div className="assistente-dia-page">
      <style>{`
        .assistente-dia-page { color: white; }
        .hero-dia {
          background: linear-gradient(135deg, rgba(0,168,255,.18), rgba(55,255,116,.11));
          border: 1px solid rgba(55,255,116,.24);
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 22px;
        }
        .hero-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          flex-wrap: wrap;
        }
        .title { margin: 0; font-size: 31px; font-weight: 900; }
        .subtitle { color: #a9b8cc; margin: 8px 0 0; line-height: 1.45; }
        .refresh-dia {
          border: none;
          border-radius: 14px;
          padding: 12px 18px;
          background: linear-gradient(90deg, #00a8ff, #37ff74);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
        }
        .resumo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          margin-top: 20px;
        }
        .resumo-card {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 16px;
          padding: 16px;
        }
        .resumo-label { color: #a9b8cc; font-size: 12px; margin-bottom: 7px; }
        .resumo-value { font-size: 25px; font-weight: 900; }
        .bar-wrap {
          background: #061f47;
          border-radius: 999px;
          overflow: hidden;
          height: 11px;
          margin-top: 18px;
        }
        .bar { height: 100%; background: linear-gradient(90deg, #00a8ff, #37ff74); }
        .fila { display: grid; gap: 18px; }
        .cliente-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 22px;
          padding: 22px;
        }
        .cliente-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .cliente-pos { color: #a9b8cc; font-size: 13px; margin-bottom: 6px; }
        .cliente-nome { font-size: 25px; font-weight: 900; margin: 0 0 8px; }
        .nivel { font-weight: 900; }
        .indice { color: #37ff74; font-weight: 900; margin-left: 6px; }
        .btn-atender {
          border: none;
          border-radius: 14px;
          padding: 12px 18px;
          background: linear-gradient(90deg, #00a8ff, #37ff74);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
        }
        .motivos {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 14px;
        }
        .motivos strong, .acoes-title { display: block; margin-bottom: 10px; }
        .motivos ul { margin: 0; padding-left: 18px; color: #dce8f8; line-height: 1.8; }
        .acoes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 12px;
        }
        .acao-card {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 16px;
          padding: 14px;
          color: white;
          text-align: left;
          cursor: pointer;
          min-height: 116px;
        }
        .acao-card:hover { border-color: rgba(55,255,116,.35); transform: translateY(-1px); transition: .2s; }
        .acao-modulo { color: #37ff74; font-weight: 900; font-size: 12px; margin-bottom: 8px; }
        .acao-titulo { font-weight: 900; margin-bottom: 6px; }
        .acao-desc { color: #a9b8cc; font-size: 12px; line-height: 1.35; }
        .empty {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          padding: 22px;
          color: #a9b8cc;
        }
      `}</style>

      <section className="hero-dia">
        <div className="hero-top">
          <div>
            <h1 className="title">☀️ Assistente do Dia</h1>
            <p className="subtitle">
              Fila operacional montada com dados reais do Fiscal, Financeiro, Documentos e Atendimento.
            </p>
          </div>

          <button type="button" className="refresh-dia" onClick={carregarDados}>
            Atualizar fila
          </button>
        </div>

        <div className="bar-wrap">
          <div className="bar" style={{ width: `${resumo.progresso}%` }} />
        </div>

        <div className="resumo-grid">
          <Resumo label="Clientes na fila" value={resumo.clientes} />
          <Resumo label="Urgentes" value={resumo.urgentes} danger />
          <Resumo label="Atenção" value={resumo.atencao} warning />
          <Resumo label="Programados" value={resumo.programados} success />
          <Resumo label="Ações" value={resumo.acoes} blue />
        </div>
      </section>

      {carregando ? (
        <div className="empty">Carregando fila do dia...</div>
      ) : fila.length === 0 ? (
        <div className="empty">Nenhuma ação real encontrada para hoje. O escritório está sem pendências críticas no momento.</div>
      ) : (
        <div className="fila">
          {fila.map((cliente, index) => (
            <section className="cliente-card" key={cliente.id || cliente.cliente}>
              <div className="cliente-top">
                <div>
                  <div className="cliente-pos">Cliente {index + 1} de {fila.length}</div>
                  <h2 className="cliente-nome">{cliente.cliente}</h2>
                  <div className="nivel">
                    {nivelTexto(cliente.nivel)}
                    <span className="indice">• Índice {cliente.prioridade}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-atender"
                  onClick={() => abrirDestino(cliente.acoes[0])}
                >
                  Iniciar atendimento
                </button>
              </div>

              <div className="motivos">
                <strong>Motivos</strong>
                <ul>
                  {cliente.motivos.map((motivo) => (
                    <li key={motivo}>{motivo}</li>
                  ))}
                </ul>
              </div>

              <strong className="acoes-title">Ações reais previstas</strong>
              <div className="acoes-grid">
                {cliente.acoes.map((acao) => (
                  <button
                    type="button"
                    className="acao-card"
                    key={acao.id}
                    onClick={() => abrirDestino(acao)}
                    title="Abrir módulo relacionado"
                  >
                    <div className="acao-modulo">{acao.modulo}</div>
                    <div className="acao-titulo">{acao.titulo}</div>
                    <div className="acao-desc">{acao.descricao}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Resumo({ label, value, danger, warning, success, blue }) {
  const color = danger ? "#ff4d4f" : warning ? "#ffc107" : success ? "#37ff74" : blue ? "#00a8ff" : "white"

  return (
    <div className="resumo-card">
      <div className="resumo-label">{label}</div>
      <div className="resumo-value" style={{ color }}>{value}</div>
    </div>
  )
}
