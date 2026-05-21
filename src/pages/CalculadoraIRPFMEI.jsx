import { useState } from "react"

export default function CalculadoraIRPFMEI() {
  const [atividade, setAtividade] = useState("servicos")
  const [receitaBruta, setReceitaBruta] = useState("")
  const [despesas, setDespesas] = useState("")

  const percentuais = {
    comercio: {
      label: "Comércio, Indústria e Transporte",
      percentual: 8,
    },

    transporte: {
      label: "Transporte de Passageiros",
      percentual: 16,
    },

    servicos: {
      label: "Serviços",
      percentual: 32,
    },
  }

  function moedaParaNumero(valor) {
    return Number(
      String(valor)
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    ) || 0
  }

  function formatarMoedaDigitada(valorDigitado) {
    const somenteNumeros = valorDigitado.replace(/\D/g, "")
    const numero = Number(somenteNumeros) / 100

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  const receita = moedaParaNumero(receitaBruta)
  const despesa = moedaParaNumero(despesas)

  const percentual =
    percentuais[atividade].percentual / 100

  const parcelaIsenta = receita * percentual
  const resultado = receita - parcelaIsenta
  const totalDeclarar = resultado - despesa
  
  function limpar() {
    setAtividade("servicos")
    setReceitaBruta("")
    setDespesas("")
  }
  return (
    <div style={box}>
      <h2>Calculadora IRPF MEI</h2>

      <p style={subtitulo}>
        Simulação automática para declaração IRPF do MEI
      </p>

      <div style={form}>
        <select
          style={input}
          value={atividade}
          onChange={(e) =>
            setAtividade(e.target.value)
          }
        >
          {Object.entries(percentuais).map(
            ([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            )
          )}
        </select>

        <input
          style={input}
          placeholder="Receita Bruta"
          value={receitaBruta}
          onChange={(e) =>
            setReceitaBruta(
              formatarMoedaDigitada(
                e.target.value
              )
            )
          }
        />

        <input
          style={input}
          placeholder="Despesas"
          value={despesas}
          onChange={(e) =>
            setDespesas(
              formatarMoedaDigitada(
                e.target.value
              )
            )
          }
        />
      <button
        style={button}
        onClick={limpar}
      >
        Limpar Cálculo
      </button>
      </div>

      <div style={resultadoBox}>
        <div style={card}>
          <span style={label}>
            Receita Bruta
          </span>

          <strong style={valor}>
            {formatarMoeda(receita)}
          </strong>
        </div>

        <div style={card}>
          <span style={label}>
            Parcela Isenta ({percentuais[atividade].percentual}%)
          </span>

          <strong style={valorVerde}>
            {formatarMoeda(parcelaIsenta)}
          </strong>
        </div>

        <div style={card}>
          <span style={label}>
            Lucro Tributável
          </span>

          <strong style={valorAmarelo}>
            {formatarMoeda(resultado)}
          </strong>
        </div>

        <div style={card}>
          <span style={label}>
            Valor Final para Declarar
          </span>

          <strong style={valorAzul}>
            {formatarMoeda(totalDeclarar)}
          </strong>
        </div>
      </div>
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const subtitulo = {
  color: "#a9b8cc",
  marginBottom: "25px",
}

const form = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "18px",
  marginBottom: "30px",
}

const input = {
  padding: "16px",
  borderRadius: "12px",
  border:
    "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
}

const resultadoBox = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "18px",
}

const card = {
  background: "#061f47",
  border:
    "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "24px",
}

const label = {
  display: "block",
  color: "#a9b8cc",
  marginBottom: "14px",
}

const valor = {
  color: "white",
  fontSize: "28px",
}

const valorVerde = {
  color: "#37ff74",
  fontSize: "28px",
}

const valorAmarelo = {
  color: "#ffc107",
  fontSize: "28px",
}

const valorAzul = {
  color: "#00a8ff",
  fontSize: "28px",
}
const button = {
  marginTop: "25px",
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}