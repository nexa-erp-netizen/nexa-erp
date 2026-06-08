import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function DRE() {
  const [movimentos, setMovimentos] = useState([])
  const [empresaSelecionada, setEmpresaSelecionada] = useState("Todas")
  const [competenciaSelecionada, setCompetenciaSelecionada] =
    useState("Todas")

  useEffect(() => {
    carregarMovimentos()
  }, [])

  async function carregarMovimentos() {
    try {
      const resposta = await api.get("/movimentos-cliente")
      setMovimentos(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      alert("Erro ao carregar DRE")
      console.error(error)
    }
  }

  function valorSeguro(valor) {
    if (valor === null || valor === undefined || valor === "") return 0

    let texto = String(valor)
      .replace("R$", "")
      .trim()

    if (texto.includes(",")) {
      texto = texto.replace(/\./g, "").replace(",", ".")
    }

    const numero = Number(texto)
    return Number.isFinite(numero) ? numero : 0
  }

  function formatarMoeda(valor) {
    return valorSeguro(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function obterCompetencia(data) {
    if (!data) return "Sem data"

    const d = new Date(data + "T00:00:00")

    return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
  }

  function agruparPorPlano(lista) {
    return lista.reduce((acc, item) => {
      const nomePlano =
        item.planoContaNome ||
        item.planoConta ||
        "Sem plano de contas"

      if (!acc[nomePlano]) {
        acc[nomePlano] = 0
      }

      acc[nomePlano] += valorSeguro(item.valor)

      return acc
    }, {})
  }

  const empresas = useMemo(() => {
    return [
      "Todas",
      ...new Set(
        movimentos
          .map((item) => item.cliente)
          .filter(Boolean)
      ),
    ]
  }, [movimentos])

  const competencias = useMemo(() => {
    return [
      "Todas",
      ...new Set(
        movimentos
          .filter((item) => item.data)
          .map((item) => obterCompetencia(item.data))
      ),
    ]
  }, [movimentos])

  const movimentosFiltrados = useMemo(() => {
    return movimentos.filter((item) => {
      const empresaOk =
        empresaSelecionada === "Todas" ||
        item.cliente === empresaSelecionada

      const competenciaOk =
        competenciaSelecionada === "Todas" ||
        obterCompetencia(item.data) === competenciaSelecionada

      return empresaOk && competenciaOk
    })
  }, [movimentos, empresaSelecionada, competenciaSelecionada])

  const dados = useMemo(() => {
    const receitasLista = movimentosFiltrados.filter(
      (item) => item.tipo === "Receita"
    )

    const despesasLista = movimentosFiltrados.filter(
      (item) => item.tipo === "Despesa"
    )

    const receitas = receitasLista.reduce(
      (total, item) => total + valorSeguro(item.valor),
      0
    )

    const despesas = despesasLista.reduce(
      (total, item) => total + valorSeguro(item.valor),
      0
    )

    return {
      receitas,
      despesas,
      resultado: receitas - despesas,
      totalLancamentos: movimentosFiltrados.length,
      receitasPorPlano: agruparPorPlano(receitasLista),
      despesasPorPlano: agruparPorPlano(despesasLista),
    }
  }, [movimentosFiltrados])

  const margemLucro =
    dados.receitas > 0
      ? (dados.resultado / dados.receitas) * 100
      : 0

  return (
    <div style={box}>
      <div style={topo}>
        <div>
          <h2>DRE Gerencial</h2>

          <p style={subtitle}>
            Demonstrativo gerencial por empresa, competência e plano de contas.
          </p>
        </div>

        <div style={filtros}>
          <div style={filtroBox}>
            <label style={label}>Empresa</label>

            <select
              style={input}
              value={empresaSelecionada}
              onChange={(e) =>
                setEmpresaSelecionada(e.target.value)
              }
            >
              {empresas.map((empresa) => (
                <option key={empresa} value={empresa}>
                  {empresa}
                </option>
              ))}
            </select>
          </div>

          <div style={filtroBox}>
            <label style={label}>Competência</label>

            <select
              style={input}
              value={competenciaSelecionada}
              onChange={(e) =>
                setCompetenciaSelecionada(e.target.value)
              }
            >
              {competencias.map((competencia) => (
                <option key={competencia} value={competencia}>
                  {competencia}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={empresaTitulo}>
        {empresaSelecionada === "Todas"
          ? "Todas as Empresas"
          : `Empresa: ${empresaSelecionada}`}
        {" | "}
        {competenciaSelecionada === "Todas"
          ? "Todas as Competências"
          : `Competência: ${competenciaSelecionada}`}
      </div>

      <div style={cards}>
        <Card
          title="Receitas"
          value={formatarMoeda(dados.receitas)}
          color="#37ff74"
        />

        <Card
          title="Despesas"
          value={formatarMoeda(dados.despesas)}
          color="#ff4d4f"
        />

        <Card
          title="Resultado"
          value={formatarMoeda(dados.resultado)}
          color={dados.resultado >= 0 ? "#37ff74" : "#ff4d4f"}
        />

        <Card
          title="Margem"
          value={`${margemLucro.toFixed(2)}%`}
          color="white"
        />

        <Card
          title="Lançamentos"
          value={dados.totalLancamentos}
          color="#3cbcff"
        />
      </div>

      <div style={dreBox}>
        <h3 style={sectionTitle}>Receitas por Plano de Contas</h3>

        {Object.keys(dados.receitasPorPlano).length === 0 ? (
          <p style={empty}>Nenhuma receita encontrada.</p>
        ) : (
          Object.entries(dados.receitasPorPlano).map(([plano, valor]) => (
            <Linha
              key={plano}
              label={plano}
              value={formatarMoeda(valor)}
              positivo
            />
          ))
        )}

        <div style={separador} />

        <h3 style={sectionTitle}>Despesas por Plano de Contas</h3>

        {Object.keys(dados.despesasPorPlano).length === 0 ? (
          <p style={empty}>Nenhuma despesa encontrada.</p>
        ) : (
          Object.entries(dados.despesasPorPlano).map(([plano, valor]) => (
            <Linha
              key={plano}
              label={plano}
              value={formatarMoeda(valor)}
              negativo
            />
          ))
        )}

        <div style={separador} />

        <Linha
          label="Resultado Final"
          value={formatarMoeda(dados.resultado)}
          destaque
          positivo={dados.resultado >= 0}
          negativo={dados.resultado < 0}
        />

        <button
          style={button}
          onClick={carregarMovimentos}
        >
          Atualizar Relatório
        </button>
      </div>
    </div>
  )
}

function Card({ title, value, color }) {
  return (
    <div style={card}>
      <span style={cardTitle}>{title}</span>
      <strong style={{ ...cardValue, color }}>{value}</strong>
    </div>
  )
}

function Linha({
  label,
  value,
  positivo,
  negativo,
  destaque,
}) {
  return (
    <div
      style={{
        ...linha,
        ...(destaque ? linhaDestaque : {}),
      }}
    >
      <span>{label}</span>

      <strong
        style={
          positivo
            ? positivoStyle
            : negativo
              ? negativoStyle
              : {}
        }
      >
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
  alignItems: "flex-start",
  gap: "20px",
  marginBottom: "20px",
}

const subtitle = {
  color: "#a9b8cc",
  marginBottom: "10px",
}

const filtros = {
  display: "flex",
  gap: "14px",
  alignItems: "flex-end",
}

const filtroBox = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "16px",
  width: "260px",
}

const label = {
  display: "block",
  color: "#a9b8cc",
  marginBottom: "8px",
}

const input = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
}

const empresaTitulo = {
  fontSize: "17px",
  fontWeight: "bold",
  marginBottom: "20px",
  color: "white",
}

const cards = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
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
  fontSize: "26px",
}

const dreBox = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "26px",
}

const sectionTitle = {
  margin: "0 0 10px",
}

const linha = {
  display: "flex",
  justifyContent: "space-between",
  padding: "14px 0",
  borderBottom: "1px solid rgba(255,255,255,.08)",
  fontSize: "17px",
}

const linhaDestaque = {
  marginTop: "10px",
  fontSize: "20px",
  borderBottom: "none",
}

const separador = {
  height: "1px",
  background: "rgba(255,255,255,.12)",
  margin: "18px 0",
}

const positivoStyle = {
  color: "#37ff74",
}

const negativoStyle = {
  color: "#ff4d4f",
}

const empty = {
  color: "#a9b8cc",
  margin: "8px 0 16px",
}

const button = {
  marginTop: "22px",
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}