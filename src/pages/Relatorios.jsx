import { useEffect, useState } from "react"
import api from "../services/api"

export default function Relatorios() {
  const [clienteSelecionado, setClienteSelecionado] =
    useState("")

  const [clientes, setClientes] = useState([])

  const [dados, setDados] = useState({
    cliente: "Todos",
    totalReceitas: 0,
    totalDespesas: 0,
    resultado: 0,
    quantidadeLancamentos: 0,
  })

  useEffect(() => {
    carregarClientes()
    carregarRelatorio()
  }, [])

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientes(resposta.data)
    } catch (error) {
      console.error(error)
    }
  }

  async function carregarRelatorio(cliente = "") {
    try {
      const url = cliente
        ? `/relatorios/dre?cliente=${encodeURIComponent(cliente)}`
        : "/relatorios/dre"

      const resposta = await api.get(url)

      setDados(resposta.data)
    } catch (error) {
      alert("Erro ao carregar relatório")
      console.error(error)
    }
  }

  function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function atualizarFiltro(cliente) {
    setClienteSelecionado(cliente)
    carregarRelatorio(cliente)
  }

  return (
    <div style={box}>
      <div style={topo}>
        <div>
          <h2>Relatórios Gerenciais</h2>

          <p style={subtitulo}>
            DRE individual por empresa
          </p>
        </div>

        <select
          style={select}
          value={clienteSelecionado}
          onChange={(e) =>
            atualizarFiltro(e.target.value)
          }
        >
          <option value="">
            Todas as empresas
          </option>

          {clientes.map((item) => (
            <option
              key={item.id}
              value={item.nome}
            >
              {item.nome}
            </option>
          ))}
        </select>
      </div>

      <div style={empresaInfo}>
        <strong>
          Empresa:
        </strong>{" "}
        {dados.cliente}
      </div>

      <div style={cards}>
        <Card
          title="Receitas"
          value={formatarMoeda(
            dados.totalReceitas
          )}
        />

        <Card
          title="Despesas"
          value={formatarMoeda(
            dados.totalDespesas
          )}
        />

        <Card
          title="Resultado"
          value={formatarMoeda(
            dados.resultado
          )}
        />

        <Card
          title="Lançamentos"
          value={dados.quantidadeLancamentos}
        />
      </div>

      <div style={painel}>
        <h3>DRE Simplificado</h3>

        <div style={linha}>
          <span>Total de Receitas</span>

          <strong style={positivo}>
            {formatarMoeda(
              dados.totalReceitas
            )}
          </strong>
        </div>

        <div style={linha}>
          <span>Total de Despesas</span>

          <strong style={negativo}>
            {formatarMoeda(
              dados.totalDespesas
            )}
          </strong>
        </div>

        <div style={divisor} />

        <div style={linha}>
          <span>Resultado Final</span>

          <strong
            style={
              dados.resultado >= 0
                ? positivo
                : negativo
            }
          >
            {formatarMoeda(
              dados.resultado
            )}
          </strong>
        </div>

        <button
          style={button}
          onClick={() =>
            carregarRelatorio(
              clienteSelecionado
            )
          }
        >
          Atualizar Relatório
        </button>
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

const empresaInfo = {
  marginBottom: "20px",
  color: "white",
  fontSize: "17px",
}

const select = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  minWidth: "260px",
}

const cards = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "18px",
  marginBottom: "30px",
}

const card = {
  background: "#061f47",
  border:
    "1px solid rgba(255,255,255,.12)",
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

const painel = {
  background: "#061f47",
  border:
    "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "24px",
  color: "white",
}

const linha = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "16px",
  fontSize: "17px",
}

const divisor = {
  height: "1px",
  background:
    "rgba(255,255,255,.15)",
  margin: "22px 0",
}

const positivo = {
  color: "#37ff74",
}

const negativo = {
  color: "#ff4d4f",
}

const button = {
  marginTop: "20px",
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}