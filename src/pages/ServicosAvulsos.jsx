import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

function dataHoje() {
  return new Date().toISOString().slice(0, 10)
}

function formularioVazio() {
  return {
    clienteId: "",
    servicoId: "",
    descricao: "",
    quantidade: 1,
    valorUnitario: "",
    desconto: "",
    data: dataHoje(),
    status: "Recebido",
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

function formatarCampoMoeda(valor) {
  const numeros = String(valor || "").replace(/\D/g, "")
  const numero = Number(numeros || 0) / 100
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function formatarData(valor) {
  if (!valor) return "-"
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor
}

function codigoCliente(id) {
  const numero = Number(id)
  return Number.isInteger(numero) && numero > 0
    ? `CLI-${String(numero).padStart(4, "0")}`
    : ""
}

export default function ServicosAvulsos() {
  const [clientes, setClientes] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [registros, setRegistros] = useState([])
  const [form, setForm] = useState(formularioVazio)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [clienteFiltro, setClienteFiltro] = useState("")

  useEffect(() => {
    const clienteIdVoz = localStorage.getItem("nexaFiltroServicosAvulsosClienteId") || ""
    const clienteNomeVoz = localStorage.getItem("nexaFiltroServicosAvulsosCliente") || ""

    carregarTudo().then((dados) => {
      if (clienteIdVoz) {
        setClienteFiltro(clienteIdVoz)
        setForm((atual) => ({ ...atual, clienteId: clienteIdVoz }))
      } else if (clienteNomeVoz && Array.isArray(dados?.clientes)) {
        const encontrado = dados.clientes.find(
          (item) => String(item.nome || "").trim().toLowerCase() === clienteNomeVoz.trim().toLowerCase()
        )
        if (encontrado) {
          setClienteFiltro(String(encontrado.id))
          setForm((atual) => ({ ...atual, clienteId: String(encontrado.id) }))
        }
      }

      localStorage.removeItem("nexaFiltroServicosAvulsosClienteId")
      localStorage.removeItem("nexaFiltroServicosAvulsosCliente")
    })
  }, [])

  async function carregarTudo() {
    try {
      const [resClientes, resCatalogo, resRegistros] = await Promise.all([
        api.get("/clientes"),
        api.get("/servicos"),
        api.get("/servicos-avulsos"),
      ])

      const dados = {
        clientes: Array.isArray(resClientes.data) ? resClientes.data : [],
        catalogo: Array.isArray(resCatalogo.data) ? resCatalogo.data : [],
        registros: Array.isArray(resRegistros.data) ? resRegistros.data : [],
      }

      setClientes(dados.clientes)
      setCatalogo(dados.catalogo)
      setRegistros(dados.registros)
      return dados
    } catch (error) {
      console.error("Erro ao carregar serviços avulsos:", error)
      alert("Erro ao carregar os serviços avulsos.")
      return null
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
      valorUnitario: servico.valor ? formatarMoeda(servico.valor) : atual.valorUnitario,
    }))
  }

  const quantidade = Math.max(1, Math.trunc(Number(form.quantidade) || 1))
  const subtotal = quantidade * numeroSeguro(form.valorUnitario)
  const desconto = Math.min(Math.max(0, numeroSeguro(form.desconto)), subtotal)
  const total = Math.max(0, subtotal - desconto)

  async function salvar(e) {
    e.preventDefault()

    if (!form.clienteId || !form.descricao.trim() || total <= 0 || !form.data) {
      alert("Preencha cliente, serviço, quantidade, valor unitário e data.")
      return
    }

    const payload = {
      clienteId: Number(form.clienteId),
      servicoId: form.servicoId ? Number(form.servicoId) : null,
      descricao: form.descricao.trim(),
      quantidade,
      valorUnitario: numeroSeguro(form.valorUnitario),
      desconto,
      data: form.data,
      status: form.status,
      formaPagamento: form.formaPagamento,
      observacao: form.observacao.trim(),
    }

    setSalvando(true)

    try {
      if (editandoId) await api.put(`/servicos-avulsos/${editandoId}`, payload)
      else await api.post("/servicos-avulsos", payload)

      limparFormulario()
      await carregarTudo()
    } catch (error) {
      console.error("Erro ao salvar serviço avulso:", error)
      alert(error?.response?.data?.message || "Erro ao salvar o serviço avulso.")
    } finally {
      setSalvando(false)
    }
  }

  function editar(item) {
    setEditandoId(item.id)
    setForm({
      clienteId: String(item.clienteId || ""),
      servicoId: item.servicoId ? String(item.servicoId) : "",
      descricao: item.descricao || "",
      quantidade: item.quantidade || 1,
      valorUnitario: formatarMoeda(item.valorUnitario),
      desconto: numeroSeguro(item.desconto) > 0 ? formatarMoeda(item.desconto) : "",
      data: item.data || dataHoje(),
      status: item.status || "Recebido",
      formaPagamento: item.formaPagamento || "PIX",
      observacao: item.observacao || "",
    })

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function excluir(item) {
    const confirmar = window.confirm(
      `Excluir o serviço "${item.descricao}"? A receita vinculada também será removida do Financeiro.`
    )
    if (!confirmar) return

    try {
      await api.delete(`/servicos-avulsos/${item.id}`)
      if (String(editandoId) === String(item.id)) limparFormulario()
      await carregarTudo()
    } catch (error) {
      console.error("Erro ao excluir serviço avulso:", error)
      alert(error?.response?.data?.message || "Erro ao excluir o serviço avulso.")
    }
  }

  function limparFormulario() {
    setEditandoId(null)
    setForm(formularioVazio())
  }

  const registrosFiltrados = useMemo(() => {
    return registros.filter((item) => {
      const bateCompetencia = !competencia || String(item.data || "").slice(0, 7) === competencia
      const bateCliente = !clienteFiltro || String(item.clienteId) === String(clienteFiltro)
      return bateCompetencia && bateCliente
    })
  }, [registros, competencia, clienteFiltro])

  const resumo = useMemo(() => {
    return registrosFiltrados.reduce(
      (acumulado, item) => {
        const valor = numeroSeguro(item.valorTotal)
        acumulado.total += valor
        acumulado.quantidade += Number(item.quantidade || 0)
        if (item.status === "Recebido") acumulado.recebido += valor
        else acumulado.pendente += valor
        return acumulado
      },
      { total: 0, recebido: 0, pendente: 0, quantidade: 0 }
    )
  }, [registrosFiltrados])

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Serviços Avulsos</h2>
          <p style={styles.subtitle}>
            Registre trabalhos feitos pelo escritório. O valor entra automaticamente no Financeiro e somente o histórico é gravado no cliente.
          </p>
        </div>
      </div>

      <div style={styles.cards}>
        <Resumo titulo="Serviços realizados" valor={String(registrosFiltrados.length)} />
        <Resumo titulo="Itens entregues" valor={String(resumo.quantidade)} />
        <Resumo titulo="Recebido" valor={formatarMoeda(resumo.recebido)} destaque="#37ff74" />
        <Resumo titulo="A receber" valor={formatarMoeda(resumo.pendente)} destaque="#ffd166" />
      </div>

      <form style={styles.formCard} onSubmit={salvar}>
        <div style={styles.formTop}>
          <div>
            <h3 style={styles.sectionTitle}>{editandoId ? "Corrigir serviço avulso" : "Novo serviço avulso"}</h3>
            <p style={styles.help}>Este registro não altera a contabilidade nem a DRE do cliente.</p>
          </div>
          {editandoId && <button type="button" style={styles.secondaryButton} onClick={limparFormulario}>Cancelar correção</button>}
        </div>

        <div style={styles.grid}>
          <label style={styles.field}>
            <span>Cliente</span>
            <select style={styles.input} value={form.clienteId} onChange={(e) => atualizar("clienteId", e.target.value)}>
              <option value="">Selecione o cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {codigoCliente(cliente.id)} — {cliente.nome}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span>Serviço cadastrado</span>
            <select style={styles.input} value={form.servicoId} onChange={(e) => selecionarServico(e.target.value)}>
              <option value="">Outro serviço / digitar manualmente</option>
              {catalogo.map((servico) => (
                <option key={servico.id} value={servico.id}>{servico.nome}</option>
              ))}
            </select>
          </label>

          <label style={styles.fieldWide}>
            <span>Descrição do serviço</span>
            <input style={styles.input} value={form.descricao} placeholder="Ex: Declaração MEI" onChange={(e) => atualizar("descricao", e.target.value)} />
          </label>

          <label style={styles.field}>
            <span>Quantidade</span>
            <input style={styles.input} type="number" min="1" step="1" value={form.quantidade} onChange={(e) => atualizar("quantidade", e.target.value)} />
          </label>

          <label style={styles.field}>
            <span>Valor unitário</span>
            <input style={styles.input} value={form.valorUnitario} placeholder="R$ 0,00" onChange={(e) => atualizar("valorUnitario", formatarCampoMoeda(e.target.value))} />
          </label>

          <label style={styles.field}>
            <span>Desconto total</span>
            <input style={styles.input} value={form.desconto} placeholder="R$ 0,00" onChange={(e) => atualizar("desconto", formatarCampoMoeda(e.target.value))} />
          </label>

          <label style={styles.field}>
            <span>Data</span>
            <input style={styles.input} type="date" value={form.data} onChange={(e) => atualizar("data", e.target.value)} />
          </label>

          <label style={styles.field}>
            <span>Status</span>
            <select style={styles.input} value={form.status} onChange={(e) => atualizar("status", e.target.value)}>
              <option value="Recebido">Recebido</option>
              <option value="Pendente">Pendente</option>
            </select>
          </label>

          <label style={styles.field}>
            <span>Forma de pagamento</span>
            <select style={styles.input} value={form.formaPagamento} onChange={(e) => atualizar("formaPagamento", e.target.value)}>
              <option value="PIX">PIX</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão">Cartão</option>
              <option value="Boleto">Boleto</option>
              <option value="Transferência">Transferência</option>
              <option value="">Não informado</option>
            </select>
          </label>

          <label style={styles.fieldWide}>
            <span>Observação</span>
            <input style={styles.input} value={form.observacao} placeholder="Opcional" onChange={(e) => atualizar("observacao", e.target.value)} />
          </label>
        </div>

        <div style={styles.calculo}>
          <div style={styles.calculoItem}><span>Subtotal</span><strong>{formatarMoeda(subtotal)}</strong></div>
          <div style={styles.calculoItem}><span>Desconto</span><strong>{formatarMoeda(desconto)}</strong></div>
          <div style={{ ...styles.calculoItem, ...styles.totalBox }}><span>Valor final</span><strong>{formatarMoeda(total)}</strong></div>
        </div>

        <button type="submit" style={styles.primaryButton} disabled={salvando}>
          {salvando ? "Salvando..." : editandoId ? "Salvar correção" : "Registrar serviço e lançar no Financeiro"}
        </button>
      </form>

      <section style={styles.listCard}>
        <div style={styles.listHeader}>
          <div>
            <h3 style={styles.sectionTitle}>Histórico de serviços avulsos</h3>
            <p style={styles.help}>A origem aparece no Financeiro como “Serviço Avulso”.</p>
          </div>

          <div style={styles.filters}>
            <input style={styles.filterInput} type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            <select style={styles.filterInput} value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)}>
              <option value="">Todos os clientes</option>
              {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Data</th>
                <th style={styles.th}>Cliente</th>
                <th style={styles.th}>Serviço</th>
                <th style={styles.th}>Qtd.</th>
                <th style={styles.th}>Unitário</th>
                <th style={styles.th}>Desconto</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.length === 0 && (
                <tr><td style={styles.empty} colSpan="9">Nenhum serviço avulso nesta competência.</td></tr>
              )}
              {registrosFiltrados.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>{formatarData(item.data)}</td>
                  <td style={styles.td}><strong>{item.cliente}</strong><small style={styles.code}>{codigoCliente(item.clienteId)}</small></td>
                  <td style={styles.td}>{item.descricao}</td>
                  <td style={styles.td}>{item.quantidade}</td>
                  <td style={styles.td}>{formatarMoeda(item.valorUnitario)}</td>
                  <td style={styles.td}>{formatarMoeda(item.desconto)}</td>
                  <td style={styles.totalCell}>{formatarMoeda(item.valorTotal)}</td>
                  <td style={styles.td}><span style={item.status === "Recebido" ? styles.received : styles.pending}>{item.status}</span></td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button type="button" style={styles.editButton} onClick={() => editar(item)}>Corrigir</button>
                      <button type="button" style={styles.deleteButton} onClick={() => excluir(item)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Resumo({ titulo, valor, destaque = "white" }) {
  return (
    <div style={styles.summaryCard}>
      <span>{titulo}</span>
      <strong style={{ color: destaque }}>{valor}</strong>
    </div>
  )
}

const styles = {
  page: { padding: "28px", color: "white" },
  header: { display: "flex", justifyContent: "space-between", gap: "20px", marginBottom: "20px" },
  title: { margin: 0, fontSize: "28px" },
  subtitle: { margin: "7px 0 0", color: "#a9b8cc", maxWidth: "850px", lineHeight: 1.5 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" },
  summaryCard: { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "18px", padding: "18px", display: "flex", flexDirection: "column", gap: "8px" },
  formCard: { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: "22px", padding: "22px", marginBottom: "24px" },
  formTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "15px", marginBottom: "18px" },
  sectionTitle: { margin: 0, fontSize: "20px" },
  help: { color: "#a9b8cc", margin: "6px 0 0", fontSize: "13px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px" },
  field: { display: "flex", flexDirection: "column", gap: "7px", color: "#a9b8cc", fontSize: "12px", fontWeight: 700 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "7px", color: "#a9b8cc", fontSize: "12px", fontWeight: 700 },
  input: { minHeight: "48px", border: "1px solid rgba(255,255,255,.14)", borderRadius: "12px", background: "#0a2b5d", color: "white", padding: "0 13px", fontSize: "14px", boxSizing: "border-box", width: "100%", colorScheme: "dark" },
  calculo: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginTop: "18px" },
  calculoItem: { border: "1px solid rgba(255,255,255,.12)", borderRadius: "14px", background: "rgba(255,255,255,.04)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "5px" },
  totalBox: { border: "1px solid rgba(55,255,116,.35)", background: "rgba(55,255,116,.08)" },
  primaryButton: { width: "100%", marginTop: "18px", minHeight: "52px", border: "none", borderRadius: "14px", background: "linear-gradient(90deg,#17b8ff,#32f06d)", color: "#00112b", fontWeight: 900, cursor: "pointer", fontSize: "15px" },
  secondaryButton: { border: "1px solid rgba(255,255,255,.2)", borderRadius: "11px", background: "transparent", color: "white", padding: "10px 14px", cursor: "pointer", fontWeight: 700 },
  listCard: { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: "22px", padding: "22px" },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "16px" },
  filters: { display: "flex", gap: "10px", flexWrap: "wrap" },
  filterInput: { minHeight: "42px", border: "1px solid rgba(255,255,255,.14)", borderRadius: "11px", background: "#0a2b5d", color: "white", padding: "0 12px", colorScheme: "dark" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1050px" },
  th: { textAlign: "left", padding: "13px 10px", color: "#6bd8ff", borderBottom: "1px solid rgba(255,255,255,.1)", fontSize: "12px" },
  td: { padding: "13px 10px", borderBottom: "1px solid rgba(255,255,255,.07)", fontSize: "13px", verticalAlign: "middle" },
  totalCell: { padding: "13px 10px", borderBottom: "1px solid rgba(255,255,255,.07)", color: "#37ff74", fontWeight: 900 },
  code: { display: "block", color: "#7f98b7", marginTop: "3px" },
  received: { display: "inline-block", background: "rgba(55,255,116,.14)", color: "#37ff74", padding: "7px 10px", borderRadius: "999px", fontWeight: 800 },
  pending: { display: "inline-block", background: "rgba(255,209,102,.14)", color: "#ffd166", padding: "7px 10px", borderRadius: "999px", fontWeight: 800 },
  actions: { display: "flex", gap: "8px" },
  editButton: { border: "none", borderRadius: "9px", background: "#17b8ff", color: "white", padding: "8px 11px", fontWeight: 800, cursor: "pointer" },
  deleteButton: { border: "none", borderRadius: "9px", background: "#ff5c70", color: "white", padding: "8px 11px", fontWeight: 800, cursor: "pointer" },
  empty: { padding: "25px", textAlign: "center", color: "#a9b8cc" },
}

