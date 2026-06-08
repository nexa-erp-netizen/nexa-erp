import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import {
  FaArrowUp,
  FaArrowDown,
  FaWallet,
  FaClipboardList,
} from "react-icons/fa"

export default function PortalCliente({ setPage }) {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}")

  const nomeEmpresa =
    usuario?.clienteVinculado || usuario?.nome || "sua empresa"

  const [movimentos, setMovimentos] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      const movimentosResposta = await api.get("/movimentos-cliente")

      setMovimentos(
        Array.isArray(movimentosResposta.data)
          ? movimentosResposta.data
          : []
      )
    } catch (error) {
      console.error("ERRO MOVIMENTOS PORTAL:", error)
      setMovimentos([])
    }

    try {
      const solicitacoesResposta = await api.get("/solicitacoes-clientes")

      setSolicitacoes(
        Array.isArray(solicitacoesResposta.data)
          ? solicitacoesResposta.data
          : []
      )
    } catch (error) {
      console.error("ERRO SOLICITAÇÕES PORTAL:", error)
      setSolicitacoes([])
    }
  }

  function valorSeguro(valor) {
    if (valor === null || valor === undefined || valor === "") {
      return 0
    }

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

  function mesAtual(data) {
    if (!data) return false

    const hoje = new Date()
    const d = new Date(data + "T00:00:00")

    return (
      d.getMonth() === hoje.getMonth() &&
      d.getFullYear() === hoje.getFullYear()
    )
  }

  function abrirPendencias() {
    if (typeof setPage === "function") {
      setPage("Pendências")
      return
    }

    console.warn("setPage não foi recebido pelo PortalCliente")
  }

  const resumo = useMemo(() => {
    const movimentosMes = movimentos.filter((item) =>
      mesAtual(item.data)
    )

    const receitasMes = movimentosMes
      .filter((item) => item.tipo === "Receita")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const despesasMes = movimentosMes
      .filter((item) => item.tipo === "Despesa")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const saldoTotal = movimentos.reduce((total, item) => {
      const valor = valorSeguro(item.valor)

      return item.tipo === "Receita"
        ? total + valor
        : total - valor
    }, 0)

    const pendenciasAbertas = solicitacoes.filter(
      (item) => item.status !== "Concluída"
    ).length

    return {
      receitasMes,
      despesasMes,
      saldoTotal,
      pendenciasAbertas,
    }
  }, [movimentos, solicitacoes])

  return (
    <div className="pc-page">
      <style>{`
        .pc-page {
          color: white;
          padding: 24px 30px;
        }

        .pc-title {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .pc-subtitle {
          opacity: .8;
          margin-bottom: 24px;
          line-height: 24px;
        }

        .pc-cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(190px, 1fr));
          gap: 15px;
          margin-bottom: 24px;
        }

        .pc-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          min-height: 72px;
        }

        .pc-icon {
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

        .pc-card span {
          display: block;
          opacity: .72;
          font-size: 13px;
          margin-bottom: 7px;
          white-space: nowrap;
        }

        .pc-card strong {
          display: block;
          font-size: 20px;
          font-weight: 900;
          white-space: nowrap;
        }

        .pc-card .green,
        .pc-icon.green {
          color: #32f06d !important;
        }

        .pc-card .red,
        .pc-icon.red {
          color: #ff5c70 !important;
        }

        .pc-card .yellow,
        .pc-icon.yellow {
          color: #ffc107 !important;
        }

        .pc-card .blue,
        .pc-icon.blue {
          color: #3cbcff !important;
        }

        .pc-center-box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 24px;
          padding: 34px 30px;
          text-align: center;
        }

        .pc-center-box h2 {
          color: white;
          font-size: 28px;
          margin-bottom: 12px;
        }

        .pc-center-box p {
          color: #c9d6e6;
          margin-bottom: 26px;
          font-size: 16px;
          line-height: 26px;
        }

        .pc-center-box strong {
          color: #ffc107;
        }

        .pc-pendencias-btn {
          border: none;
          border-radius: 14px;
          padding: 16px 26px;
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
        }
      `}</style>

      <div
        style={{
          marginBottom: "20px",
          fontSize: "18px",
          color: "white",
        }}
      >
        Olá, {nomeEmpresa} 👋
      </div>

      <div className="pc-cards">
        <Card
          icon={<FaArrowUp />}
          label="Receitas do mês"
          value={formatarMoeda(resumo.receitasMes)}
          color="green"
        />

        <Card
          icon={<FaArrowDown />}
          label="Despesas do mês"
          value={formatarMoeda(resumo.despesasMes)}
          color="red"
        />

        <Card
          icon={<FaWallet />}
          label="Saldo atual"
          value={formatarMoeda(resumo.saldoTotal)}
          color={resumo.saldoTotal >= 0 ? "green" : "red"}
        />

        <Card
          icon={<FaClipboardList />}
          label="Pendências"
          value={resumo.pendenciasAbertas}
          color="yellow"
        />
      </div>

      <div className="pc-center-box">
        <h2>Bem-vindo ao Portal Nexa</h2>

        <p>
          Você possui{" "}
          <strong>{resumo.pendenciasAbertas}</strong>{" "}
          pendência(s) aberta(s). Acesse a área de pendências
          para visualizar os detalhes enviados pelo escritório.
        </p>

        <button
          type="button"
          className="pc-pendencias-btn"
          onClick={abrirPendencias}
        >
          <FaClipboardList />
          Ver Pendências
        </button>
      </div>
    </div>
  )
}

function Card({ icon, label, value, color }) {
  return (
    <div className="pc-card">
      <div className={`pc-icon ${color}`}>
        {icon}
      </div>

      <div>
        <span>{label}</span>

        <strong className={color}>
          {value}
        </strong>
      </div>
    </div>
  )
}