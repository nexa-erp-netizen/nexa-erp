import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import {
  FaArrowUp,
  FaArrowDown,
  FaWallet,
  FaClipboardList,
  FaExternalLinkAlt,
  FaUserEdit,
} from "react-icons/fa"

const EMISSOR_NACIONAL_NFSE_URL = "https://www.nfse.gov.br/EmissorNacional"

export default function PortalCliente({ setPage }) {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}")

  const nomeEmpresa =
    usuario?.clienteVinculado || usuario?.nome || "sua empresa"

  const [movimentos, setMovimentos] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [guiasFiscais, setGuiasFiscais] = useState([])
  const [mostrarValores, setMostrarValores] = useState(() => {
    return localStorage.getItem("nexaMostrarValoresCliente") === "true"
  })

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    localStorage.setItem(
      "nexaMostrarValoresCliente",
      mostrarValores ? "true" : "false"
    )
  }, [mostrarValores])

  async function carregarDados() {
    try {
      const movimentosResposta = await api.get("/movimentos-cliente")
      setMovimentos(Array.isArray(movimentosResposta.data) ? movimentosResposta.data : [])
    } catch (error) {
      console.error("ERRO MOVIMENTOS PORTAL:", error)
      setMovimentos([])
    }

    try {
      const solicitacoesResposta = await api.get("/solicitacoes-clientes")
      setSolicitacoes(Array.isArray(solicitacoesResposta.data) ? solicitacoesResposta.data : [])
    } catch (error) {
      console.error("ERRO SOLICITAÇÕES PORTAL:", error)
      setSolicitacoes([])
    }

    try {
      const fiscalResposta = await api.get("/fiscal")
      setGuiasFiscais(Array.isArray(fiscalResposta.data) ? fiscalResposta.data : [])
    } catch (error) {
      console.error("ERRO GUIAS FISCAIS PORTAL:", error)
      setGuiasFiscais([])
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

  function exibirMoeda(valor) {
    return mostrarValores ? formatarMoeda(valor) : "••••••••"
  }

  function mesAtual(data) {
    if (!data) return false

    const hoje = new Date()
    const d = new Date(data + "T00:00:00")

    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()
  }

  function abrirPendencias() {
    if (typeof setPage === "function") {
      setPage("Pendências e Guias")
    }
  }

  function abrirAtualizacaoCadastral() {
    if (typeof setPage === "function") setPage("Atualização Cadastral")
  }

  function abrirEmissorNacionalNfse() {
    window.open(EMISSOR_NACIONAL_NFSE_URL, "_blank", "noopener,noreferrer")
  }

  const resumo = useMemo(() => {
    const movimentosMes = movimentos.filter((item) => mesAtual(item.data))

    const receitasMes = movimentosMes
      .filter((item) => item.tipo === "Receita")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const despesasMes = movimentosMes
      .filter((item) => item.tipo === "Despesa")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const saldoTotal = movimentos.reduce((total, item) => {
      const valor = valorSeguro(item.valor)
      return item.tipo === "Receita" ? total + valor : total - valor
    }, 0)

    const solicitacoesAbertas = solicitacoes.filter((item) => {
      const status = String(item.status || "").toLowerCase().trim()

      return (
        status === "pendente" ||
        status === "aberto" ||
        status === "em aberto" ||
        status === "aguardando cliente"
      )
    }).length

    const guiasAbertas = guiasFiscais.filter((item) => {
      const status = String(item.status || "").toLowerCase().trim()

      return (
        status === "pendente" ||
        status === "aberto" ||
        status === "em aberto" ||
        status === "aguardando pagamento"
      )
    }).length

    const pendenciasAbertas = solicitacoesAbertas + guiasAbertas

    return {
      receitasMes,
      despesasMes,
      saldoTotal,
      pendenciasAbertas,
    }
  }, [movimentos, solicitacoes, guiasFiscais])

  return (
    <div className="pc-page">
      <style>{`
        .pc-page {
          color: white;
          padding: 24px 30px;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .pc-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 20px;
        }

        .pc-hello {
          font-size: 18px;
          color: white;
        }

        .pc-eye-btn {
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 14px;
          padding: 12px 16px;
          background: #061f47;
          color: white;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
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
          min-width: 0;
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

        .green { color: #32f06d !important; }
        .red { color: #ff5c70 !important; }
        .yellow { color: #ffc107 !important; }
        .blue { color: #3cbcff !important; }

        .pc-center-box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 24px;
          padding: 34px 30px;
          text-align: center;
          width: 100%;
          box-sizing: border-box;
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

        .pc-actions {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .pc-nfse-btn {
          border: 1px solid rgba(60,188,255,.55);
          border-radius: 14px;
          padding: 15px 24px;
          background: #061f47;
          color: white;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
        }

        .pc-nfse-btn:hover {
          border-color: #32f06d;
        }

        .pc-cadastro-btn {
          border: 1px solid rgba(50,240,109,.5);
          border-radius: 14px;
          padding: 15px 24px;
          background: #061f47;
          color: white;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
        }

        .pc-cadastro-btn:hover { border-color: #17b8ff; }

        @media (max-width: 768px) {
          .pc-page {
            padding: 18px 14px;
          }

          .pc-top {
            flex-direction: column;
            align-items: stretch;
          }

          .pc-eye-btn {
            width: 100%;
          }

          .pc-cards {
            grid-template-columns: 1fr;
          }

          .pc-card {
            width: 100%;
            box-sizing: border-box;
          }

          .pc-card span,
          .pc-card strong {
            white-space: normal;
          }

          .pc-center-box {
            padding: 24px 18px;
          }

          .pc-center-box h2 {
            font-size: 22px;
          }

          .pc-center-box p {
            font-size: 15px;
            line-height: 24px;
          }

          .pc-pendencias-btn {
            width: 100%;
            justify-content: center;
          }

          .pc-actions,
          .pc-nfse-btn,
          .pc-cadastro-btn {
            width: 100%;
          }

          .pc-nfse-btn,
          .pc-cadastro-btn {
            justify-content: center;
          }
        }
      `}</style>

      <div className="pc-top">
        <div className="pc-hello">
          Olá, {nomeEmpresa} 👋
        </div>

        <button
          type="button"
          className="pc-eye-btn"
          onClick={() => setMostrarValores(!mostrarValores)}
        >
          {mostrarValores ? "🙈 Ocultar valores" : "👁️ Mostrar valores"}
        </button>
      </div>

      <div className="pc-cards">
        <Card icon={<FaArrowUp />} label="Receitas do mês" value={exibirMoeda(resumo.receitasMes)} color="green" />
        <Card icon={<FaArrowDown />} label="Despesas do mês" value={exibirMoeda(resumo.despesasMes)} color="red" />
        <Card icon={<FaWallet />} label="Saldo atual" value={exibirMoeda(resumo.saldoTotal)} color={resumo.saldoTotal >= 0 ? "green" : "red"} />
        <Card icon={<FaClipboardList />} label="Pendências e Guias" value={resumo.pendenciasAbertas} color="yellow" />
      </div>

      <div className="pc-center-box">
        <h2>Bem-vindo ao Portal Nexa</h2>

        <p>
          Você possui <strong>{resumo.pendenciasAbertas}</strong>{" "}
          pendência(s) aberta(s). Acesse a área de pendências para visualizar os detalhes enviados pelo escritório.
        </p>

        <div className="pc-actions">
          <button type="button" className="pc-pendencias-btn" onClick={abrirPendencias}>
            <FaClipboardList />
            Ver Pendências e Guias
          </button>

          <button type="button" className="pc-cadastro-btn" onClick={abrirAtualizacaoCadastral}>
            <FaUserEdit />
            Atualizar meu cadastro
          </button>

          <button
            type="button"
            className="pc-nfse-btn"
            onClick={abrirEmissorNacionalNfse}
            title="Abrir o portal oficial do Emissor Nacional da NFS-e"
          >
            <FaExternalLinkAlt />
            Acessar Emissor Nacional da NFS-e
          </button>
        </div>
      </div>
    </div>
  )
}

function Card({ icon, label, value, color }) {
  return (
    <div className="pc-card">
      <div className={`pc-icon ${color}`}>{icon}</div>

      <div>
        <span>{label}</span>
        <strong className={color}>{value}</strong>
      </div>
    </div>
  )
}
