import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import WhatsAppPreviewModal from "../components/WhatsAppPreviewModal"
import { criarPreviaWhatsAppAgenda, eventoPermiteWhatsApp } from "../services/whatsappAgendaService"
import {
  atualizarStatusPlanejamento,
  gerarPlanejamentoAnual,
  obterEventosPlanejamentoPorPeriodo,
  obterPlanejamentoAnual,
} from "../services/planejamentoAnualService"

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export default function Agenda() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [clientes, setClientes] = useState([])
  const [fiscal, setFiscal] = useState([])
  const [eventos, setEventos] = useState([])
  const [filtroCliente, setFiltroCliente] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [carregando, setCarregando] = useState(true)
  const [previaWhatsApp, setPreviaWhatsApp] = useState(null)

  const [titulo, setTitulo] = useState("")
  const [cliente, setCliente] = useState("")
  const [data, setData] = useState("")
  const [tipo, setTipo] = useState("Fiscal")

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    setEventos(obterPlanejamentoAnual(ano))
  }, [ano])

  async function carregarDados() {
    setCarregando(true)
    try {
      const [clientesResp, fiscalResp] = await Promise.allSettled([
        api.get("/clientes"),
        api.get("/fiscal"),
      ])

      const listaClientes = clientesResp.status === "fulfilled" && Array.isArray(clientesResp.value.data)
        ? clientesResp.value.data
        : []
      const listaFiscal = fiscalResp.status === "fulfilled" && Array.isArray(fiscalResp.value.data)
        ? fiscalResp.value.data
        : []

      setClientes(listaClientes)
      setFiscal(listaFiscal)
      setEventos(obterPlanejamentoAnual(ano))
    } catch (error) {
      console.error("Erro ao carregar Agenda Inteligente", error)
    } finally {
      setCarregando(false)
    }
  }

  function gerarAno() {
    const resultado = gerarPlanejamentoAnual({ clientes, fiscal, ano })
    setEventos(resultado)
    alert(`Planejamento de ${ano} gerado com ${resultado.length} ação(ões).`)
  }

  function incluirEvento() {
    if (!titulo || !data || !tipo) {
      alert("Preencha título, data e tipo")
      return
    }

    const evento = {
      id: `manual-${Date.now()}`,
      titulo,
      cliente,
      data,
      tipo,
      modulo: tipo,
      prioridade: 30,
      status: "pendente",
      origem: "manual",
    }

    const atualizados = [...obterPlanejamentoAnual(ano), evento]
      .sort((a, b) => String(a.data).localeCompare(String(b.data)))
    localStorage.setItem(`nexa_planejamento_anual_${ano}`, JSON.stringify(atualizados))
    setEventos(atualizados)
    setTitulo("")
    setCliente("")
    setData("")
    setTipo("Fiscal")
  }

  function abrirPreviaWhatsApp(evento) {
    setPreviaWhatsApp(criarPreviaWhatsAppAgenda(evento))
  }

  function marcarWhatsAppEnviado(evento) {
    if (!evento) return
    const atualizados = atualizarStatusPlanejamento(ano, evento.id, "concluido")
    setEventos(atualizados)
  }

  function alternarStatus(evento) {
    const novoStatus = evento.status === "concluido" ? "pendente" : "concluido"
    const atualizados = atualizarStatusPlanejamento(ano, evento.id, novoStatus)
    setEventos(atualizados)
  }

  const eventosFiltrados = useMemo(() => {
    return obterEventosPlanejamentoPorPeriodo({ ano, mes }).filter((item) => {
      const clienteOk = !filtroCliente || String(item.cliente || "").toLowerCase().includes(filtroCliente.toLowerCase())
      const tipoOk = !filtroTipo || item.tipo === filtroTipo
      return clienteOk && tipoOk
    })
  }, [ano, mes, eventos, filtroCliente, filtroTipo])

  const resumo = useMemo(() => {
    const total = eventos.length
    const concluidos = eventos.filter((item) => item.status === "concluido").length
    const pendentes = total - concluidos
    const parcelamentos = eventos.filter((item) => item.tipo === "Parcelamento").length
    return {
      total,
      concluidos,
      pendentes,
      parcelamentos,
      percentual: total ? Math.round((concluidos / total) * 100) : 0,
    }
  }, [eventos])

  const diasNoMes = new Date(ano, mes, 0).getDate()
  const primeiroDia = new Date(ano, mes - 1, 1).getDay()
  const calendario = [
    ...Array.from({ length: primeiroDia }, () => null),
    ...Array.from({ length: diasNoMes }, (_, index) => index + 1),
  ]

  function eventosDoDia(dia) {
    const dataCompleta = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
    return eventosFiltrados.filter((item) => item.data === dataCompleta)
  }

  return (
    <div style={box}>
      <div style={topo}>
        <div>
          <h2 style={{ margin: 0 }}>Agenda Inteligente</h2>
          <p style={subtitulo}>Planejamento anual de obrigações, honorários, recibos e parcelamentos.</p>
        </div>
        <button style={button} onClick={gerarAno}>Gerar planejamento de {ano}</button>
      </div>

      <div style={resumoGrid}>
        <Resumo label="Ações do ano" value={resumo.total} />
        <Resumo label="Concluídas" value={resumo.concluidos} />
        <Resumo label="Pendentes" value={resumo.pendentes} />
        <Resumo label="Parcelamentos" value={resumo.parcelamentos} />
      </div>

      <div style={progressoBox}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <strong>Progresso anual</strong>
          <span>{resumo.percentual}%</span>
        </div>
        <div style={barra}><div style={{ ...barraPreenchida, width: `${resumo.percentual}%` }} /></div>
      </div>

      <div style={form}>
        <select style={input} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {[ano - 1, ano, ano + 1].filter((valor, indice, arr) => arr.indexOf(valor) === indice).map((valor) => (
            <option key={valor} value={valor}>{valor}</option>
          ))}
        </select>
        <select style={input} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.map((nome, index) => <option key={nome} value={index + 1}>{nome}</option>)}
        </select>
        <input style={input} placeholder="Filtrar cliente" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} />
        <select style={input} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="Fiscal">Fiscal</option>
          <option value="Financeiro">Financeiro</option>
          <option value="Documentos">Documentos</option>
          <option value="Parcelamento">Parcelamento</option>
        </select>
      </div>

      <details style={manualBox}>
        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>Adicionar ação manual</summary>
        <div style={{ ...form, marginTop: 16, marginBottom: 0 }}>
          <input style={input} placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <input style={input} placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <input type="date" style={input} value={data} onChange={(e) => setData(e.target.value)} />
          <select style={input} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="Fiscal">Fiscal</option>
            <option value="Financeiro">Financeiro</option>
            <option value="Documentos">Documentos</option>
            <option value="Reunião">Reunião</option>
          </select>
          <button style={button} onClick={incluirEvento}>Incluir</button>
        </div>
      </details>

      <div style={mesAtual}>{MESES[mes - 1]} {ano}</div>

      {carregando ? (
        <div style={vazio}>Carregando agenda...</div>
      ) : !eventos.length ? (
        <div style={vazio}>
          Nenhum planejamento gerado para {ano}. Clique em <strong>Gerar planejamento de {ano}</strong>.
        </div>
      ) : (
        <>
          <div style={diasSemana}>
            <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
          </div>
          <div style={grid}>
            {calendario.map((dia, index) => (
              <div key={index} style={diaBox}>
                {dia && (
                  <>
                    <div style={numeroDia}>{dia}</div>
                    <div style={eventosBox}>
                      {eventosDoDia(dia).map((evento) => (
                        <div key={evento.id} style={eventoLinha}>
                          <button
                            type="button"
                            onClick={() => alternarStatus(evento)}
                            style={{
                              ...eventoItem,
                              ...(evento.status === "concluido" ? eventoConcluido : {}),
                            }}
                            title={`${evento.cliente || "Sem cliente"} • ${evento.detalhes || evento.tipo}`}
                          >
                            {evento.status === "concluido" ? "✓ " : ""}{evento.titulo}
                          </button>
                          {eventoPermiteWhatsApp(evento) && (
                            <button
                              type="button"
                              style={whatsappButton}
                              onClick={() => abrirPreviaWhatsApp(evento)}
                              title="Preparar mensagem no WhatsApp"
                            >
                              💬
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <WhatsAppPreviewModal
        previa={previaWhatsApp}
        onClose={() => setPreviaWhatsApp(null)}
        onEnviado={marcarWhatsAppEnviado}
      />
    </div>
  )
}

function Resumo({ label, value }) {
  return <div style={resumoCard}><span style={resumoLabel}>{label}</span><strong style={resumoValor}>{value}</strong></div>
}

const box = { background: "rgba(255,255,255,0.06)", borderRadius: 24, padding: 28 }
const topo = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }
const subtitulo = { color: "#a9b8cc", marginBottom: 0 }
const form = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 22 }
const input = { padding: 13, borderRadius: 12, border: "1px solid rgba(255,255,255,.15)", background: "#061f47", color: "white", minWidth: 0 }
const button = { padding: "13px 18px", borderRadius: 12, border: "none", background: "linear-gradient(90deg, #00a8ff, #37ff74)", color: "#00112b", fontWeight: "bold", cursor: "pointer" }
const resumoGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }
const resumoCard = { background: "#061f47", border: "1px solid rgba(255,255,255,.10)", borderRadius: 14, padding: 16 }
const resumoLabel = { display: "block", color: "#a9b8cc", fontSize: 12, marginBottom: 6 }
const resumoValor = { fontSize: 25 }
const progressoBox = { background: "rgba(0,168,255,.08)", border: "1px solid rgba(0,168,255,.20)", borderRadius: 14, padding: 14, marginBottom: 18 }
const barra = { height: 10, background: "rgba(255,255,255,.10)", borderRadius: 999, overflow: "hidden" }
const barraPreenchida = { height: "100%", background: "linear-gradient(90deg, #00a8ff, #37ff74)", borderRadius: 999 }
const manualBox = { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 14, padding: 14, marginBottom: 20 }
const mesAtual = { textAlign: "center", fontSize: 26, fontWeight: "bold", marginBottom: 18 }
const diasSemana = { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", marginBottom: 8, textAlign: "center", fontWeight: "bold", color: "#a9b8cc" }
const grid = { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 7 }
const diaBox = { minHeight: 125, background: "#061f47", borderRadius: 12, padding: 9, border: "1px solid rgba(255,255,255,.08)", minWidth: 0 }
const numeroDia = { fontWeight: "bold", marginBottom: 8 }
const eventosBox = { display: "flex", flexDirection: "column", gap: 5 }
const eventoLinha = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 28px", gap: 4, alignItems: "stretch" }
const eventoItem = { width: "100%", textAlign: "left", background: "#0b70b8", color: "white", padding: "5px 7px", border: "none", borderRadius: 7, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }
const eventoConcluido = { background: "rgba(55,255,116,.20)", color: "#70ff9b", textDecoration: "line-through" }
const whatsappButton = { border: "none", borderRadius: 7, background: "rgba(55,255,116,.18)", color: "#70ff9b", cursor: "pointer", fontSize: 13 }
const vazio = { padding: 24, textAlign: "center", color: "#a9b8cc", background: "rgba(255,255,255,.04)", borderRadius: 14 }
