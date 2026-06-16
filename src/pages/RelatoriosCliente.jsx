import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import {
  FaArrowLeft,
  FaArrowDown,
  FaArrowUp,
  FaCalendarAlt,
  FaChartBar,
  FaSearch,
  FaWallet,
} from "react-icons/fa"

export default function RelatoriosCliente({ setPage }) {
  const hoje = new Date()
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

  const [movimentos, setMovimentos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [dataInicial, setDataInicial] = useState(formatarDataInput(primeiroDiaMes))
  const [dataFinal, setDataFinal] = useState(formatarDataInput(hoje))

  useEffect(() => {
    carregarMovimentos()
  }, [])

  async function carregarMovimentos() {
    setCarregando(true)

    try {
      const resposta = await api.get("/movimentos-cliente")
      setMovimentos(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("ERRO RELATÓRIO CLIENTE:", error)
      setMovimentos([])
    } finally {
      setCarregando(false)
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

  function dentroPeriodo(data) {
    if (!data) return false

    const atual = new Date(data + "T00:00:00")
    const inicio = dataInicial ? new Date(dataInicial + "T00:00:00") : null
    const fim = dataFinal ? new Date(dataFinal + "T23:59:59") : null

    if (inicio && atual < inicio) return false
    if (fim && atual > fim) return false

    return true
  }

  const resumo = useMemo(() => {
    const movimentosPeriodo = movimentos
      .filter((item) => dentroPeriodo(item.data))
      .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))

    const receitas = movimentosPeriodo
      .filter((item) => item.tipo === "Receita")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const despesas = movimentosPeriodo
      .filter((item) => item.tipo === "Despesa")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const saldoPeriodo = receitas - despesas

    const saldoAnterior = movimentos
      .filter((item) => {
        if (!item.data || !dataInicial) return false
        return new Date(item.data + "T00:00:00") < new Date(dataInicial + "T00:00:00")
      })
      .reduce((total, item) => {
        const valor = valorSeguro(item.valor)
        return item.tipo === "Receita" ? total + valor : total - valor
      }, 0)

    const meses = {}

    movimentosPeriodo.forEach((item) => {
      if (!item.data) return

      const data = new Date(item.data + "T00:00:00")
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
      const rotulo = data.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      })

      if (!meses[chave]) {
        meses[chave] = {
          chave,
          rotulo,
          receitas: 0,
          despesas: 0,
        }
      }

      if (item.tipo === "Receita") {
        meses[chave].receitas += valorSeguro(item.valor)
      } else {
        meses[chave].despesas += valorSeguro(item.valor)
      }
    })

    return {
      movimentosPeriodo,
      receitas,
      despesas,
      saldoPeriodo,
      saldoAnterior,
      meses: Object.values(meses).sort((a, b) => a.chave.localeCompare(b.chave)),
    }
  }, [movimentos, dataInicial, dataFinal])

  const maiorValorGrafico = Math.max(resumo.receitas, resumo.despesas, 1)
  const maiorValorMensal = Math.max(
    ...resumo.meses.map((item) => Math.max(item.receitas, item.despesas)),
    1
  )

  return (
    <div className="rc-page">
      <style>{`
        .rc-page {
          color: white;
          padding: 24px 30px;
        }

        .rc-topo {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
        }

        .rc-topo h2 {
          margin: 0;
          font-size: 28px;
          font-weight: 900;
        }

        .rc-voltar-btn {
          border: none;
          border-radius: 13px;
          padding: 12px 18px;
          background: linear-gradient(90deg, #00a8ff, #37ff74);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          white-space: nowrap;
        }

        .rc-filtros,
        .rc-box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 22px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .rc-filtros {
          display: grid;
          grid-template-columns: repeat(2, minmax(180px, 1fr)) auto;
          gap: 14px;
          align-items: end;
        }

        .rc-field label {
          display: block;
          font-size: 13px;
          color: #c9d6e6;
          margin-bottom: 8px;
          font-weight: 700;
        }

        .rc-field input {
          width: 100%;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 12px;
          background: #061f47;
          color: white;
          padding: 13px 14px;
          outline: none;
          font-weight: 700;
        }

        .rc-btn {
          border: none;
          border-radius: 13px;
          padding: 14px 20px;
          background: linear-gradient(90deg, #00a8ff, #37ff74);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }

        .rc-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .rc-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          min-height: 72px;
        }

        .rc-icon {
          min-width: 46px;
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #061f47;
          font-size: 20px;
        }

        .rc-card span {
          display: block;
          opacity: .72;
          font-size: 13px;
          margin-bottom: 7px;
        }

        .rc-card strong {
          display: block;
          font-size: 20px;
          font-weight: 900;
          white-space: nowrap;
        }

        .green { color: #32f06d !important; }
        .red { color: #ff5c70 !important; }
        .yellow { color: #ffc107 !important; }
        .blue { color: #3cbcff !important; }

        .rc-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .rc-box h3 {
          margin: 0 0 16px;
          font-size: 20px;
        }

        .rc-bar-row {
          margin-bottom: 16px;
        }

        .rc-bar-label {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
          color: #c9d6e6;
          font-weight: 800;
          font-size: 13px;
        }

        .rc-bar-track {
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,.10);
          overflow: hidden;
        }

        .rc-bar-fill {
          height: 100%;
          border-radius: 999px;
        }

        .rc-bar-fill.receita { background: linear-gradient(90deg, #00a8ff, #37ff74); }
        .rc-bar-fill.despesa { background: linear-gradient(90deg, #ff8a00, #ff4d6d); }

        .rc-mes-item {
          margin-bottom: 15px;
        }

        .rc-mes-titulo {
          font-size: 13px;
          font-weight: 900;
          color: white;
          margin-bottom: 8px;
          text-transform: capitalize;
        }

        .rc-table-wrap {
          overflow-x: auto;
        }

        .rc-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }

        .rc-table th,
        .rc-table td {
          padding: 13px 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          text-align: left;
          font-size: 14px;
        }

        .rc-table th {
          color: #c9d6e6;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .rc-empty {
          text-align: center;
          color: #c9d6e6;
          padding: 28px;
        }

        @media (max-width: 900px) {
          .rc-page { padding: 16px !important; }
          .rc-filtros { grid-template-columns: 1fr !important; }
          .rc-grid { grid-template-columns: 1fr !important; }
          .rc-btn,
          .rc-voltar-btn { width: 100%; }
          .rc-topo { display: block; }
          .rc-topo h2 { font-size: 24px; margin-bottom: 12px; }
        }
      `}</style>

      <div className="rc-topo">
        <h2>Relatório Financeiro</h2>

        <button
          type="button"
          className="rc-voltar-btn"
          onClick={() => setPage?.("Portal Cliente")}
        >
          <FaArrowLeft />
          Voltar ao Portal
        </button>
      </div>

      <div className="rc-filtros">
        <div className="rc-field">
          <label>Data inicial</label>
          <input
            type="date"
            value={dataInicial}
            onChange={(event) => setDataInicial(event.target.value)}
          />
        </div>

        <div className="rc-field">
          <label>Data final</label>
          <input
            type="date"
            value={dataFinal}
            onChange={(event) => setDataFinal(event.target.value)}
          />
        </div>

        <button type="button" className="rc-btn" onClick={carregarMovimentos}>
          <FaSearch />
          Pesquisar
        </button>
      </div>

      <div className="rc-cards">
        <Card icon={<FaArrowUp />} label="Receitas no período" value={formatarMoeda(resumo.receitas)} color="green" />
        <Card icon={<FaArrowDown />} label="Despesas no período" value={formatarMoeda(resumo.despesas)} color="red" />
        <Card icon={<FaWallet />} label="Saldo do período" value={formatarMoeda(resumo.saldoPeriodo)} color={resumo.saldoPeriodo >= 0 ? "green" : "red"} />
        <Card icon={<FaCalendarAlt />} label="Saldo anterior" value={formatarMoeda(resumo.saldoAnterior)} color={resumo.saldoAnterior >= 0 ? "green" : "red"} />
      </div>

      <div className="rc-grid">
        <div className="rc-box">
          <h3><FaChartBar /> Receitas x Despesas</h3>

          <Barra
            label="Receitas"
            valor={resumo.receitas}
            maximo={maiorValorGrafico}
            tipo="receita"
            formatarMoeda={formatarMoeda}
          />

          <Barra
            label="Despesas"
            valor={resumo.despesas}
            maximo={maiorValorGrafico}
            tipo="despesa"
            formatarMoeda={formatarMoeda}
          />
        </div>

        <div className="rc-box">
          <h3>Evolução mensal</h3>

          {resumo.meses.length === 0 ? (
            <div className="rc-empty">Nenhum movimento encontrado no período.</div>
          ) : (
            resumo.meses.map((mes) => (
              <div className="rc-mes-item" key={mes.chave}>
                <div className="rc-mes-titulo">{mes.rotulo}</div>
                <Barra
                  label="Receitas"
                  valor={mes.receitas}
                  maximo={maiorValorMensal}
                  tipo="receita"
                  formatarMoeda={formatarMoeda}
                />
                <Barra
                  label="Despesas"
                  valor={mes.despesas}
                  maximo={maiorValorMensal}
                  tipo="despesa"
                  formatarMoeda={formatarMoeda}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rc-box">
        <h3>Movimentos do período</h3>

        <div className="rc-table-wrap">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Plano de Conta</th>
                <th>Forma</th>
                <th>Descrição</th>
                <th>Valor</th>
              </tr>
            </thead>

            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan="6" className="rc-empty">Carregando relatório...</td>
                </tr>
              ) : resumo.movimentosPeriodo.length === 0 ? (
                <tr>
                  <td colSpan="6" className="rc-empty">Nenhum movimento encontrado no período.</td>
                </tr>
              ) : (
                resumo.movimentosPeriodo.map((item) => (
                  <tr key={item.id}>
                    <td>{formatarData(item.data)}</td>
                    <td className={item.tipo === "Receita" ? "green" : "red"}>{item.tipo}</td>
                    <td>{item.planoContaNome || "-"}</td>
                    <td>{item.formaPagamento || item.forma || "-"}</td>
                    <td>{item.descricao || "-"}</td>
                    <td className={item.tipo === "Receita" ? "green" : "red"}>{formatarMoeda(item.valor)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Card({ icon, label, value, color }) {
  return (
    <div className="rc-card">
      <div className={`rc-icon ${color}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong className={color}>{value}</strong>
      </div>
    </div>
  )
}

function Barra({ label, valor, maximo, tipo, formatarMoeda }) {
  const percentual = Math.max(4, Math.min(100, (valor / maximo) * 100))

  return (
    <div className="rc-bar-row">
      <div className="rc-bar-label">
        <span>{label}</span>
        <span>{formatarMoeda(valor)}</span>
      </div>
      <div className="rc-bar-track">
        <div
          className={`rc-bar-fill ${tipo}`}
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  )
}

function formatarDataInput(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")

  return `${ano}-${mes}-${dia}`
}
