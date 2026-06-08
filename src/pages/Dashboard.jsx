import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import {
  FaUsers,
  FaClipboardList,
  FaArrowUp,
  FaArrowDown,
  FaWallet,
  FaSyncAlt,
} from "react-icons/fa"

export default function Dashboard() {
  const [clientes, setClientes] = useState([])
  const [movimentos, setMovimentos] = useState([])
  const [pendencias, setPendencias] = useState([])

  useEffect(() => {
    carregarDashboard()
  }, [])

  async function carregarDashboard() {
    try {
      const [clientesResp, movimentosResp, pendenciasResp] =
        await Promise.all([
          api.get("/clientes"),
          api.get("/movimentos-cliente"),
          api.get("/solicitacoes-clientes"),
        ])

      setClientes(Array.isArray(clientesResp.data) ? clientesResp.data : [])
      setMovimentos(Array.isArray(movimentosResp.data) ? movimentosResp.data : [])
      setPendencias(Array.isArray(pendenciasResp.data) ? pendenciasResp.data : [])
    } catch (error) {
      alert("Erro ao carregar dashboard")
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

  const resumo = useMemo(() => {
    const receitas = movimentos
      .filter((item) => item.tipo === "Receita")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const despesas = movimentos
      .filter((item) => item.tipo === "Despesa")
      .reduce((total, item) => total + valorSeguro(item.valor), 0)

    const pendenciasAbertas = pendencias.filter(
      (item) => item.status !== "Concluída"
    ).length

    return {
      totalClientes: clientes.length,
      pendenciasAbertas,
      receitas,
      despesas,
      saldo: receitas - despesas,
      totalMovimentos: movimentos.length,
    }
  }, [clientes, movimentos, pendencias])

  const ultimasPendencias = [...pendencias]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)

  const ultimosMovimentos = [...movimentos]
    .sort((a, b) => new Date(b.createdAt || b.data) - new Date(a.createdAt || a.data))
    .slice(0, 6)

  return (
    <div className="db-page">
      <style>{`
        .db-page {
          padding: 30px;
          color: white;
        }

        .db-topo {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .db-title {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .db-subtitle {
          opacity: .8;
        }

        .db-refresh {
          height: 46px;
          border: none;
          border-radius: 14px;
          padding: 0 18px;
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .db-cards {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }

        .db-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          padding: 20px;
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .db-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          background: #061f47;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .db-card span {
          display: block;
          opacity: .72;
          font-size: 13px;
          margin-bottom: 7px;
        }

        .db-card strong {
          font-size: 19px;
          white-space: nowrap;
        }

        .green { color: #32f06d; }
        .red { color: #ff5c70; }
        .blue { color: #3cbcff; }
        .yellow { color: #ffc107; }

        .db-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 25px;
          margin-bottom: 25px;
        }

        .db-box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 24px;
          padding: 24px;
        }

        .db-box-title {
          font-size: 21px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .db-table {
          width: 100%;
          border-collapse: collapse;
        }

        .db-table th {
          color: #6bd8ff;
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          font-size: 13px;
        }

        .db-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.05);
          font-size: 14px;
        }

        .valor {
          text-align: right;
          font-weight: 800;
          white-space: nowrap;
        }

        .tipo-receita {
          color: #32f06d;
          font-weight: 900;
        }

        .tipo-despesa {
          color: #ff5c70;
          font-weight: 900;
        }

        .status {
          padding: 6px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          display: inline-block;
        }

        .status-pendente {
          background: rgba(255,193,7,.15);
          color: #ffc107;
        }

        .status-analise {
          background: rgba(60,188,255,.15);
          color: #3cbcff;
        }

        .status-concluida {
          background: rgba(50,240,109,.15);
          color: #32f06d;
        }

        .db-operacional {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
        }

        .db-mini {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 16px;
          padding: 18px;
        }

        .db-mini span {
          display: block;
          opacity: .7;
          margin-bottom: 8px;
        }

        .db-mini strong {
          font-size: 18px;
        }

        .empty {
          opacity: .7;
          padding: 18px;
        }
      `}</style>

      <div className="db-topo">
        <div>
          <div className="db-title">Dashboard Escritório</div>
          <div className="db-subtitle">
            Visão operacional dos clientes, movimentos e pendências
          </div>
        </div>

        <button className="db-refresh" onClick={carregarDashboard}>
          <FaSyncAlt />
          Atualizar
        </button>
      </div>

      <div className="db-cards">
        <Card
          icon={<FaUsers />}
          label="Clientes"
          value={resumo.totalClientes}
          color="blue"
        />

        <Card
          icon={<FaClipboardList />}
          label="Pendências"
          value={resumo.pendenciasAbertas}
          color="yellow"
        />

        <Card
          icon={<FaArrowUp />}
          label="Receitas Clientes"
          value={formatarMoeda(resumo.receitas)}
          color="green"
        />

        <Card
          icon={<FaArrowDown />}
          label="Despesas Clientes"
          value={formatarMoeda(resumo.despesas)}
          color="red"
        />

        <Card
          icon={<FaWallet />}
          label="Saldo Consolidado"
          value={formatarMoeda(resumo.saldo)}
          color={resumo.saldo >= 0 ? "green" : "red"}
        />
      </div>

      <div className="db-grid">
        <div className="db-box">
          <div className="db-box-title">Últimas Pendências</div>

          <table className="db-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Categoria</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {ultimasPendencias.map((item) => (
                <tr key={item.id}>
                  <td>{item.cliente}</td>
                  <td>{item.categoria}</td>
                  <td>
                    <span
                      className={
                        item.status === "Concluída"
                          ? "status status-concluida"
                          : item.status === "Em análise"
                          ? "status status-analise"
                          : "status status-pendente"
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}

              {ultimasPendencias.length === 0 && (
                <tr>
                  <td colSpan="3" className="empty">
                    Nenhuma pendência registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="db-box">
          <div className="db-box-title">Últimos Movimentos</div>

          <table className="db-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th style={{ textAlign: "right" }}>Valor</th>
              </tr>
            </thead>

            <tbody>
              {ultimosMovimentos.map((item) => (
                <tr key={item.id}>
                  <td>{item.cliente}</td>

                  <td
                    className={
                      item.tipo === "Receita"
                        ? "tipo-receita"
                        : "tipo-despesa"
                    }
                  >
                    {item.tipo}
                  </td>

                  <td className="valor">
                    {formatarMoeda(item.valor)}
                  </td>
                </tr>
              ))}

              {ultimosMovimentos.length === 0 && (
                <tr>
                  <td colSpan="3" className="empty">
                    Nenhum movimento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="db-box">
        <div className="db-box-title">Resumo Operacional</div>

        <div className="db-operacional">
          <Mini title="Clientes ativos" value={resumo.totalClientes} color="blue" />
          <Mini title="Pendências abertas" value={resumo.pendenciasAbertas} color="yellow" />
          <Mini title="Movimentos cadastrados" value={resumo.totalMovimentos} color="green" />
          <Mini title="Saldo consolidado" value={formatarMoeda(resumo.saldo)} color={resumo.saldo >= 0 ? "green" : "red"} />
        </div>
      </div>
    </div>
  )
}

function Card({ icon, label, value, color }) {
  return (
    <div className="db-card">
      <div className={`db-icon ${color}`}>{icon}</div>

      <div>
        <span>{label}</span>
        <strong className={color}>{value}</strong>
      </div>
    </div>
  )
}

function Mini({ title, value, color }) {
  return (
    <div className="db-mini">
      <span>{title}</span>
      <strong className={color}>{value}</strong>
    </div>
  )
}