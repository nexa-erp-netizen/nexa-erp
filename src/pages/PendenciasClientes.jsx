import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { FaTrash, FaCheck, FaClock, FaEye } from "react-icons/fa"

export default function PendenciasClientes() {
  const [clientes, setClientes] = useState([])
  const [pendencias, setPendencias] = useState([])
  const [guiasFiscais, setGuiasFiscais] = useState([])
  const [detalhe, setDetalhe] = useState(null)

  const [form, setForm] = useState({
    cliente: "",
    titulo: "",
    categoria: "",
    mensagem: "",
    status: "Pendente",
  })

  function formatarData(data) {
    if (!data) return "-"
    return new Date(data).toLocaleDateString("pt-BR")
  }

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    const [clientesResp, pendenciasResp, fiscalResp] = await Promise.all([
      api.get("/clientes"),
      api.get("/solicitacoes-clientes"),
      api.get("/fiscal"),
    ])

    setClientes(Array.isArray(clientesResp.data) ? clientesResp.data : [])
    setPendencias(Array.isArray(pendenciasResp.data) ? pendenciasResp.data : [])
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    setGuiasFiscais((Array.isArray(fiscalResp.data) ? fiscalResp.data : []).filter((item) => {
      const status = String(item.status || "").trim().toLowerCase()
      const regularizada =
        status.includes("pago") ||
        status.includes("concluído") ||
        status.includes("concluido")

      if (regularizada || !item.vencimento) return false

      const vencimento = new Date(`${String(item.vencimento).slice(0, 10)}T00:00:00`)
      return !Number.isNaN(vencimento.getTime()) && vencimento < hoje
    }))

    const clienteSolicitado = localStorage.getItem("nexaFiltroPendenciaCliente")
    if (clienteSolicitado) {
      setForm((atual) => ({ ...atual, cliente: clienteSolicitado }))
      localStorage.removeItem("nexaFiltroPendenciaCliente")
    }
  }

  async function salvarPendencia() {
    if (!form.cliente || !form.titulo || !form.categoria) {
      alert("Preencha cliente, título e categoria.")
      return
    }

    await api.post("/solicitacoes-clientes", {
      ...form,
      anexos: [],
    })

    setForm({
      cliente: "",
      titulo: "",
      categoria: "",
      mensagem: "",
      status: "Pendente",
    })

    await carregarDados()
  }

  async function atualizarStatus(item, status) {
    await api.put(`/solicitacoes-clientes/${item.id}`, {
      ...item,
      status,
    })

    await carregarDados()
  }

  async function excluirPendencia(id) {
    if (!window.confirm("Deseja excluir esta solicitação?")) return

    await api.delete(`/solicitacoes-clientes/${id}`)
    await carregarDados()
  }

  const resumo = useMemo(() => {
    const pendentes = pendencias.filter(
      (item) => item.status === "Pendente"
    ).length

    const analise = pendencias.filter(
      (item) => item.status === "Em análise"
    ).length

    const respondidas = pendencias.filter(
      (item) => item.status === "Respondida"
    ).length

    const concluidas = pendencias.filter(
      (item) => item.status === "Concluída"
    ).length

    return {
      total: pendencias.length,
      pendentes,
      analise,
      respondidas,
      concluidas,
    }
  }, [pendencias])

  function situacaoGuia(item) {
    if (!item.vencimento) return "Em aberto"
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const vencimento = new Date(`${String(item.vencimento).slice(0, 10)}T00:00:00`)
    const dias = Math.ceil((vencimento - hoje) / 86400000)
    if (dias < 0) return `Vencida há ${Math.abs(dias)} dia(s)`
    if (dias === 0) return "Vence hoje"
    return `Vence em ${dias} dia(s)`
  }

  function valorGuia(valor) {
    if (String(valor || "").includes("R$")) return valor
    return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  return (
    <div className="pd-page">
      <style>{`
        .pd-page {
          padding: 30px;
          color: white;
        }

        .pd-title {
          font-size: 34px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .pd-subtitle {
          opacity: .8;
          margin-bottom: 25px;
        }

        .pd-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }

        .pd-guide-status { display: inline-block; border-radius: 999px; padding: 6px 9px; background: rgba(255,193,7,.16); color: #ffd65a; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .pd-guide-overdue { background: rgba(255,92,112,.15); color: #ff8c9a; }

        .pd-box {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 18px;
        }

        .pd-box span {
          display: block;
          opacity: .7;
          margin-bottom: 8px;
        }

        .pd-box strong { font-size: 20px; }

        .blue { color: #3cbcff; }
        .yellow { color: #ffc107; }
        .green { color: #32f06d; }
        .red { color: #ff5c70; }
        .purple { color: #c38cff; }

        .pd-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 25px;
        }

        .pd-card-title {
          font-size: 22px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .pd-form {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 14px;
        }

        .pd-input,
        .pd-select,
        .pd-textarea {
          width: 100%;
          background: #061f47;
          border: 1px solid rgba(255,255,255,.14);
          color: white;
          border-radius: 12px;
          padding: 0 14px;
          box-sizing: border-box;
          outline: none;
          font-size: 14px;
        }

        .pd-input,
        .pd-select { height: 48px; }

        .pd-textarea {
          grid-column: 1 / -1;
          min-height: 90px;
          padding-top: 14px;
          resize: vertical;
        }

        .pd-select option {
          background: #061f47;
          color: white;
        }

        .pd-btn {
          grid-column: 1 / -1;
          height: 52px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
        }

        .pd-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .pd-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .pd-table th {
          color: #6bd8ff;
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          font-size: 13px;
        }

        .pd-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,.05);
          font-size: 14px;
        }

        .pd-table th:nth-child(1),
        .pd-table td:nth-child(1) { width: 180px; }

        .pd-table th:nth-child(4),
        .pd-table td:nth-child(4) { width: 120px; }

        .pd-table th:nth-child(5),
        .pd-table td:nth-child(5) { width: 120px; }

        .pd-table th:nth-child(6),
        .pd-table td:nth-child(6) { width: 120px; }

        .status {
          padding: 6px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          display: inline-block;
          white-space: nowrap;
        }

        .status-pendente {
          background: rgba(255,193,7,.15);
          color: #ffc107;
        }

        .status-analise {
          background: rgba(60,188,255,.15);
          color: #3cbcff;
        }

        .status-respondida {
          background: rgba(170,100,255,.15);
          color: #c38cff;
        }

        .status-concluida {
          background: rgba(50,240,109,.15);
          color: #32f06d;
        }

        .pd-actions {
          display: flex;
          gap: 8px;
        }

        .pd-icon-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }

        .btn-check {
          background: #32f06d;
          color: #00112b;
        }

        .btn-clock {
          background: #3cbcff;
          color: #00112b;
        }

        .btn-trash {
          background: #ff5c70;
          color: white;
        }

        .empty {
          opacity: .7;
          padding: 18px;
        }

        .modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 18px;
        }

        .modal {
          width: 100%;
          max-width: 650px;
          background: #061f47;
          border-radius: 24px;
          padding: 24px;
          border: 1px solid rgba(255,255,255,.12);
        }

        .modal h2 { margin-top: 0; }
        .modal p { line-height: 24px; }

        .modal-close {
          width: 100%;
          height: 48px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(90deg,#17b8ff,#32f06d);
          color: #00112b;
          font-weight: 900;
          cursor: pointer;
        }

        @media (max-width: 900px) {
          .pd-page { padding: 16px; }
          .pd-summary { grid-template-columns: 1fr 1fr; }
          .pd-form { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="pd-title">Solicitações Clientes</div>

      <div className="pd-subtitle">
        Controle de solicitações enviadas aos clientes
      </div>

      <div className="pd-summary">
        <div className="pd-box">
          <span>Total</span>
          <strong className="blue">{resumo.total}</strong>
        </div>

        <div className="pd-box">
          <span>Pendentes</span>
          <strong className="yellow">{resumo.pendentes}</strong>
        </div>

        <div className="pd-box">
          <span>Em análise</span>
          <strong className="blue">{resumo.analise}</strong>
        </div>

        <div className="pd-box">
          <span>Concluídas</span>
          <strong className="green">{resumo.concluidas}</strong>
        </div>
      </div>

      <div className="pd-card">
        <div className="pd-card-title">Guias e obrigações vencidas ({guiasFiscais.length})</div>
        <div className="pd-table-wrapper">
          <table className="pd-table">
            <thead><tr><th>Cliente</th><th>Obrigação</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {guiasFiscais.map((item) => {
                const situacao = situacaoGuia(item)
                return <tr key={`fiscal-${item.id}`}><td>{item.cliente}</td><td>{item.obrigacao || item.descricao || "Guia fiscal"}</td><td>{item.competencia || "-"}</td><td>{formatarData(String(item.vencimento || "").slice(0, 10))}</td><td>{valorGuia(item.valor)}</td><td><span className={`pd-guide-status ${situacao.startsWith("Vencida") ? "pd-guide-overdue" : ""}`}>{situacao}</span></td></tr>
              })}
              {!guiasFiscais.length && <tr><td colSpan="6" className="empty">Nenhuma guia ou obrigação vencida.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pd-card">
        <div className="pd-card-title">Nova Solicitação</div>

        <div className="pd-form">
          <select
            className="pd-select"
            value={form.cliente}
            onChange={(e) => setForm({ ...form, cliente: e.target.value })}
          >
            <option value="">Selecione o cliente</option>

            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.nome}>
                {cliente.nome}
              </option>
            ))}
          </select>

          <input
            className="pd-input"
            placeholder="Título da solicitação"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          />

          <select
            className="pd-select"
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          >
            <option value="">Categoria</option>
            <option value="Documento">Documento</option>
            <option value="Fiscal">Fiscal</option>
            <option value="Financeiro">Financeiro</option>
            <option value="Nota Fiscal">Nota Fiscal</option>
            <option value="Honorários">Honorários</option>
            <option value="Outros">Outros</option>
          </select>

          <textarea
            className="pd-textarea"
            placeholder="Mensagem para o cliente"
            value={form.mensagem}
            onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
          />

          <button className="pd-btn" onClick={salvarPendencia}>
            Criar Solicitação
          </button>
        </div>
      </div>

      <div className="pd-card">
        <div className="pd-card-title">Solicitações Registradas</div>

        <div className="pd-table-wrapper">
          <table className="pd-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Título</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {pendencias.map((item) => (
                <tr key={item.id}>
                  <td>{item.cliente}</td>
                  <td>{item.titulo}</td>
                  <td>{item.categoria}</td>

                  <td>
                    <span
                      className={
                        item.status === "Concluída"
                          ? "status status-concluida"
                          : item.status === "Em análise"
                          ? "status status-analise"
                          : item.status === "Respondida"
                          ? "status status-respondida"
                          : "status status-pendente"
                      }
                    >
                      {item.status}
                    </span>
                  </td>

                  <td>{formatarData(item.createdAt?.slice(0, 10))}</td>

                  <td>
                    <div className="pd-actions">
                      <button
                        className="pd-icon-btn"
                        style={{ background: "#ffc107", color: "#00112b" }}
                        title="Visualizar"
                        onClick={() => setDetalhe(item)}
                      >
                        <FaEye />
                      </button>

                      <button
                        className="pd-icon-btn btn-clock"
                        title="Em análise"
                        onClick={() => atualizarStatus(item, "Em análise")}
                      >
                        <FaClock />
                      </button>

                      <button
                        className="pd-icon-btn btn-check"
                        title="Concluir"
                        onClick={() => atualizarStatus(item, "Concluída")}
                      >
                        <FaCheck />
                      </button>

                      <button
                        className="pd-icon-btn btn-trash"
                        title="Excluir"
                        onClick={() => excluirPendencia(item.id)}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {pendencias.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty">
                    Nenhuma solicitação registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detalhe && (
        <div className="modal-bg">
          <div className="modal">
            <h2>{detalhe.titulo}</h2>

            <p>
              <strong>Cliente:</strong> {detalhe.cliente}
            </p>

            <p>
              <strong>Categoria:</strong> {detalhe.categoria}
            </p>

            <p>
              <strong>Status:</strong> {detalhe.status}
            </p>

            <p>
              <strong>Mensagem:</strong>
              <br />
              {detalhe.mensagem}
            </p>

            <hr />

            <p>
              <strong>Resposta do Cliente:</strong>
            </p>

            <p>
              {detalhe.respostaCliente || "Cliente ainda não respondeu."}
            </p>

            {detalhe.dataResposta && (
              <p>
                <strong>Respondido em:</strong>{" "}
                {new Date(detalhe.dataResposta).toLocaleString("pt-BR")}
              </p>
            )}

            <button className="modal-close" onClick={() => setDetalhe(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
