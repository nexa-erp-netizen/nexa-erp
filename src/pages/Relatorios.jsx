import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function Relatorios() {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}")
  const clienteLogado = usuario?.perfil === "Cliente"
  const clienteFixo = usuario?.clienteVinculado || ""

  const [clienteSelecionado, setClienteSelecionado] = useState(
    clienteLogado ? clienteFixo : ""
  )
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState("Todas")
  const [planoSelecionado, setPlanoSelecionado] = useState("Todos")
  const [clientes, setClientes] = useState([])
  const [movimentos, setMovimentos] = useState([])
  const [lancamentosContabeis, setLancamentosContabeis] = useState([])

  useEffect(() => {
    if (clienteLogado && clienteFixo) {
      setClienteSelecionado(clienteFixo)
    }

    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      const [clientesResp, movimentosResp, lancamentosResp] = await Promise.all([
        api.get("/clientes"),
        api.get("/movimentos-cliente"),
        api.get("/lancamentos-contabeis"),
      ])

      setClientes(Array.isArray(clientesResp.data) ? clientesResp.data : [])
      setMovimentos(Array.isArray(movimentosResp.data) ? movimentosResp.data : [])
      setLancamentosContabeis(Array.isArray(lancamentosResp.data) ? lancamentosResp.data : [])
    } catch (error) {
      alert("Erro ao carregar relatório")
      console.error(error)
    }
  }

  function valorSeguro(valor) {
    if (valor === null || valor === undefined || valor === "") return 0

    let texto = String(valor).replace("R$", "").trim()

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

  function formatarData(data) {
    if (!data) return "-"
    return new Date(data + "T00:00:00").toLocaleDateString("pt-BR")
  }

  function obterCompetencia(data) {
    if (!data) return "Sem data"

    const d = new Date(data + "T00:00:00")
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
  }

  function normalizarTipo(tipo) {
    const texto = String(tipo || "").toLowerCase()

    if (
      texto === "receita" ||
      texto === "crédito" ||
      texto === "credito" ||
      texto === "entrada"
    ) {
      return "Receita"
    }

    return "Despesa"
  }

  function obterPlano(item) {
    return item.planoContaNome || item.planoConta || item.categoria || "Sem plano de contas"
  }

  function lancamentoAutomaticoDeMovimento(item) {
    return String(item.observacao || "").startsWith("movimento-cliente:")
  }

  function normalizarMovimento(item, origem) {
    return {
      ...item,
      id: `${origem}-${item.id}`,
      tipo: normalizarTipo(item.tipo),
      planoContaNome: item.planoContaNome || item.planoConta || item.categoria,
      origemRelatorio: origem,
    }
  }

  function imprimirPDF() {
    window.print()
  }

  const registrosRelatorio = useMemo(() => {
    const movimentosNormalizados = movimentos.map((item) =>
      normalizarMovimento(item, "movimento")
    )

    const lancamentosManuais = lancamentosContabeis
      .filter((item) => !lancamentoAutomaticoDeMovimento(item))
      .map((item) => normalizarMovimento(item, "lancamento-contabil"))

    return [...movimentosNormalizados, ...lancamentosManuais]
  }, [movimentos, lancamentosContabeis])

  const competencias = useMemo(() => {
    return [
      "Todas",
      ...new Set(
        registrosRelatorio
          .filter((item) => item.data)
          .map((item) => obterCompetencia(item.data))
      ),
    ]
  }, [registrosRelatorio])

  const planos = useMemo(() => {
    return [
      "Todos",
      ...new Set(
        registrosRelatorio
          .map((item) => obterPlano(item))
          .filter(Boolean)
      ),
    ]
  }, [registrosRelatorio])

  const movimentosFiltrados = useMemo(() => {
    return registrosRelatorio.filter((item) => {
      const clienteOk =
        clienteLogado
          ? item.cliente === clienteFixo
          : !clienteSelecionado || item.cliente === clienteSelecionado

      const competenciaOk =
        competenciaSelecionada === "Todas" ||
        obterCompetencia(item.data) === competenciaSelecionada

      const planoOk =
        planoSelecionado === "Todos" ||
        obterPlano(item) === planoSelecionado

      return clienteOk && competenciaOk && planoOk
    })
  }, [
    registrosRelatorio,
    clienteLogado,
    clienteFixo,
    clienteSelecionado,
    competenciaSelecionada,
    planoSelecionado,
  ])

  const resumo = useMemo(() => {
    const receitas = movimentosFiltrados
      .filter((item) => item.tipo === "Receita")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const despesas = movimentosFiltrados
      .filter((item) => item.tipo === "Despesa")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    return {
      receitas,
      despesas,
      resultado: receitas - despesas,
      quantidadeLancamentos: movimentosFiltrados.length,
    }
  }, [movimentosFiltrados])

  const evolucaoMensal = useMemo(() => {
    const meses = {}

    movimentosFiltrados.forEach((item) => {
      const comp = obterCompetencia(item.data)

      if (!meses[comp]) {
        meses[comp] = {
          competencia: comp,
          receitas: 0,
          despesas: 0,
          resultado: 0,
        }
      }

      const valor = valorSeguro(item.valor)

      if (item.tipo === "Receita") {
        meses[comp].receitas += valor
      } else {
        meses[comp].despesas += valor
      }

      meses[comp].resultado = meses[comp].receitas - meses[comp].despesas
    })

    return Object.values(meses).sort((a, b) => {
      const [ma, ya] = a.competencia.split("/")
      const [mb, yb] = b.competencia.split("/")

      return new Date(Number(ya), Number(ma) - 1) - new Date(Number(yb), Number(mb) - 1)
    })
  }, [movimentosFiltrados])

  const maiorValorGrafico = Math.max(
    ...evolucaoMensal.map((item) =>
      Math.max(item.receitas, item.despesas, Math.abs(item.resultado))
    ),
    1
  )

  const nomeCliente = clienteLogado
    ? clienteFixo
    : clienteSelecionado || "Todas as empresas"

  return (
    <div style={box}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          #relatorio-pdf,
          #relatorio-pdf * {
            visibility: visible;
          }

          #relatorio-pdf {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }

          .no-print {
            display: none !important;
          }

          table {
            color: black !important;
          }
        }
      `}</style>

      <div id="relatorio-pdf">
        <div style={topo} className="no-print">
          <div>
            <h2>Relatórios Gerenciais</h2>

            <p style={subtitulo}>
              Relatório detalhado de movimentações por cliente, competência e plano de contas.
            </p>
          </div>

          <div style={filtros}>
            {!clienteLogado && (
              <select
                style={select}
                value={clienteSelecionado}
                onChange={(e) => setClienteSelecionado(e.target.value)}
              >
                <option value="">Todas as empresas</option>

                {clientes.map((item) => (
                  <option key={item.id} value={item.nome}>
                    {item.nome}
                  </option>
                ))}
              </select>
            )}

            <select
              style={select}
              value={competenciaSelecionada}
              onChange={(e) => setCompetenciaSelecionada(e.target.value)}
            >
              {competencias.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>

            <select
              style={select}
              value={planoSelecionado}
              onChange={(e) => setPlanoSelecionado(e.target.value)}
            >
              {planos.map((plano) => (
                <option key={plano} value={plano}>
                  {plano}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={empresaInfo}>
          <strong>Cliente:</strong> {nomeCliente}
          {" | "}
          <strong>Competência:</strong> {competenciaSelecionada}
          {" | "}
          <strong>Plano de Contas:</strong> {planoSelecionado}
        </div>

        <div style={cards}>
          <Card
            title="Receitas"
            value={formatarMoeda(resumo.receitas)}
            color="#37ff74"
          />

          <Card
            title="Despesas"
            value={formatarMoeda(resumo.despesas)}
            color="#ff4d4f"
          />

          <Card
            title="Resultado"
            value={formatarMoeda(resumo.resultado)}
            color={resumo.resultado >= 0 ? "#37ff74" : "#ff4d4f"}
          />

          <Card
            title="Lançamentos"
            value={resumo.quantidadeLancamentos}
            color="#3cbcff"
          />
        </div>

        <div style={painel}>
          <h3>Evolução Mensal</h3>

          <div style={legenda}>
            <span style={legendaItem}>
              <span style={{ ...legendaCor, background: "#37ff74" }} />
              Crédito
            </span>

            <span style={legendaItem}>
              <span style={{ ...legendaCor, background: "#ff4d4f" }} />
              Débito
            </span>

            <span style={legendaItem}>
              <span style={{ ...legendaCor, background: "#17b8ff" }} />
              Resultado
            </span>
          </div>

          {evolucaoMensal.length === 0 ? (
            <p style={empty}>Nenhuma movimentação encontrada para o gráfico.</p>
          ) : (
            <div style={graficoVertical}>
              {evolucaoMensal.map((item) => {
                const alturaReceita = Math.max((item.receitas / maiorValorGrafico) * 180, item.receitas > 0 ? 8 : 0)
                const alturaDespesa = Math.max((item.despesas / maiorValorGrafico) * 180, item.despesas > 0 ? 8 : 0)
                const alturaResultado = Math.max((Math.abs(item.resultado) / maiorValorGrafico) * 180, item.resultado !== 0 ? 8 : 0)

                return (
                  <div key={item.competencia} style={mesColuna}>
                    <div style={barrasGrupo}>
                      <div style={barraWrapper}>
                        <div
                          title={`Crédito: ${formatarMoeda(item.receitas)}`}
                          style={{
                            ...barraVertical,
                            height: `${alturaReceita}px`,
                            background: "#37ff74",
                          }}
                        />
                      </div>

                      <div style={barraWrapper}>
                        <div
                          title={`Débito: ${formatarMoeda(item.despesas)}`}
                          style={{
                            ...barraVertical,
                            height: `${alturaDespesa}px`,
                            background: "#ff4d4f",
                          }}
                        />
                      </div>

                      <div style={barraWrapper}>
                        <div
                          title={`Resultado: ${formatarMoeda(item.resultado)}`}
                          style={{
                            ...barraVertical,
                            height: `${alturaResultado}px`,
                            background: "#17b8ff",
                          }}
                        />
                      </div>
                    </div>

                    <strong style={mesLabel}>{item.competencia}</strong>

                    <span style={valorMes}>
                      {formatarMoeda(item.resultado)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={painel}>
          <h3>Detalhamento das Movimentações</h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Data</th>
                <th style={th}>Tipo</th>
                <th style={th}>Plano de Contas</th>
                <th style={th}>Histórico</th>
                <th style={{ ...th, textAlign: "right" }}>Valor</th>
              </tr>
            </thead>

            <tbody>
              {movimentosFiltrados.map((item) => (
                <tr key={item.id}>
                  <td style={td}>{formatarData(item.data)}</td>

                  <td
                    style={{
                      ...td,
                      color: item.tipo === "Receita" ? "#37ff74" : "#ff4d4f",
                      fontWeight: "bold",
                    }}
                  >
                    {item.tipo}
                  </td>

                  <td style={td}>{obterPlano(item)}</td>
                  <td style={td}>{item.descricao}</td>

                  <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>
                    {formatarMoeda(item.valor)}
                  </td>
                </tr>
              ))}

              {movimentosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="5" style={td}>
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={painel}>
          <h3>Resultado Final</h3>

          <div style={linha}>
            <span>Total de Receitas</span>
            <strong style={positivo}>{formatarMoeda(resumo.receitas)}</strong>
          </div>

          <div style={linha}>
            <span>Total de Despesas</span>
            <strong style={negativo}>{formatarMoeda(resumo.despesas)}</strong>
          </div>

          <div style={divisor} />

          <div style={linha}>
            <span>Resultado</span>

            <strong style={resumo.resultado >= 0 ? positivo : negativo}>
              {formatarMoeda(resumo.resultado)}
            </strong>
          </div>
        </div>
      </div>

      <div className="no-print" style={botoes}>
        <button style={button} onClick={carregarDados}>
          Atualizar Relatório
        </button>

        <button style={buttonPdf} onClick={imprimirPDF}>
          Gerar PDF
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
  gap: "20px",
}

const subtitulo = {
  color: "#a9b8cc",
  marginTop: "6px",
}

const filtros = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
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
  minWidth: "220px",
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
  fontSize: "28px",
}

const painel = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "24px",
  color: "white",
  marginBottom: "24px",
}

const legenda = {
  display: "flex",
  gap: "18px",
  marginBottom: "20px",
  flexWrap: "wrap",
}

const legendaItem = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: "bold",
}

const legendaCor = {
  width: "13px",
  height: "13px",
  borderRadius: "50%",
  display: "inline-block",
}

const graficoVertical = {
  minHeight: "260px",
  display: "flex",
  alignItems: "flex-end",
  gap: "22px",
  padding: "25px 10px 10px",
  borderTop: "1px solid rgba(255,255,255,.12)",
  overflowX: "auto",
}

const mesColuna = {
  minWidth: "95px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
}

const barrasGrupo = {
  height: "190px",
  display: "flex",
  alignItems: "flex-end",
  gap: "6px",
}

const barraWrapper = {
  width: "18px",
  height: "190px",
  display: "flex",
  alignItems: "flex-end",
  background: "rgba(255,255,255,.05)",
  borderRadius: "12px",
  overflow: "hidden",
}

const barraVertical = {
  width: "100%",
  borderRadius: "12px 12px 0 0",
}

const mesLabel = {
  fontSize: "13px",
  color: "#c9d6e6",
}

const valorMes = {
  fontSize: "12px",
  color: "#3cbcff",
  fontWeight: "bold",
  whiteSpace: "nowrap",
}

const table = {
  width: "100%",
  borderCollapse: "collapse",
}

const th = {
  color: "#6bd8ff",
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid rgba(255,255,255,.12)",
}

const td = {
  padding: "12px",
  borderBottom: "1px solid rgba(255,255,255,.06)",
}

const linha = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "16px",
  fontSize: "17px",
}

const divisor = {
  height: "1px",
  background: "rgba(255,255,255,.15)",
  margin: "22px 0",
}

const positivo = {
  color: "#37ff74",
}

const negativo = {
  color: "#ff4d4f",
}

const empty = {
  color: "#a9b8cc",
}

const botoes = {
  display: "flex",
  gap: "12px",
}

const button = {
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const buttonPdf = {
  ...button,
  background: "#ffc107",
}
