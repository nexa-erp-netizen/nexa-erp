import { useEffect, useState } from "react"
import api from "../services/api"

export default function Dashboard() {
  const [dados, setDados] = useState({
    totalClientes: 0,

    totalReceber: 0,
    totalPagar: 0,
    saldo: 0,

    obrigacoesPendentes: 0,
    obrigacoesAtrasadas: 0,

    ultimasObrigacoes: [],

    resumoPorCliente: [],
  })

  useEffect(() => {
    carregarDashboard()
  }, [])

  async function carregarDashboard() {
    try {
      const resposta = await api.get("/dashboard")

      setDados(resposta.data)
    } catch (error) {
      alert("Erro ao carregar dashboard")
      console.error(error)
    }
  }

  function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  return (
    <div style={box}>
      <div style={topo}>
        <div>
          <h2>Dashboard Executivo</h2>

          <p style={subtitulo}>
            Painel gerencial do escritório contábil
          </p>
        </div>

        <button
          style={button}
          onClick={carregarDashboard}
        >
          Atualizar Dados
        </button>
      </div>

      <div style={cards}>
        <Card
          title="Clientes"
          value={dados.totalClientes}
        />

        <Card
          title="A Receber"
          value={formatarMoeda(dados.totalReceber)}
        />

        <Card
          title="A Pagar"
          value={formatarMoeda(dados.totalPagar)}
        />

        <Card
          title="Saldo Escritório"
          value={formatarMoeda(dados.saldo)}
        />

        <Card
          title="Pendências"
          value={dados.obrigacoesPendentes}
        />

        <Card
          title="Atrasadas"
          value={dados.obrigacoesAtrasadas}
        />
      </div>

      <div style={grid}>
        <div style={painel}>
          <h3>Resultado por Empresa</h3>

          {dados.resumoPorCliente.length === 0 && (
            <p>Nenhum lançamento encontrado.</p>
          )}

          {dados.resumoPorCliente.map((item, index) => (
            <div key={index} style={empresaBox}>
              <div style={empresaTopo}>
                <strong style={empresaNome}>
                  {item.cliente}
                </strong>

                <span style={badge}>
                  {item.lancamentos} lançamentos
                </span>
              </div>

              <div style={linha}>
                <span>Receitas</span>

                <strong style={positivo}>
                  {formatarMoeda(item.receitas)}
                </strong>
              </div>

              <div style={linha}>
                <span>Despesas</span>

                <strong style={negativo}>
                  {formatarMoeda(item.despesas)}
                </strong>
              </div>

              <div style={linha}>
                <span>Resultado</span>

                <strong
                  style={
                    item.resultado >= 0
                      ? positivo
                      : negativo
                  }
                >
                  {formatarMoeda(item.resultado)}
                </strong>
              </div>
            </div>
          ))}
        </div>

        <div style={painel}>
          <h3>Últimas Obrigações</h3>

          {dados.ultimasObrigacoes.length === 0 && (
            <p>Nenhuma obrigação pendente.</p>
          )}

          {dados.ultimasObrigacoes.map((item) => (
            <div key={item.id} style={obrigacao}>
              <strong style={empresaNome}>
                {item.cliente}
              </strong>

              <span>
                {item.obrigacao}
              </span>

              <small>
                Competência: {item.competencia}
              </small>

              <small>
                Vencimento: {item.vencimento}
              </small>

              <small
                style={
                  item.status === "Atrasado"
                    ? danger
                    : warning
                }
              >
                {item.status}
              </small>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Card({ title, value }) {
  return (
    <div style={card}>
      <span style={cardTitle}>
        {title}
      </span>

      <strong style={cardValue}>
        {value}
      </strong>
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
  marginBottom: "25px",
}

const subtitulo = {
  color: "#a9b8cc",
  marginTop: "6px",
}

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "18px",
  marginBottom: "30px",
}

const card = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "22px",
}

const cardTitle = {
  display: "block",
  color: "#a9b8cc",
  marginBottom: "12px",
}

const cardValue = {
  color: "white",
  fontSize: "28px",
}

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px",
}

const painel = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "24px",
  color: "white",
}

const empresaBox = {
  background: "rgba(255,255,255,.05)",
  borderRadius: "14px",
  padding: "18px",
  marginTop: "18px",
}

const empresaTopo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "14px",
}

const empresaNome = {
  fontSize: "17px",
}

const badge = {
  background: "#00a8ff",
  color: "white",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
}

const linha = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "12px",
}

const obrigacao = {
  background: "rgba(255,255,255,.05)",
  borderRadius: "14px",
  padding: "18px",
  marginTop: "18px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
}

const positivo = {
  color: "#37ff74",
}

const negativo = {
  color: "#ff4d4f",
}

const warning = {
  color: "#ffc107",
}

const danger = {
  color: "#ff4d4f",
}

const button = {
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}