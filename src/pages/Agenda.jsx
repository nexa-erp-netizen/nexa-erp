import { useState } from "react"

export default function Agenda() {
  const [eventos, setEventos] = useState([])

  const [titulo, setTitulo] = useState("")
  const [cliente, setCliente] = useState("")
  const [data, setData] = useState("")
  const [tipo, setTipo] = useState("")

  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()

  const diasNoMes = new Date(
    ano,
    mes + 1,
    0
  ).getDate()

  const primeiroDia = new Date(
    ano,
    mes,
    1
  ).getDay()

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

  function incluirEvento() {
    if (!titulo || !data || !tipo) {
      alert("Preencha título, data e tipo")
      return
    }

    const novoEvento = {
      id: Date.now(),
      titulo,
      cliente,
      data,
      tipo,
    }

    setEventos([...eventos, novoEvento])

    setTitulo("")
    setCliente("")
    setData("")
    setTipo("")
  }

  function eventosDoDia(dia) {
    const dataCompleta = `${ano}-${String(
      mes + 1
    ).padStart(2, "0")}-${String(dia).padStart(
      2,
      "0"
    )}`

    return eventos.filter(
      (item) => item.data === dataCompleta
    )
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
      <div style={topo}>
        <div>
          <h2>Agenda / Calendário</h2>

          <p style={subtitulo}>
            Controle de tarefas e obrigações do escritório.
          </p>
        </div>

        <button
          style={button}
          onClick={incluirEvento}
        >
          Incluir
        </button>
      </div>

      <div style={form}>
        <input
          style={input}
          placeholder="Título"
          value={titulo}
          onChange={(e) =>
            setTitulo(e.target.value)
          }
        />

        <input
          style={input}
          placeholder="Cliente"
          value={cliente}
          onChange={(e) =>
            setCliente(e.target.value)
          }
        />

        <input
          type="date"
          style={input}
          value={data}
          onChange={(e) =>
            setData(e.target.value)
          }
        />

        <select
          style={input}
          value={tipo}
          onChange={(e) =>
            setTipo(e.target.value)
          }
        >
          <option value="">
            Tipo
          </option>

          <option value="Fiscal">
            Fiscal
          </option>

          <option value="Contábil">
            Contábil
          </option>

          <option value="Reunião">
            Reunião
          </option>

          <option value="Cliente">
            Cliente
          </option>
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

      <div style={grid}>
        {calendario.map((dia, index) => (
          <div key={index} style={diaBox}>
            {dia && (
              <>
                <div style={numeroDia}>
                  {dia}
                </div>

                <div style={eventosBox}>
                  {eventosDoDia(dia).map(
                    (evento) => (
                      <div
                        key={evento.id}
                        style={eventoItem}
                        title={`${evento.cliente} - ${evento.tipo}`}
                      >
                        {evento.titulo}
                      </div>
                    )
                  )}
                </div>
              </>
            )}
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
  marginBottom: "20px",
}

const subtitulo = {
  color: "#a9b8cc",
}

const form = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginBottom: "30px",
}

const input = {
  padding: "14px",
  borderRadius: "12px",
  border:
    "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
}

const button = {
  padding: "14px 20px",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
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

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: "8px",
}

const diaBox = {
  minHeight: "120px",
  background: "#061f47",
  borderRadius: "14px",
  padding: "10px",
  border:
    "1px solid rgba(255,255,255,.08)",
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
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}