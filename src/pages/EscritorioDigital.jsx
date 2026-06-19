import { useEffect, useState } from "react"
import api from "../services/api"

export default function EscritorioDigital({ setPage }) {
  const [eventos, setEventos] = useState([])
  const [titulo, setTitulo] = useState("")
  const [cliente, setCliente] = useState("")
  const [data, setData] = useState("")
  const [tipo, setTipo] = useState("")
  
  useEffect(() => {
    carregarEventos()
  }, [])

  async function carregarEventos() {
    try {
      const resposta = await api.get("/agenda")
      setEventos(resposta.data)
  } catch (error) {
    alert("Erro ao carregar agenda")
    console.error(error)
  }
}

  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()

  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const primeiroDia = new Date(ano, mes, 1).getDay()

  const nomesMeses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ]

  async function incluirEvento() {
  if (!titulo || !data || !tipo) {
    alert("Preencha título, data e tipo")
    return
  }

  const novoEvento = {
    titulo,
    cliente,
    data,
    tipo,
  }

  try {
    await api.post("/agenda", novoEvento)

    await carregarEventos()

    setTitulo("")
    setCliente("")
    setData("")
    setTipo("")
  } catch (error) {
    alert("Erro ao incluir evento")
    console.error(error)
  }
}

  async function excluirEvento(id) {
  const confirmar = window.confirm(
    "Deseja excluir este evento?"
  )

  if (!confirmar) {
    return
  }

  try {
    await api.delete(`/agenda/${id}`)

    await carregarEventos()
  } catch (error) {
    alert("Erro ao excluir evento")
    console.error(error)
  }
}

  function eventosDoDia(dia) {
    const dataCompleta = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(
      dia
    ).padStart(2, "0")}`

    return eventos.filter((item) => item.data === dataCompleta)
  }

  const calendario = []

  for (let i = 0; i < primeiroDia; i++) {
    calendario.push(null)
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    calendario.push(dia)
  }
  return (
    <div style={box}>
      <div style={gridCards}>
        <div style={card}>
          <h3>Documentos Digitais</h3>

          <p>
            Controle de contratos, guias,
            comprovantes e documentos fiscais dos clientes.
          </p>

          <div style={buttonGroup}>
            <button
              style={button}
              onClick={() => setPage("Calculadora IRPF MEI")}
            >
              Calculadora IRPF MEI
            </button>

            <button
              style={button}
              onClick={() => setPage("Documentos Digitais")}
            >
              Acessar Documentos
            </button>
          </div>
        </div>

        <div style={card}>
          <h3>Pendências e Guias</h3>

          <p>
            Agenda contábil, fiscal e trabalhista
            com vencimentos automáticos.
          </p>

          <button
            style={button}
            onClick={() => setPage("Fiscal")}
          >
            Ver Pendências
          </button>
        </div>

        <div style={card}>
          <h3>Central do Cliente</h3>

          <p>
            Área para envio de documentos,
            solicitações e acompanhamento.
          </p>

          <button
            style={button}
            onClick={() => setPage("Portal Cliente")}
          >
            Abrir Central
          </button>
        </div>
      </div>

      <div style={agendaBox}>
        <div style={agendaTopo}>
          <div>
            <h3>Agenda / Calendário</h3>

            <p style={subtitle}>
              Controle de tarefas, reuniões e agendamentos com clientes.
            </p>
          </div>

          <button style={button} onClick={incluirEvento}>
            Incluir
          </button>
        </div>

        <div style={form}>
          <input
            style={input}
            placeholder="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />

          <input
            style={input}
            placeholder="Cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />

          <input
            type="date"
            style={input}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />

          <select
            style={input}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="">Tipo</option>
            <option value="Fiscal">Fiscal</option>
            <option value="Contábil">Contábil</option>
            <option value="Reunião">Reunião</option>
            <option value="Cliente">Cliente</option>
          </select>
        </div>

        <div style={mesAtual}>
          {nomesMeses[mes]} {ano}
        </div>

        <div style={diasSemana}>
          <div>Dom</div>
          <div>Seg</div>
          <div>Ter</div>
          <div>Qua</div>
          <div>Qui</div>
          <div>Sex</div>
          <div>Sáb</div>
        </div>

        <div style={gridCalendario}>
          {calendario.map((dia, index) => (
            <div key={index} style={diaBox}>
              {dia && (
                <>
                  <div style={numeroDia}>{dia}</div>

                  <div style={eventosBox}>
                    {eventosDoDia(dia).map((evento) => (
                      <div
                        key={evento.id}
                        style={eventoItem}
                        title={`${evento.cliente} - ${evento.tipo}`}
                      >
                        <div style={eventoTexto}>
                          {evento.titulo}
                        </div>

                        <button
                          style={deleteEventoButton}
                          onClick={() => excluirEvento(evento.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
const box = {
  padding: "20px",
}

const subtitle = {
  color: "#a9b8cc",
  marginBottom: "25px",
}

const gridCards = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "20px",
  marginBottom: "28px",
}

const card = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
  color: "white",
}

const buttonGroup = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  marginTop: "20px",
}

const button = {
  padding: "14px 20px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const agendaBox = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
  color: "white",
}

const agendaTopo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
}

const form = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginBottom: "28px",
}

const input = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
}

const mesAtual = {
  textAlign: "center",
  fontSize: "28px",
  fontWeight: "bold",
  marginBottom: "20px",
}

const diasSemana = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  marginBottom: "10px",
  textAlign: "center",
  fontWeight: "bold",
  color: "#a9b8cc",
}

const gridCalendario = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: "8px",
}

const diaBox = {
  minHeight: "120px",
  background: "#061f47",
  borderRadius: "14px",
  padding: "10px",
  border: "1px solid rgba(255,255,255,.08)",
}

const numeroDia = {
  fontWeight: "bold",
  marginBottom: "10px",
}

const eventosBox = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
}

const eventoItem = {
  background: "#00a8ff",
  color: "white",
  padding: "5px 8px",
  borderRadius: "8px",
  fontSize: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "6px",
}

const eventoTexto = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
}

const deleteEventoButton = {
  background: "transparent",
  border: "none",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
  marginLeft: "8px",
}