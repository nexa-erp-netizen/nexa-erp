import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import Calendar from "react-calendar"
import "react-calendar/dist/Calendar.css"
import {
  FaUsers,
  FaClipboardList,
  FaExclamationTriangle,
  FaFileAlt,
  FaBell,
  FaSyncAlt,
  FaCalendarAlt,
  FaBolt,
} from "react-icons/fa"

const API_URL = "https://nexa-erp-api.onrender.com"

export default function Dashboard({ setPage }) {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}")

  const [clientes, setClientes] = useState([])
  const [fiscal, setFiscal] = useState([])
  const [pendencias, setPendencias] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [notificacoes, setNotificacoes] = useState(0)
  const [mostrarCalendario, setMostrarCalendario] = useState(false)
  const [dataSelecionada, setDataSelecionada] = useState(new Date())

  useEffect(() => {
    carregarDashboard()
  }, [])

  async function carregarDashboard() {
    try {
      const usuarioSalvo = JSON.parse(localStorage.getItem("usuario"))
      const token = localStorage.getItem("token") || usuarioSalvo?.token

      const [clientesResp, fiscalResp, pendenciasResp, documentosResp] =
        await Promise.all([
          api.get("/clientes"),
          api.get("/fiscal"),
          api.get("/solicitacoes-clientes"),
          api.get("/documentos-digitais"),
        ])

      setClientes(Array.isArray(clientesResp.data) ? clientesResp.data : [])
      setFiscal(Array.isArray(fiscalResp.data) ? fiscalResp.data : [])
      setPendencias(Array.isArray(pendenciasResp.data) ? pendenciasResp.data : [])
      setDocumentos(Array.isArray(documentosResp.data) ? documentosResp.data : [])

      if (token) {
        const resposta = await fetch(`${API_URL}/notificacoes/contador`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const dados = await resposta.json()
        setNotificacoes(dados.total || 0)
      }
    } catch (error) {
      alert("Erro ao carregar dashboard")
      console.error(error)
    }
  }

  function abrirDestino(item) {
  if (!item || typeof setPage !== "function") {
    console.warn("Dashboard sem setPage ou item inválido", item)
    return
  }

  const destino = item.destino

  if (destino === "Fiscal") {
    localStorage.setItem("nexaFiltroFiscalCliente", item.cliente || "")
    localStorage.setItem("nexaFiltroFiscalId", String(item.referenciaId || ""))
    setPage("Fiscal")
    return
  }

  if (destino === "Documentos Digitais") {
    localStorage.setItem("nexaFiltroDocumentoCliente", item.cliente || "")
    localStorage.setItem("nexaFiltroDocumentoId", String(item.referenciaId || ""))
    setPage("Documentos Digitais")
    return
  }

  if (destino === "Pendências Clientes") {
    localStorage.setItem("nexaFiltroPendenciaCliente", item.cliente || "")
    localStorage.setItem("nexaFiltroPendenciaId", String(item.referenciaId || ""))
    setPage("Pendências Clientes")
    return
  }

  setPage(destino)
}

  function dataLocalISO(data) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, "0")
    const dia = String(data.getDate()).padStart(2, "0")
    return `${ano}-${mes}-${dia}`
  }

  function diferencaDias(data) {
    if (!data) return null

    const hoje = new Date()
    const alvo = new Date(`${data}T00:00:00`)

    hoje.setHours(0, 0, 0, 0)

    return Math.ceil((alvo - hoje) / (1000 * 60 * 60 * 24))
  }

  function textoPrazo(dias) {
    if (dias === null) return "Sem vencimento"
    if (dias < 0) return `Atrasado há ${Math.abs(dias)} dia(s)`
    if (dias === 0) return "Vence hoje"
    if (dias === 1) return "Vence amanhã"
    return `Vence em ${dias} dias`
  }

  function corPrazo(dias) {
    if (dias === null) return "neutral"
    if (dias < 0) return "danger"
    if (dias <= 1) return "warning"
    return "blue"
  }

  function documentoPendente(item) {
    return (
      item.origem === "Cliente → Escritório" &&
      ["Recebido", "Em análise", "Entregue pelo cliente"].includes(item.status)
    )
  }

  function fiscalAguardandoPagamento(item) {
    const status = String(item.status || "").toLowerCase()

    return (
      !status.includes("pago") &&
      !status.includes("concluído") &&
      !status.includes("concluido") &&
      !status.includes("enviado")
    )
  }

  const resumo = useMemo(() => {
    const fiscalAtivo = fiscal.filter((item) => item.status !== "Concluído")

    const obrigacoesPendentes = fiscalAtivo.filter(
      (item) => item.status === "Pendente" || item.status === "Em andamento"
    ).length

    const aguardandoConferencia = fiscalAtivo.filter(
      (item) => item.status === "Pago pelo cliente"
    ).length

    const emAtraso = fiscalAtivo.filter((item) => {
      const dias = diferencaDias(item.vencimento)
      return dias !== null && dias < 0
    }).length

    const documentosPendentes = documentos.filter(documentoPendente).length

    const aguardandoAcao =
      aguardandoConferencia +
      documentosPendentes +
      pendencias.filter((item) => item.status !== "Concluída").length

    return {
      clientes: clientes.length,
      obrigacoesPendentes,
      aguardandoAcao,
      emAtraso,
      documentosPendentes,
      notificacoes,
    }
  }, [clientes, fiscal, pendencias, documentos, notificacoes])

  const prioridades = useMemo(() => {
    const lista = []

    fiscal
      .filter((item) => item.status !== "Concluído")
      .forEach((item) => {
        const dias = diferencaDias(item.vencimento)

        if (dias !== null && dias < 0) {
          lista.push({
            id: `fiscal-atrasado-${item.id}`,
            nivel: "danger",
            peso: 1,
            titulo: item.cliente,
            descricao: `${item.obrigacao || "Obrigação"} ${textoPrazo(dias).toLowerCase()}.`,
            etiqueta: "Atrasado",
            destino: "Fiscal",
            cliente: item.cliente,
            referenciaId: item.id,
          })
        } else if (dias !== null && dias <= 1) {
          lista.push({
            id: `fiscal-urgente-${item.id}`,
            nivel: "warning",
            peso: 2,
            titulo: item.cliente,
            descricao: `${item.obrigacao || "Obrigação"} ${textoPrazo(dias).toLowerCase()}.`,
            etiqueta: "Urgente",
            destino: "Fiscal",
            cliente: item.cliente,
            referenciaId: item.id,
          })
        } else if (dias !== null && dias <= 3) {
          lista.push({
            id: `fiscal-vencendo-${item.id}`,
            nivel: "blue",
            peso: 4,
            titulo: item.cliente,
            descricao: `${item.obrigacao || "Obrigação"} ${textoPrazo(dias).toLowerCase()}.`,
            etiqueta: "Vencendo",
            destino: "Fiscal",
            cliente: item.cliente,
            referenciaId: item.id,
          })
        }

        if (item.status === "Pago pelo cliente") {
          lista.push({
            id: `fiscal-pago-${item.id}`,
            nivel: "success",
            peso: 3,
            titulo: item.cliente,
            descricao: `${item.obrigacao || "Obrigação"} paga pelo cliente. Conferir e concluir.`,
            etiqueta: "Conferir",
            destino: "Fiscal",
            cliente: item.cliente,
            referenciaId: item.id,
          })
        }
      })

    pendencias
      .filter((item) => item.status !== "Concluída")
      .forEach((item) => {
        const data = item.vencimento || item.prazo
        const dias = diferencaDias(data)

        lista.push({
          id: `pendencia-${item.id}`,
          nivel: dias !== null && dias < 0 ? "danger" : "warning",
          peso: dias !== null && dias < 0 ? 1 : 5,
          titulo: item.cliente,
          descricao: `${item.titulo || item.categoria || "Pendência"} ${
            dias !== null ? textoPrazo(dias).toLowerCase() : "aguardando ação."
          }`,
          etiqueta: item.status || "Pendente",
          destino: "Pendências Clientes",
          cliente: item.cliente,
          referenciaId: item.id,
        })
      })

    documentos
      .filter(documentoPendente)
      .forEach((item) => {
        lista.push({
          id: `documento-${item.id}`,
          nivel: "blue",
          peso: 6,
          titulo: item.cliente,
          descricao: `${item.tipo || "Documento"} recebido aguardando análise.`,
          etiqueta: item.status || "Recebido",
          destino: "Documentos Digitais",
          cliente: item.cliente,
          referenciaId: item.id,
        })
      })

    return lista.sort((a, b) => a.peso - b.peso).slice(0, 8)
  }, [fiscal, pendencias, documentos])

  const atendimentoDia = useMemo(() => {
    const lista = []

    documentos
      .filter(documentoPendente)
      .forEach((item) => {
        lista.push({
          id: `atendimento-doc-${item.id}`,
          icone: "📄",
          cliente: item.cliente,
          texto: `${item.tipo || "Documento"} aguardando análise.`,
          nivel: "blue",
          destino: "Documentos Digitais",
          referenciaId: item.id,
        })
      })

    pendencias
      .filter((item) =>
        ["Respondida", "Visualizada", "Em análise"].includes(item.status)
      )
      .slice(0, 4)
      .forEach((item) => {
        lista.push({
          id: `atendimento-pend-${item.id}`,
          icone: "⚠️",
          cliente: item.cliente,
          texto:
  item.status === "Respondida"
    ? `${item.titulo || item.categoria || "Solicitação"} respondida pelo cliente.`
    : item.titulo || item.categoria || "Solicitação aguardando ação.",
          nivel: "warning",
          destino: "Pendências Clientes",
          referenciaId: item.id,
        })
      })

    return lista.slice(0, 6)
  }, [fiscal, documentos, pendencias])

  const proximosVencimentos = useMemo(() => {
    return fiscal
      .filter(fiscalAguardandoPagamento)
      .map((item) => ({
        ...item,
        dias: diferencaDias(item.vencimento),
        destino: "Fiscal",
        cliente: item.cliente,
        referenciaId: item.id,
      }))
      .filter((item) => item.dias !== null)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 7)
  }, [fiscal])

  const documentosRecebidos = useMemo(() => {
    return documentos
      .filter(documentoPendente)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6)
      .map((item) => ({
        ...item,
        destino: "Documentos Digitais",
        cliente: item.cliente,
        referenciaId: item.id,
      }))
  }, [documentos])

  const eventosCalendario = useMemo(() => {
    const eventos = {}

    function adicionar(data, evento) {
      if (!data) return

      if (!eventos[data]) {
        eventos[data] = []
      }

      eventos[data].push(evento)
    }

    fiscal.forEach((item) => {
      if (!item.vencimento) return

      const dias = diferencaDias(item.vencimento)

      adicionar(item.vencimento, {
        tipo: item.status === "Concluído" ? "success" : corPrazo(dias),
        titulo: item.cliente,
        descricao: `${item.obrigacao || "Obrigação"} - ${
          item.status === "Concluído" ? "Concluído" : textoPrazo(dias)
        }`,
        destino: "Fiscal",
        cliente: item.cliente,
        referenciaId: item.id,
      })
    })

    documentos
      .filter(documentoPendente)
      .forEach((item) => {
        const data = String(item.createdAt || "").slice(0, 10)

        adicionar(data, {
          tipo: "document",
          titulo: item.cliente,
          descricao: `${item.tipo || "Documento"} recebido`,
          destino: "Documentos Digitais",
          cliente: item.cliente,
          referenciaId: item.id,
        })
      })

    return eventos
  }, [fiscal, documentos])

  const eventosDiaSelecionado =
    eventosCalendario[dataLocalISO(dataSelecionada)] || []

  function dataExtenso() {
    return new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  }

  function nomeUsuario() {
    return usuario?.nome?.split(" ")[0] || "Fabio"
  }

  return (
    <div className="dashboard-page">
      <style>{`
        .dashboard-page { color: white; }

        .calendar-popup {
          position: absolute;
          top: 58px;
          right: 0;
          z-index: 9999;
          width: 350px;
          background: #061f47;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 18px 45px rgba(0,0,0,.35);
          padding: 14px;
        }

        .react-calendar {
          width: 100%;
          background: transparent;
          border: none;
          color: white;
          font-family: Arial, sans-serif;
        }

        .react-calendar__navigation button {
          color: white;
          background: transparent;
          font-weight: 800;
        }

        .react-calendar__month-view__weekdays {
          color: #a9b8cc;
          font-size: 11px;
        }

        .react-calendar__tile {
          background: transparent;
          color: white;
          border-radius: 10px;
          min-height: 46px;
          position: relative;
        }

        .react-calendar__tile:hover,
        .react-calendar__tile--active {
          background: rgba(0,168,255,.25) !important;
        }

        .calendar-markers {
          display: flex;
          justify-content: center;
          gap: 3px;
          margin-top: 3px;
        }

        .calendar-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .calendar-day-list {
          margin-top: 12px;
          border-top: 1px solid rgba(255,255,255,.12);
          padding-top: 12px;
          display: grid;
          gap: 8px;
        }

        .calendar-day-item {
          background: rgba(255,255,255,.06);
          border-radius: 12px;
          padding: 10px;
          font-size: 12px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,.08);
        }

        .calendar-day-item:hover {
          border-color: rgba(55,255,116,.35);
        }

        .calendar-day-item strong {
          display: block;
          margin-bottom: 4px;
        }

        .dash-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 22px;
          gap: 20px;
        }

        .dash-title {
          font-size: 30px;
          font-weight: 900;
          margin: 0 0 8px;
        }

        .dash-date {
          color: #a9b8cc;
          font-size: 15px;
          text-transform: capitalize;
        }

        .dash-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .date-arrow {
          font-size: 13px;
          color: #a9b8cc;
          margin-left: 4px;
        }

        .date-box {
          height: 44px;
          border-radius: 14px;
          background: #061f47;
          border: 1px solid rgba(255,255,255,.12);
          padding: 0 16px;
          color: white;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .refresh {
          height: 44px;
          border: none;
          border-radius: 14px;
          padding: 0 18px;
          background: linear-gradient(90deg,#00a8ff,#37ff74);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .card {
          background: #123d78;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          padding: 16px;
          min-height: 96px;
          box-shadow: 0 8px 24px rgba(0,0,0,.12);
        }

        .card-icon {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          background: #061f47;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          font-size: 16px;
        }

        .card-label {
          color: #a9b8cc;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .card-value {
          font-size: 22px;
          font-weight: 900;
        }

        .grid-main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 12px 35px rgba(0,0,0,.12);
        }

        .box-title {
          font-size: 21px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .priority-list,
        .due-list,
        .doc-list,
        .service-list {
          display: grid;
          gap: 12px;
        }

        .priority-item,
        .due-item,
        .doc-item,
        .service-item {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 16px;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
        }

        .clickable-card {
          width: 100%;
          text-align: left;
          color: white;
          cursor: pointer;
          font-family: inherit;
        }

        .clickable-card:hover {
          border-color: rgba(55,255,116,.35);
          transform: translateY(-1px);
          transition: .2s;
        }

        .item-main strong {
          display: block;
          margin-bottom: 5px;
          font-size: 15px;
        }

        .item-main span {
          color: #a9b8cc;
          font-size: 13px;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }

        .item-left {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .tag {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .danger { color: #ff4d4f; }
        .warning { color: #ffc107; }
        .success { color: #37ff74; }
        .blue { color: #00a8ff; }
        .neutral { color: #a9b8cc; }
        .document { color: #b388ff; }

        .bg-danger { background: #ff4d4f; color: white; }
        .bg-warning { background: #ffc107; color: #00112b; }
        .bg-success { background: #37ff74; color: #00112b; }
        .bg-blue { background: #00a8ff; color: white; }
        .bg-neutral { background: rgba(255,255,255,.14); color: white; }
        .bg-document { background: #b388ff; color: #00112b; }

        .empty {
          color: #a9b8cc;
          padding: 18px;
          background: #061f47;
          border-radius: 16px;
        }

        @media (max-width: 1100px) {
          .grid-main {
            grid-template-columns: 1fr;
          }

          .dash-header {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="dash-header">
        <div>
          <h1 className="dash-title">Bom dia, {nomeUsuario()}! 👋</h1>
          <div className="dash-date">{dataExtenso()}</div>
        </div>

        <div className="dash-actions">
          <div style={{ position: "relative" }}>
            <div
              className="date-box"
              title="Calendário operacional"
              onClick={() => setMostrarCalendario(!mostrarCalendario)}
            >
              <FaCalendarAlt />
              {dataSelecionada.toLocaleDateString("pt-BR")}
              <span className="date-arrow">▾</span>
            </div>

            {mostrarCalendario && (
              <div className="calendar-popup">
                <Calendar
                  onChange={(data) => setDataSelecionada(data)}
                  value={dataSelecionada}
                  tileContent={({ date, view }) => {
                    if (view !== "month") return null

                    const eventos = eventosCalendario[dataLocalISO(date)] || []

                    if (eventos.length === 0) return null

                    return (
                      <div className="calendar-markers">
                        {eventos.slice(0, 4).map((evento, index) => (
                          <span
                            key={index}
                            className={`calendar-dot bg-${evento.tipo}`}
                            title={`${evento.titulo} - ${evento.descricao}`}
                          />
                        ))}
                      </div>
                    )
                  }}
                />

                <div className="calendar-day-list">
                  {eventosDiaSelecionado.length === 0 ? (
                    <div className="calendar-day-item">
                      Nenhum evento para este dia.
                    </div>
                  ) : (
                    eventosDiaSelecionado.map((evento, index) => (
                      <button
                        type="button"
                        className="calendar-day-item"
                        key={index}
                        onClick={() => abrirDestino(evento)}
                      >
                        <strong>{evento.titulo}</strong>
                        <span>{evento.descricao}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="refresh" onClick={carregarDashboard}>
            <FaSyncAlt />
            Atualizar
          </button>
        </div>
      </div>

      <div className="cards">
        <ResumoCard icon={<FaUsers />} label="Clientes Ativos" value={resumo.clientes} color="blue" />
        <ResumoCard icon={<FaClipboardList />} label="Obrigações Pendentes" value={resumo.obrigacoesPendentes} color="warning" />
        <ResumoCard icon={<FaBolt />} label="Aguardando Ação" value={resumo.aguardandoAcao} color="warning" />
        <ResumoCard icon={<FaExclamationTriangle />} label="Em Atraso" value={resumo.emAtraso} color="danger" />
        <ResumoCard icon={<FaFileAlt />} label="Documentos Pendentes" value={resumo.documentosPendentes} color="success" />
        <ResumoCard icon={<FaBell />} label="Notificações" value={resumo.notificacoes} color="warning" />
      </div>

      <div className="grid-main">
        <section className="box">
          <div className="box-title">🚨 Prioridades do Dia</div>

          <div className="priority-list">
            {prioridades.length === 0 ? (
              <div className="empty">Nenhuma prioridade crítica no momento.</div>
            ) : (
              prioridades.map((item) => (
                <button
                  type="button"
                  className="priority-item clickable-card"
                  key={item.id}
                  onClick={() => abrirDestino(item)}
                >
                  <div className="item-left">
                    <span className={`dot bg-${item.nivel}`} />
                    <div className="item-main">
                      <strong>{item.titulo}</strong>
                      <span>{item.descricao}</span>
                    </div>
                  </div>

                  <span className={`tag bg-${item.nivel}`}>{item.etiqueta}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="box">
          <div className="box-title">⏰ Próximos Vencimentos</div>

          <div className="due-list">
            {proximosVencimentos.length === 0 ? (
              <div className="empty">Nenhum vencimento próximo.</div>
            ) : (
              proximosVencimentos.map((item) => (
                <button
                  type="button"
                  className="due-item clickable-card"
                  key={item.id}
                  onClick={() => abrirDestino(item)}
                >
                  <div className="item-main">
                    <strong>{item.cliente}</strong>
                    <span>
                      {item.obrigacao} • Competência: {item.competencia || "-"}
                    </span>
                  </div>

                  <span className={`tag bg-${corPrazo(item.dias)}`}>
                    {textoPrazo(item.dias)}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid-main">
        <section className="box">
          <div className="box-title">📞 Atendimento do Dia</div>

          <div className="service-list">
            {atendimentoDia.length === 0 ? (
              <div className="empty">Nenhum atendimento pendente no momento.</div>
            ) : (
              atendimentoDia.map((item) => (
                <button
                  type="button"
                  className="service-item clickable-card"
                  key={item.id}
                  onClick={() => abrirDestino(item)}
                >
                  <div className="item-main">
                    <strong>
                      {item.icone} {item.cliente}
                    </strong>
                    <span>{item.texto}</span>
                  </div>

                  <span className={`tag bg-${item.nivel}`}>Resolver</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="box">
          <div className="box-title">📄 Documentos Recebidos</div>

          <div className="doc-list">
            {documentosRecebidos.length === 0 ? (
              <div className="empty">Nenhum documento recebido aguardando tratamento.</div>
            ) : (
              documentosRecebidos.map((item) => (
                <button
                  type="button"
                  className="doc-item clickable-card"
                  key={item.id}
                  onClick={() => abrirDestino(item)}
                >
                  <div className="item-main">
                    <strong>{item.cliente}</strong>
                    <span>
                      {item.tipo} •{" "}
                      {item.anoCalendario || item.competencia || "Sem competência"}
                    </span>
                  </div>

                  <span className="tag bg-blue">{item.status || "Recebido"}</span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ResumoCard({ icon, label, value, color }) {
  return (
    <div className="card">
      <div className={`card-icon ${color}`}>{icon}</div>
      <div className="card-label">{label}</div>
      <div className={`card-value ${color}`}>{value}</div>
    </div>
  )
}