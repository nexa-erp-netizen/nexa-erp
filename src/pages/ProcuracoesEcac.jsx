import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

const FORM_INICIAL = {
  clienteId: "",
  cliente: "",
  tipo: "Procuração e-CAC",
  dataInicio: "",
  dataValidade: "",
  outorgante: "",
  outorgado: "",
  servicosAutorizados: "",
  responsavel: "",
  observacoes: "",
  ativa: true,
}

function diasAte(data) {
  if (!data) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(`${String(data).slice(0, 10)}T00:00:00`)
  return Number.isFinite(alvo.getTime()) ? Math.ceil((alvo - hoje) / 86400000) : null
}

function situacaoProcuracao(item) {
  if (item.ativa === false) return { texto: "Inativa", cor: "#a9b8cc" }
  const dias = diasAte(item.dataValidade)
  if (dias === null) return { texto: "Sem validade", cor: "#a9b8cc" }
  if (dias < 0) return { texto: `Vencida há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`, cor: "#ff5f65" }
  if (dias <= 30) return { texto: `Vence em ${dias} dia${dias === 1 ? "" : "s"}`, cor: "#ffd54a" }
  return { texto: "Ativa", cor: "#37ff74" }
}

function formatarData(data) {
  if (!data) return "-"
  const [ano, mes, dia] = String(data).slice(0, 10).split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

export default function ProcuracoesEcac() {
  const [clientes, setClientes] = useState([])
  const [procuracoes, setProcuracoes] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [editandoId, setEditandoId] = useState(null)
  const [pesquisa, setPesquisa] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      const [clientesResposta, procuracoesResposta] = await Promise.all([
        api.get("/clientes"),
        api.get("/procuracoes-ecac"),
      ])
      const listaClientes = Array.isArray(clientesResposta.data) ? clientesResposta.data : []
      setClientes(listaClientes)
      setProcuracoes(Array.isArray(procuracoesResposta.data) ? procuracoesResposta.data : [])

      const clienteIdSalvo = localStorage.getItem("nexaProcuracaoClienteId")
      if (clienteIdSalvo) {
        const cliente = listaClientes.find((item) => String(item.id) === String(clienteIdSalvo))
        if (cliente) {
          setForm((anterior) => ({ ...anterior, clienteId: String(cliente.id), cliente: cliente.nome }))
          setPesquisa(cliente.nome)
        }
        localStorage.removeItem("nexaProcuracaoClienteId")
      }
    } catch (error) {
      console.error(error)
      alert("Erro ao carregar a Central de Procurações")
    }
  }

  function alterar(campo, valor) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }))
  }

  function selecionarCliente(clienteId) {
    const cliente = clientes.find((item) => String(item.id) === String(clienteId))
    setForm((anterior) => ({ ...anterior, clienteId, cliente: cliente?.nome || "" }))
  }

  function limpar() {
    setForm(FORM_INICIAL)
    setEditandoId(null)
  }

  async function salvar() {
    if (!form.clienteId || !form.dataValidade) {
      alert("Selecione o cliente e informe a validade.")
      return
    }

    setSalvando(true)
    try {
      if (editandoId) await api.put(`/procuracoes-ecac/${editandoId}`, form)
      else await api.post("/procuracoes-ecac", form)
      limpar()
      await carregarDados()
    } catch (error) {
      console.error(error)
      alert(error?.response?.data?.message || "Erro ao salvar procuração e-CAC")
    } finally {
      setSalvando(false)
    }
  }

  function editar(item) {
    setEditandoId(item.id)
    setForm({
      clienteId: item.clienteId || "",
      cliente: item.cliente || "",
      tipo: item.tipo || "Procuração e-CAC",
      dataInicio: item.dataInicio || "",
      dataValidade: item.dataValidade || "",
      outorgante: item.outorgante || "",
      outorgado: item.outorgado || "",
      servicosAutorizados: item.servicosAutorizados || "",
      responsavel: item.responsavel || "",
      observacoes: item.observacoes || "",
      ativa: item.ativa !== false,
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function excluir(id) {
    if (!window.confirm("Deseja excluir esta procuração?")) return
    try {
      await api.delete(`/procuracoes-ecac/${id}`)
      await carregarDados()
    } catch (error) {
      console.error(error)
      alert("Erro ao excluir procuração")
    }
  }

  const filtradas = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()
    return procuracoes.filter((item) => !termo || [item.cliente, item.tipo, item.outorgado, item.responsavel]
      .some((valor) => String(valor || "").toLowerCase().includes(termo)))
  }, [procuracoes, pesquisa])

  const resumo = useMemo(() => procuracoes.reduce((acc, item) => {
    if (item.ativa === false) acc.inativas += 1
    else {
      const dias = diasAte(item.dataValidade)
      if (dias !== null && dias < 0) acc.vencidas += 1
      else if (dias !== null && dias <= 30) acc.proximas += 1
      else acc.ativas += 1
    }
    return acc
  }, { ativas: 0, proximas: 0, vencidas: 0, inativas: 0 }), [procuracoes])

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <span style={styles.badge}>Identidade Digital</span>
          <h2 style={styles.title}>Procurações e-CAC</h2>
          <p style={styles.subtitle}>Controle de validade, responsáveis e serviços autorizados nas procurações digitais dos clientes.</p>
        </div>
        <button style={styles.ecacButton} onClick={() => window.open("https://cav.receita.fazenda.gov.br/autenticacao/login", "_blank", "noopener,noreferrer")}>Abrir e-CAC</button>
      </div>

      <div style={styles.resumoGrid}>
        <Resumo titulo="Ativas" valor={resumo.ativas} cor="#37ff74" />
        <Resumo titulo="Vencem em 30 dias" valor={resumo.proximas} cor="#ffd54a" />
        <Resumo titulo="Vencidas" valor={resumo.vencidas} cor="#ff5f65" />
        <Resumo titulo="Inativas" valor={resumo.inativas} cor="#a9b8cc" />
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>{editandoId ? "Corrigir procuração" : "Nova procuração"}</h3>
        <div style={styles.formGrid}>
          <select style={styles.input} value={form.clienteId} onChange={(e) => selecionarCliente(e.target.value)}>
            <option value="">Selecione o cliente</option>
            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
          </select>

          <select style={styles.input} value={form.tipo} onChange={(e) => alterar("tipo", e.target.value)}>
            <option value="Procuração e-CAC">Procuração e-CAC</option>
            <option value="Procuração digital">Procuração digital</option>
            <option value="Autorização de acesso">Autorização de acesso</option>
          </select>

          <label style={styles.label}>Início<input style={styles.input} type="date" value={form.dataInicio} onChange={(e) => alterar("dataInicio", e.target.value)} /></label>
          <label style={styles.label}>Validade<input style={styles.input} type="date" value={form.dataValidade} onChange={(e) => alterar("dataValidade", e.target.value)} /></label>
          <input style={styles.input} placeholder="Outorgante" value={form.outorgante} onChange={(e) => alterar("outorgante", e.target.value)} />
          <input style={styles.input} placeholder="Outorgado: escritório ou responsável" value={form.outorgado} onChange={(e) => alterar("outorgado", e.target.value)} />
          <input style={styles.input} placeholder="Responsável pelo acompanhamento" value={form.responsavel} onChange={(e) => alterar("responsavel", e.target.value)} />
          <select style={styles.input} value={String(form.ativa)} onChange={(e) => alterar("ativa", e.target.value === "true")}>
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
          <textarea style={{ ...styles.input, ...styles.textarea }} placeholder="Serviços autorizados no e-CAC" value={form.servicosAutorizados} onChange={(e) => alterar("servicosAutorizados", e.target.value)} />
          <textarea style={{ ...styles.input, ...styles.textarea }} placeholder="Observações" value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} />
        </div>
        <div style={styles.actions}>
          <button style={styles.primaryButton} disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : editandoId ? "Salvar correção" : "Cadastrar procuração"}</button>
          {editandoId && <button style={styles.secondaryButton} onClick={limpar}>Cancelar</button>}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.listHeader}>
          <h3 style={styles.cardTitle}>Procurações cadastradas</h3>
          <input style={styles.search} placeholder="Pesquisar cliente..." value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
        </div>
        <div style={styles.list}>
          {filtradas.length === 0 ? <p style={styles.empty}>Nenhuma procuração cadastrada.</p> : filtradas.map((item) => {
            const situacao = situacaoProcuracao(item)
            return (
              <div key={item.id} style={styles.item}>
                <div style={styles.itemMain}>
                  <strong style={styles.client}>{item.cliente}</strong>
                  <span style={{ ...styles.status, color: situacao.cor }}>{situacao.texto}</span>
                  <span style={styles.meta}>{item.tipo || "Procuração e-CAC"} • validade {formatarData(item.dataValidade)}</span>
                  <span style={styles.meta}>Outorgado: {item.outorgado || "não informado"}</span>
                  <span style={styles.meta}>Responsável: {item.responsavel || "não informado"}</span>
                </div>
                <div style={styles.itemActions}>
                  <button style={styles.editButton} onClick={() => editar(item)}>Corrigir</button>
                  <button style={styles.deleteButton} onClick={() => excluir(item.id)}>Excluir</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Resumo({ titulo, valor, cor }) {
  return <div style={styles.resumo}><span style={styles.resumoTitulo}>{titulo}</span><strong style={{ ...styles.resumoValor, color: cor }}>{valor}</strong></div>
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: { background: "linear-gradient(135deg,#061f47,#032f68)", border: "1px solid rgba(55,255,116,.18)", borderRadius: "22px", padding: "24px", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "8px 0", fontSize: "30px" },
  subtitle: { margin: 0, color: "#b8c7dc", maxWidth: "780px" },
  ecacButton: { background: "#00a8ff", color: "white", border: "none", borderRadius: "11px", padding: "12px 16px", fontWeight: "bold", cursor: "pointer" },
  resumoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "12px" },
  resumo: { background: "#061f47", border: "1px solid rgba(255,255,255,.11)", borderRadius: "16px", padding: "18px" },
  resumoTitulo: { display: "block", color: "#a9b8cc", fontSize: "13px" },
  resumoValor: { display: "block", fontSize: "30px", marginTop: "5px" },
  card: { background: "rgba(255,255,255,.06)", borderRadius: "20px", padding: "22px", border: "1px solid rgba(255,255,255,.10)" },
  cardTitle: { margin: "0 0 16px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "12px" },
  input: { width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,.18)", background: "#061f47", color: "white" },
  textarea: { minHeight: "88px", resize: "vertical", gridColumn: "1 / -1" },
  label: { color: "#b8c7dc", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" },
  actions: { display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" },
  primaryButton: { background: "#37ff74", color: "#00142f", border: "none", borderRadius: "10px", padding: "11px 16px", fontWeight: "bold", cursor: "pointer" },
  secondaryButton: { background: "transparent", color: "white", border: "1px solid rgba(255,255,255,.25)", borderRadius: "10px", padding: "11px 16px", cursor: "pointer" },
  listHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  search: { minWidth: "240px", padding: "10px", borderRadius: "10px", border: "1px solid rgba(255,255,255,.18)", background: "#061f47", color: "white" },
  list: { display: "flex", flexDirection: "column", gap: "10px" },
  item: { background: "#061f47", border: "1px solid rgba(255,255,255,.10)", borderRadius: "14px", padding: "15px", display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", flexWrap: "wrap" },
  itemMain: { display: "flex", flexDirection: "column", gap: "4px" },
  client: { fontSize: "17px" },
  status: { fontWeight: "bold" },
  meta: { color: "#a9b8cc", fontSize: "13px" },
  itemActions: { display: "flex", gap: "8px" },
  editButton: { background: "#00a8ff", color: "white", border: "none", borderRadius: "9px", padding: "9px 12px", cursor: "pointer" },
  deleteButton: { background: "#ff5f65", color: "white", border: "none", borderRadius: "9px", padding: "9px 12px", cursor: "pointer" },
  empty: { color: "#a9b8cc" },
}
