import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function formularioVazio() {
  const data = hoje()
  return {
    servicoId: "",
    descricao: "",
    quantidade: 1,
    valorUnitario: "",
    desconto: "",
    data,
    vencimento: data,
    status: "Pendente",
    formaPagamento: "PIX",
    observacao: "",
  }
}

function numeroSeguro(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0
  if (valor === null || valor === undefined || valor === "") return 0

  let texto = String(valor).replace("R$", "").replace(/\s/g, "").trim()
  if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".")
  else texto = texto.replace(/[^0-9.-]/g, "")

  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : 0
}

function formatarMoeda(valor) {
  return numeroSeguro(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function valorParaCampo(valor) {
  if (valor === null || valor === undefined || valor === "") return ""
  return numeroSeguro(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatarData(valor) {
  if (!valor) return "-"
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor
}

function statusVisual(item) {
  const status = String(item?.status || "Pendente")
  if (status === "Recebido" || status === "Cancelado") return status
  if (item?.vencimento && String(item.vencimento).slice(0, 10) < hoje()) return "Atrasado"
  return "Pendente"
}

export default function ServicosCobrancasCliente({ cliente, onAtualizado }) {
  const [catalogo, setCatalogo] = useState([])
  const [registros, setRegistros] = useState([])
  const [form, setForm] = useState(formularioVazio)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [cobrancaDestacadaId, setCobrancaDestacadaId] = useState(null)

  const clienteId = cliente?.id

  useEffect(() => {
    if (!clienteId) return
    setForm(formularioVazio())
    setEditandoId(null)
    carregarTudo()
  }, [clienteId])

  useEffect(() => {
    const cobrancaId = localStorage.getItem("nexaAbrirCobrancaId")
    const cobranca = registros.find((item) => (
      String(item.id) === String(cobrancaId)
      || String(item.financeiroId) === String(cobrancaId)
    ))
    if (!cobrancaId || !cobranca) return

    setCobrancaDestacadaId(String(cobranca.id))
    localStorage.removeItem("nexaAbrirCobrancaId")
    setTimeout(() => {
      document.querySelector(`[data-cobranca-id="${cobranca.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 180)
  }, [registros])

  async function carregarTudo() {
    if (!clienteId) return
    setCarregando(true)

    try {
      const [resCatalogo] = await Promise.all([
        api.get("/servicos"),
        api.post("/servicos-avulsos/sincronizar-financeiro", { clienteId }),
      ])

      const resRegistros = await api.get("/servicos-avulsos", {
        params: { clienteId },
      })

      setCatalogo(Array.isArray(resCatalogo.data) ? resCatalogo.data : [])
      setRegistros(Array.isArray(resRegistros.data) ? resRegistros.data : [])
    } catch (error) {
      console.error("Erro ao carregar serviços e cobranças:", error)
      alert(error.response?.data?.message || "Erro ao carregar serviços e cobranças.")
    } finally {
      setCarregando(false)
    }
  }

  function atualizar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function selecionarServico(servicoId) {
    const servico = catalogo.find((item) => String(item.id) === String(servicoId))

    if (!servico) {
      setForm((atual) => ({ ...atual, servicoId: "" }))
      return
    }

    setForm((atual) => ({
      ...atual,
      servicoId: String(servico.id),
      descricao: servico.nome || atual.descricao,
      valorUnitario: servico.valor ? valorParaCampo(servico.valor) : atual.valorUnitario,
    }))
  }

  const quantidade = Math.max(1, Math.trunc(Number(form.quantidade) || 1))
  const valorUnitario = Math.max(0, numeroSeguro(form.valorUnitario))
  const subtotal = quantidade * valorUnitario
  const desconto = Math.min(Math.max(0, numeroSeguro(form.desconto)), subtotal)
  const total = Math.max(0, subtotal - desconto)

  const resumo = useMemo(() => {
    const ativos = registros.filter((item) => statusVisual(item) !== "Cancelado")
    const pendentes = ativos.filter((item) => ["Pendente", "Atrasado"].includes(statusVisual(item)))
    const atrasados = pendentes.filter((item) => statusVisual(item) === "Atrasado")
    const recebidos = ativos.filter((item) => statusVisual(item) === "Recebido")

    return {
      pendentes: pendentes.length,
      atrasados: atrasados.length,
      recebidos: recebidos.length,
      totalPendente: pendentes.reduce((soma, item) => soma + numeroSeguro(item.valorTotal), 0),
    }
  }, [registros])

  async function salvar() {
    if (!clienteId) return
    if (!form.descricao.trim()) {
      alert("Informe o serviço realizado.")
      return
    }
    if (total <= 0) {
      alert("O valor final deve ser maior que zero.")
      return
    }
    if (!form.data || !form.vencimento) {
      alert("Informe a data do serviço e o vencimento.")
      return
    }

    setSalvando(true)

    const payload = {
      clienteId,
      servicoId: form.servicoId || null,
      descricao: form.descricao.trim(),
      quantidade,
      valorUnitario,
      desconto,
      data: form.data,
      vencimento: form.vencimento,
      status: form.status,
      formaPagamento: form.formaPagamento,
      observacao: form.observacao.trim(),
      dataRecebimento: form.status === "Recebido" ? hoje() : null,
    }

    try {
      if (editandoId) await api.put(`/servicos-avulsos/${editandoId}`, payload)
      else await api.post("/servicos-avulsos", payload)

      setForm(formularioVazio())
      setEditandoId(null)
      await carregarTudo()
      await onAtualizado?.()
    } catch (error) {
      console.error("Erro ao salvar serviço e cobrança:", error)
      alert(error.response?.data?.message || "Erro ao salvar serviço e cobrança.")
    } finally {
      setSalvando(false)
    }
  }

  function corrigir(item) {
    setEditandoId(item.id)
    setForm({
      servicoId: item.servicoId ? String(item.servicoId) : "",
      descricao: item.descricao || "",
      quantidade: item.quantidade || 1,
      valorUnitario: valorParaCampo(item.valorUnitario),
      desconto: valorParaCampo(item.desconto),
      data: item.data || hoje(),
      vencimento: item.vencimento || item.data || hoje(),
      status: item.status || "Pendente",
      formaPagamento: item.formaPagamento || "PIX",
      observacao: item.observacao || "",
    })

    document.getElementById("central-servicos")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm(formularioVazio())
  }

  async function alterarStatus(item, status) {
    const mensagem = status === "Recebido"
      ? `Confirmar o recebimento de ${formatarMoeda(item.valorTotal)}?`
      : status === "Cancelado"
        ? "Cancelar esta cobrança? Ela será retirada do Financeiro do Escritório."
        : "Marcar esta cobrança como pendente?"

    if (!window.confirm(mensagem)) return

    try {
      await api.put(`/servicos-avulsos/${item.id}`, {
        status,
        dataRecebimento: status === "Recebido" ? hoje() : null,
      })
      await carregarTudo()
      await onAtualizado?.()
    } catch (error) {
      console.error("Erro ao alterar status:", error)
      alert(error.response?.data?.message || "Erro ao alterar o status.")
    }
  }

  async function excluir(item) {
    if (!window.confirm(`Excluir o serviço “${item.descricao}”?`)) return

    try {
      await api.delete(`/servicos-avulsos/${item.id}`)
      await carregarTudo()
      await onAtualizado?.()
    } catch (error) {
      console.error("Erro ao excluir serviço e cobrança:", error)
      alert(error.response?.data?.message || "Erro ao excluir o registro.")
    }
  }

  return (
    <div>
      <div style={resumoGrid}>
        <Resumo label="Pendentes" value={resumo.pendentes} cor="#ffd54a" />
        <Resumo label="Em atraso" value={resumo.atrasados} cor="#ff6576" />
        <Resumo label="Recebidos" value={resumo.recebidos} cor="#37f07a" />
        <Resumo label="Total a receber" value={formatarMoeda(resumo.totalPendente)} cor="#4cc9ff" />
      </div>

      <div style={formBox}>
        <div style={formTitulo}>
          <div>
            <strong>{editandoId ? "Corrigir serviço e cobrança" : "Registrar serviço e cobrança"}</strong>
            <small>O valor entra automaticamente no Financeiro do Escritório e não altera a contabilidade do cliente.</small>
          </div>
          {editandoId && <button type="button" style={botaoSecundario} onClick={cancelarEdicao}>Cancelar edição</button>}
        </div>

        <div style={formGrid}>
          <label style={campoGrande}>
            <span style={label}>Serviço</span>
            <select style={input} value={form.servicoId} onChange={(e) => selecionarServico(e.target.value)}>
              <option value="">Selecione ou digite abaixo</option>
              {catalogo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>

          <label style={campoGrande}>
            <span style={label}>Descrição do serviço</span>
            <input style={input} value={form.descricao} onChange={(e) => atualizar("descricao", e.target.value)} placeholder="Ex.: Declaração MEI" />
          </label>

          <label style={campo}>
            <span style={label}>Quantidade</span>
            <input style={input} type="number" min="1" value={form.quantidade} onChange={(e) => atualizar("quantidade", e.target.value)} />
          </label>

          <label style={campo}>
            <span style={label}>Valor unitário</span>
            <input style={input} value={form.valorUnitario} onChange={(e) => atualizar("valorUnitario", e.target.value)} placeholder="0,00" />
          </label>

          <label style={campo}>
            <span style={label}>Desconto total</span>
            <input style={input} value={form.desconto} onChange={(e) => atualizar("desconto", e.target.value)} placeholder="0,00" />
          </label>

          <label style={campo}>
            <span style={label}>Data do serviço</span>
            <input style={input} type="date" value={form.data} onChange={(e) => atualizar("data", e.target.value)} />
          </label>

          <label style={campo}>
            <span style={label}>Vencimento</span>
            <input style={input} type="date" value={form.vencimento} onChange={(e) => atualizar("vencimento", e.target.value)} />
          </label>

          <label style={campo}>
            <span style={label}>Forma</span>
            <select style={input} value={form.formaPagamento} onChange={(e) => atualizar("formaPagamento", e.target.value)}>
              <option value="PIX">PIX</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Boleto">Boleto</option>
              <option value="Cartão">Cartão</option>
              <option value="Transferência">Transferência</option>
              <option value="">Não informada</option>
            </select>
          </label>

          <label style={campo}>
            <span style={label}>Status inicial</span>
            <select style={input} value={form.status} onChange={(e) => atualizar("status", e.target.value)}>
              <option value="Pendente">Pendente</option>
              <option value="Recebido">Recebido</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </label>

          <label style={campoTotal}>
            <span style={label}>Subtotal</span>
            <strong style={totalSecundario}>{formatarMoeda(subtotal)}</strong>
          </label>

          <label style={campoTotal}>
            <span style={label}>Total final</span>
            <strong style={totalDestaque}>{formatarMoeda(total)}</strong>
          </label>

          <label style={campoObservacao}>
            <span style={label}>Observação</span>
            <input style={input} value={form.observacao} onChange={(e) => atualizar("observacao", e.target.value)} placeholder="Opcional" />
          </label>
        </div>

        <button type="button" style={botaoSalvar} disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando..." : editandoId ? "Salvar correção" : "Registrar e lançar no Financeiro"}
        </button>
      </div>

      <div style={historicoTopo}>
        <strong>Histórico de serviços e cobranças</strong>
        {carregando && <span>Atualizando...</span>}
      </div>

      <div style={tabelaWrapper}>
        <table style={tabela}>
          <thead>
            <tr>
              <th style={th}>Serviço</th>
              <th style={th}>Data</th>
              <th style={th}>Vencimento</th>
              <th style={th}>Qtd.</th>
              <th style={th}>Total</th>
              <th style={th}>Status</th>
              <th style={th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {!carregando && registros.length === 0 && (
              <tr><td style={vazio} colSpan="7">Nenhum serviço registrado para este cliente.</td></tr>
            )}

            {registros.map((item) => {
              const status = statusVisual(item)
              return (
                <tr
                  key={item.id}
                  data-cobranca-id={item.id}
                  style={String(cobrancaDestacadaId) === String(item.id) ? linhaDestacada : undefined}
                >
                  <td style={td}>
                    <strong>{item.descricao}</strong>
                    {item.observacao && <small style={observacaoTabela}>{item.observacao}</small>}
                  </td>
                  <td style={td}>{formatarData(item.data)}</td>
                  <td style={td}>{formatarData(item.vencimento || item.data)}</td>
                  <td style={td}>{item.quantidade || 1}</td>
                  <td style={tdValor}>{formatarMoeda(item.valorTotal)}</td>
                  <td style={td}><span style={badgeStatus(status)}>{status}</span></td>
                  <td style={td}>
                    <div style={acoes}>
                      {status !== "Pendente" && status !== "Atrasado" && <button style={botaoPendente} onClick={() => alterarStatus(item, "Pendente")}>Pendente</button>}
                      {status !== "Recebido" && <button style={botaoRecebido} onClick={() => alterarStatus(item, "Recebido")}>Recebido</button>}
                      {status !== "Cancelado" && <button style={botaoCancelar} onClick={() => alterarStatus(item, "Cancelado")}>Cancelar</button>}
                      <button style={botaoCorrigir} onClick={() => corrigir(item)}>Corrigir</button>
                      <button style={botaoExcluir} onClick={() => excluir(item)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Resumo({ label: texto, value, cor }) {
  return (
    <div style={resumoCard}>
      <span>{texto}</span>
      <strong style={{ color: cor }}>{value}</strong>
    </div>
  )
}

function badgeStatus(status) {
  const base = { display: "inline-block", padding: "7px 11px", borderRadius: "999px", fontSize: "12px", fontWeight: 900 }
  if (status === "Recebido") return { ...base, color: "#37f07a", background: "rgba(55,240,122,.14)" }
  if (status === "Atrasado") return { ...base, color: "#ff6576", background: "rgba(255,101,118,.14)" }
  if (status === "Cancelado") return { ...base, color: "#b8c5d8", background: "rgba(184,197,216,.12)" }
  return { ...base, color: "#ffd54a", background: "rgba(255,213,74,.14)" }
}

const resumoGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "18px" }
const resumoCard = { background: "#082957", border: "1px solid rgba(255,255,255,.08)", borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "7px" }
const formBox = { background: "#06234d", border: "1px solid rgba(255,255,255,.08)", borderRadius: "16px", padding: "18px", marginBottom: "18px" }
const formTitulo = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }
const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", alignItems: "end" }
const campo = { display: "flex", flexDirection: "column", gap: "6px" }
const campoGrande = { ...campo, gridColumn: "span 2" }
const campoObservacao = { ...campo, gridColumn: "1 / -1" }
const campoTotal = { ...campo, minHeight: "62px", justifyContent: "center", background: "rgba(255,255,255,.04)", borderRadius: "12px", padding: "8px 12px" }
const label = { fontSize: "12px", fontWeight: 800, color: "#a9bdd8" }
const input = { width: "100%", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.14)", borderRadius: "10px", padding: "11px 12px", background: "#082957", color: "white", outline: "none" }
const totalSecundario = { fontSize: "17px", color: "#d7e6f7" }
const totalDestaque = { fontSize: "21px", color: "#37f07a" }
const botaoSalvar = { width: "100%", border: "none", borderRadius: "12px", padding: "13px 16px", marginTop: "15px", background: "linear-gradient(90deg,#16c7ff,#37ef7a)", color: "#00142f", fontWeight: 900, cursor: "pointer" }
const botaoSecundario = { border: "1px solid rgba(255,255,255,.18)", borderRadius: "10px", padding: "9px 12px", background: "#082957", color: "white", fontWeight: 800, cursor: "pointer" }
const historicoTopo = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", margin: "4px 0 10px" }
const tabelaWrapper = { overflowX: "auto" }
const tabela = { width: "100%", borderCollapse: "collapse", minWidth: "900px" }
const th = { padding: "11px 9px", textAlign: "left", color: "#65d9ff", fontSize: "12px", borderBottom: "1px solid rgba(255,255,255,.1)" }
const td = { padding: "11px 9px", borderBottom: "1px solid rgba(255,255,255,.07)", verticalAlign: "top", fontSize: "13px" }
const tdValor = { ...td, color: "#37f07a", fontWeight: 900 }
const vazio = { ...td, textAlign: "center", color: "#b9c7d8", padding: "22px" }
const observacaoTabela = { display: "block", color: "#a9bdd8", marginTop: "5px", fontWeight: 400 }
const linhaDestacada = { background: "rgba(255, 193, 7, .18)", outline: "2px solid #ffc107", outlineOffset: "-2px" }
const acoes = { display: "flex", flexWrap: "wrap", gap: "6px" }
const botaoBase = { border: "none", borderRadius: "8px", padding: "7px 9px", fontSize: "11px", fontWeight: 900, cursor: "pointer" }
const botaoPendente = { ...botaoBase, background: "#ffd54a", color: "#3b2d00" }
const botaoRecebido = { ...botaoBase, background: "#37f07a", color: "#003718" }
const botaoCancelar = { ...botaoBase, background: "#7f8da3", color: "white" }
const botaoCorrigir = { ...botaoBase, background: "#23bfff", color: "#002844" }
const botaoExcluir = { ...botaoBase, background: "#ff6576", color: "white" }
