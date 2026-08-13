import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function DRE() {
  const [movimentos, setMovimentos] = useState([])
  const [empresaSelecionada, setEmpresaSelecionada] = useState("Todas")
  const [competenciaSelecionada, setCompetenciaSelecionada] =
    useState("Todas")

  useEffect(() => {
    const clienteVoz = localStorage.getItem("nexaFiltroDreCliente") || ""
    if (clienteVoz) {
      setEmpresaSelecionada(clienteVoz)
      localStorage.removeItem("nexaFiltroDreCliente")
    }
    carregarMovimentos()
  }, [])

  async function carregarMovimentos() {
    try {
      const resposta = await api.get("/lancamentos-contabeis")
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
        empresaSelecionada === "" ||
        item.cliente === empresaSelecionada

      const competenciaOk =
        competenciaSelecionada === "Todas" ||
        obterCompetencia(item.data) === competenciaSelecionada

      return empresaOk && competenciaOk
    })
  }, [movimentos, empresaSelecionada, competenciaSelecionada])

  const dados = useMemo(() => {
    const receitasLista = movimentosFiltrados.filter(
      (item) => String(item.tipo || "").toLowerCase() === "receita"
    )

    const despesasLista = movimentosFiltrados.filter(
      (item) => String(item.tipo || "").toLowerCase() === "despesa"
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

  function gerarPdfCliente() {
    if (movimentosFiltrados.length === 0) {
      alert("Não há lançamentos no período selecionado para gerar o DRE.")
      return
    }

    const escapar = (valor) =>
      String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[caractere])

    const linhas = (itens, classe) => {
      const registros = Object.entries(itens).sort(([a], [b]) =>
        a.localeCompare(b, "pt-BR", { sensitivity: "base" })
      )

      if (registros.length === 0) {
        return '<tr><td class="vazio" colspan="2">Nenhum lançamento nesta seção.</td></tr>'
      }

      return registros.map(([plano, valor]) => `
        <tr>
          <td>${escapar(plano)}</td>
          <td class="valor ${classe}">${formatarMoeda(valor)}</td>
        </tr>
      `).join("")
    }

    const empresa = empresaSelecionada === "Todas"
      ? "Consolidado de todas as empresas"
      : empresaSelecionada
    const periodo = competenciaSelecionada === "Todas"
      ? "Todas as competências disponíveis"
      : `Competência ${competenciaSelecionada}`
    const resultadoNome = dados.resultado >= 0 ? "Lucro do período" : "Prejuízo do período"
    const dataEmissao = new Date().toLocaleString("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
    })

    const html = `<!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>DRE - ${escapar(empresa)} - ${escapar(competenciaSelecionada)}</title>
        <style>
          @page { size: A4 portrait; margin: 14mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #16324a; font: 12px Arial, Helvetica, sans-serif; background: #fff; }
          .acoes { margin-bottom: 14px; }
          .acoes button { border: 0; border-radius: 7px; padding: 10px 16px; color: #fff; background: #087f70; font-weight: 700; cursor: pointer; }
          .cabecalho { border-bottom: 3px solid #0b8b78; padding-bottom: 14px; margin-bottom: 16px; }
          .marca { color: #087f70; font-size: 12px; font-weight: 800; letter-spacing: 1.2px; }
          h1 { margin: 7px 0 5px; font-size: 25px; color: #0a3457; }
          .empresa { font-size: 17px; font-weight: 800; }
          .periodo { margin-top: 4px; color: #53697a; }
          .resumo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-bottom: 18px; }
          .indicador { border: 1px solid #b7d9d1; border-radius: 8px; padding: 10px; background: #f4fbf8; }
          .indicador span { display: block; color: #5b7180; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }
          .indicador strong { display: block; margin-top: 5px; font-size: 14px; color: #0a3457; }
          h2 { margin: 17px 0 6px; padding: 7px 9px; font-size: 13px; color: #fff; background: #0a5b68; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #c7d9de; padding: 7px 9px; }
          th { color: #24475e; background: #e7f3f1; text-align: left; font-size: 10px; text-transform: uppercase; }
          .valor { width: 145px; text-align: right; font-weight: 700; }
          .receita { color: #08734f; }
          .despesa { color: #b13d42; }
          .vazio { color: #718493; font-style: italic; }
          .total td { padding: 9px; font-weight: 800; background: #eef7f5; }
          .resultado { margin-top: 17px; border: 2px solid ${dados.resultado >= 0 ? "#16805d" : "#bd4147"}; border-radius: 8px; padding: 13px; display: flex; justify-content: space-between; align-items: center; }
          .resultado span { font-size: 15px; font-weight: 800; }
          .resultado strong { color: ${dados.resultado >= 0 ? "#08734f" : "#b13d42"}; font-size: 19px; }
          .rodape { margin-top: 18px; border-top: 1px solid #cad8de; padding-top: 9px; color: #667d8c; font-size: 9px; line-height: 1.45; }
          @media print { .acoes { display: none; } }
        </style>
      </head>
      <body>
        <div class="acoes"><button onclick="window.print()">Imprimir / salvar em PDF</button></div>
        <header class="cabecalho">
          <div class="marca">NEXA CONTÁBIL DIGITAL</div>
          <h1>Demonstração do Resultado do Exercício</h1>
          <div class="empresa">${escapar(empresa)}</div>
          <div class="periodo">${escapar(periodo)}</div>
        </header>
        <section class="resumo">
          <div class="indicador"><span>Receita total</span><strong>${formatarMoeda(dados.receitas)}</strong></div>
          <div class="indicador"><span>Despesa total</span><strong>${formatarMoeda(dados.despesas)}</strong></div>
          <div class="indicador"><span>Resultado</span><strong>${formatarMoeda(dados.resultado)}</strong></div>
          <div class="indicador"><span>Margem</span><strong>${margemLucro.toFixed(2)}%</strong></div>
        </section>
        <h2>Receitas por plano de contas</h2>
        <table>
          <thead><tr><th>Conta / categoria</th><th class="valor">Valor</th></tr></thead>
          <tbody>${linhas(dados.receitasPorPlano, "receita")}</tbody>
          <tfoot><tr class="total"><td>Total das receitas</td><td class="valor receita">${formatarMoeda(dados.receitas)}</td></tr></tfoot>
        </table>
        <h2>Despesas por plano de contas</h2>
        <table>
          <thead><tr><th>Conta / categoria</th><th class="valor">Valor</th></tr></thead>
          <tbody>${linhas(dados.despesasPorPlano, "despesa")}</tbody>
          <tfoot><tr class="total"><td>Total das despesas</td><td class="valor despesa">${formatarMoeda(dados.despesas)}</td></tr></tfoot>
        </table>
        <div class="resultado">
          <span>${resultadoNome}</span>
          <strong>${formatarMoeda(dados.resultado)}</strong>
        </div>
        <footer class="rodape">
          Documento gerencial emitido em ${escapar(dataEmissao)} com base em ${dados.totalLancamentos} lançamento(s) registrado(s) na Nexa ERP.<br />
          Este demonstrativo possui finalidade gerencial e deve ser conciliado com a escrituração contábil antes de uso fiscal ou societário.
        </footer>
      </body>
      </html>`

    const janela = window.open("", "_blank")
    if (!janela) {
      alert("Permita a abertura de janelas no navegador para gerar o PDF.")
      return
    }
    janela.document.write(html)
    janela.document.close()
  }

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

        <div style={acoesRelatorio}>
          <button
            style={buttonSecondary}
            onClick={carregarMovimentos}
          >
            Atualizar Relatório
          </button>

          <button
            style={button}
            onClick={gerarPdfCliente}
          >
            Gerar PDF para o Cliente
          </button>
        </div>
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
  padding: "14px 22px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const buttonSecondary = {
  ...button,
  background: "#11375f",
  color: "white",
  border: "1px solid #34729d",
}

const acoesRelatorio = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "22px",
}
