import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

const FORM_INICIAL = {
  clienteId: "",
  cliente: "",
  tipo: "A1",
  dataEmissao: "",
  dataValidade: "",
  autoridadeCertificadora: "",
  numeroSerie: "",
  localArquivo: "",
  tipoLocalizacao: "Computador",
  caminhoPasta: "",
  nomeArquivo: "",
  possuiBackup: false,
  localBackup: "",
  dataUltimoBackup: "",
  responsavel: "",
  observacoes: "",
  ativo: true,
}

function diasAte(data) {
  if (!data) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(`${data}T00:00:00`)
  if (!Number.isFinite(alvo.getTime())) return null
  return Math.ceil((alvo - hoje) / 86400000)
}

function situacaoCertificado(certificado) {
  const dias = diasAte(certificado.dataValidade)
  if (dias === null) return { texto: "Sem validade", cor: "#a9b8cc" }
  if (dias < 0) return { texto: "Vencido", cor: "#ff5f65" }
  if (dias <= 30) return { texto: `Vence em ${dias} dia${dias === 1 ? "" : "s"}`, cor: "#ffd54a" }
  return { texto: "Válido", cor: "#37ff74" }
}

function formatarData(data) {
  if (!data) return "-"
  const [ano, mes, dia] = String(data).slice(0, 10).split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

export default function CertificadosDigitais() {
  const [clientes, setClientes] = useState([])
  const [certificados, setCertificados] = useState([])
  const [form, setForm] = useState(FORM_INICIAL)
  const [editandoId, setEditandoId] = useState(null)
  const [pesquisa, setPesquisa] = useState("")
  const [historico, setHistorico] = useState([])
  const [clienteHistorico, setClienteHistorico] = useState("")

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      const [clientesResposta, certificadosResposta] = await Promise.all([
        api.get("/clientes"),
        api.get("/certificados-digitais"),
      ])
      const listaClientes = Array.isArray(clientesResposta.data) ? clientesResposta.data : []
      setClientes(listaClientes)
      setCertificados(Array.isArray(certificadosResposta.data) ? certificadosResposta.data : [])

      const clienteIdSalvo = localStorage.getItem("nexaCertificadoClienteId")
      if (clienteIdSalvo) {
        const cliente = listaClientes.find((item) => String(item.id) === String(clienteIdSalvo))
        if (cliente) {
          setForm((anterior) => ({ ...anterior, clienteId: String(cliente.id), cliente: cliente.nome }))
          setPesquisa(cliente.nome)
        }
        localStorage.removeItem("nexaCertificadoClienteId")
      }
    } catch (error) {
      console.error(error)
      alert("Erro ao carregar a Central de Certificados")
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

    try {
      if (editandoId) await api.put(`/certificados-digitais/${editandoId}`, form)
      else await api.post("/certificados-digitais", form)
      limpar()
      await carregarDados()
    } catch (error) {
      console.error(error)
      alert(error?.response?.data?.message || "Erro ao salvar certificado")
    }
  }

  function editar(certificado) {
    setEditandoId(certificado.id)
    setForm({
      clienteId: certificado.clienteId || "",
      cliente: certificado.cliente || "",
      tipo: certificado.tipo || "A1",
      dataEmissao: certificado.dataEmissao || "",
      dataValidade: certificado.dataValidade || "",
      autoridadeCertificadora: certificado.autoridadeCertificadora || "",
      numeroSerie: certificado.numeroSerie || "",
      localArquivo: certificado.localArquivo || "",
      tipoLocalizacao: certificado.tipoLocalizacao || "Computador",
      caminhoPasta: certificado.caminhoPasta || "",
      nomeArquivo: certificado.nomeArquivo || "",
      possuiBackup: certificado.possuiBackup === true,
      localBackup: certificado.localBackup || "",
      dataUltimoBackup: certificado.dataUltimoBackup || "",
      responsavel: certificado.responsavel || "",
      observacoes: certificado.observacoes || "",
      ativo: certificado.ativo !== false,
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function excluir(id) {
    if (!window.confirm("Deseja excluir este certificado?")) return
    try {
      await api.delete(`/certificados-digitais/${id}`)
      await carregarDados()
    } catch (error) {
      console.error(error)
      alert("Erro ao excluir certificado")
    }
  }

  async function verHistorico(item) {
    try {
      const resposta = await api.get(`/certificados-digitais/historico/${item.clienteId}`)
      setHistorico(Array.isArray(resposta.data) ? resposta.data : [])
      setClienteHistorico(item.cliente)
    } catch (error) {
      console.error(error)
      alert("Erro ao carregar histórico do certificado")
    }
  }

  function abrirPasta(item) {
    const caminho = item.caminhoPasta || item.localArquivo
    if (!caminho) {
      alert("Informe primeiro o caminho da pasta do certificado.")
      return
    }
    if (window.electronAPI?.abrirCaminho) {
      window.electronAPI.abrirCaminho(caminho)
      return
    }
    navigator.clipboard?.writeText(caminho)
    alert("Caminho copiado. O botão Abrir Pasta ficará automático no aplicativo Desktop.")
  }

  const filtrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()
    return certificados.filter((item) => {
      if (!termo) return true
      return [item.cliente, item.autoridadeCertificadora, item.numeroSerie, item.caminhoPasta, item.localBackup]
        .some((valor) => String(valor || "").toLowerCase().includes(termo))
    })
  }, [certificados, pesquisa])

  const resumo = useMemo(() => certificados.reduce((acc, item) => {
    const dias = diasAte(item.dataValidade)
    if (dias !== null && dias < 0) acc.vencidos += 1
    else if (dias !== null && dias <= 30) acc.proximos += 1
    else acc.validos += 1
    if (item.possuiBackup) acc.comBackup += 1
    else acc.semBackup += 1
    return acc
  }, { validos: 0, proximos: 0, vencidos: 0, comBackup: 0, semBackup: 0 }), [certificados])

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <span style={styles.badge}>Identidade Digital</span>
          <h2 style={styles.title}>Central de Certificados</h2>
          <p style={styles.subtitle}>Controle de validade, localização e backup. A Nexa não armazena o arquivo nem a senha do certificado nesta etapa.</p>
        </div>
      </div>

      <div style={styles.resumoGrid}>
        <Resumo titulo="Válidos" valor={resumo.validos} cor="#37ff74" />
        <Resumo titulo="Vencem em 30 dias" valor={resumo.proximos} cor="#ffd54a" />
        <Resumo titulo="Vencidos" valor={resumo.vencidos} cor="#ff5f65" />
        <Resumo titulo="Com backup" valor={resumo.comBackup} cor="#00a8ff" />
        <Resumo titulo="Sem backup" valor={resumo.semBackup} cor="#ff9f43" />
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>{editandoId ? "Corrigir certificado" : "Novo certificado"}</h3>
        <div style={styles.formGrid}>
          <select style={styles.input} value={form.clienteId} onChange={(e) => selecionarCliente(e.target.value)}>
            <option value="">Selecione o cliente</option>
            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
          </select>
          <select style={styles.input} value={form.tipo} onChange={(e) => alterar("tipo", e.target.value)}><option value="A1">A1</option></select>
          <label style={styles.label}>Emissão<input style={styles.input} type="date" value={form.dataEmissao} onChange={(e) => alterar("dataEmissao", e.target.value)} /></label>
          <label style={styles.label}>Validade<input style={styles.input} type="date" value={form.dataValidade} onChange={(e) => alterar("dataValidade", e.target.value)} /></label>
          <input style={styles.input} placeholder="Autoridade certificadora" value={form.autoridadeCertificadora} onChange={(e) => alterar("autoridadeCertificadora", e.target.value)} />
          <input style={styles.input} placeholder="Número de série" value={form.numeroSerie} onChange={(e) => alterar("numeroSerie", e.target.value)} />
          <select style={styles.input} value={form.tipoLocalizacao} onChange={(e) => alterar("tipoLocalizacao", e.target.value)}>
            <option value="Computador">Computador</option>
            <option value="Google Drive">Google Drive</option>
            <option value="OneDrive">OneDrive</option>
            <option value="Outro">Outro</option>
          </select>
          <input style={styles.input} placeholder="Caminho da pasta" value={form.caminhoPasta} onChange={(e) => alterar("caminhoPasta", e.target.value)} />
          <input style={styles.input} placeholder="Nome do arquivo .PFX ou .P12" value={form.nomeArquivo} onChange={(e) => alterar("nomeArquivo", e.target.value)} />
          <input style={styles.input} placeholder="Descrição/local antigo do arquivo" value={form.localArquivo} onChange={(e) => alterar("localArquivo", e.target.value)} />
          <input style={styles.input} placeholder="Responsável" value={form.responsavel} onChange={(e) => alterar("responsavel", e.target.value)} />
          <label style={styles.checkLabel}><input type="checkbox" checked={form.possuiBackup} onChange={(e) => alterar("possuiBackup", e.target.checked)} /> Possui backup atualizado</label>
          {form.possuiBackup && <>
            <input style={styles.input} placeholder="Local do backup (Google Drive, pasta...)" value={form.localBackup} onChange={(e) => alterar("localBackup", e.target.value)} />
            <label style={styles.label}>Último backup<input style={styles.input} type="date" value={form.dataUltimoBackup} onChange={(e) => alterar("dataUltimoBackup", e.target.value)} /></label>
          </>}
          <textarea style={{ ...styles.input, ...styles.textarea }} placeholder="Observações" value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} />
        </div>
        <div style={styles.actions}>
          <button style={styles.primaryButton} onClick={salvar}>{editandoId ? "Salvar correção" : "Cadastrar certificado"}</button>
          {editandoId && <button style={styles.secondaryButton} onClick={limpar}>Cancelar</button>}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.listHeader}>
          <h3 style={styles.cardTitle}>Certificados cadastrados</h3>
          <input style={styles.search} placeholder="Pesquisar cliente..." value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
        </div>
        <div style={styles.list}>
          {filtrados.length === 0 ? <p style={styles.empty}>Nenhum certificado cadastrado.</p> : filtrados.map((item) => {
            const situacao = situacaoCertificado(item)
            return <div key={item.id} style={styles.item}>
              <div style={styles.itemMain}>
                <strong style={styles.client}>{item.cliente}</strong>
                <span style={{ ...styles.status, color: situacao.cor }}>{situacao.texto}</span>
                <span style={styles.meta}>A1 • validade {formatarData(item.dataValidade)}</span>
                <span style={styles.meta}>Local: {item.tipoLocalizacao || "não informado"} • {item.caminhoPasta || item.localArquivo || "caminho não informado"}</span>
                <span style={styles.meta}>Arquivo: {item.nomeArquivo || "não informado"}</span>
                <span style={{ ...styles.meta, color: item.possuiBackup ? "#37ff74" : "#ff9f43" }}>{item.possuiBackup ? `Backup: ${item.localBackup || "informado"} • ${formatarData(item.dataUltimoBackup)}` : "Backup não informado"}</span>
              </div>
              <div style={styles.itemActions}>
                <button style={styles.folderButton} onClick={() => abrirPasta(item)}>Abrir pasta</button>
                <button style={styles.historyButton} onClick={() => verHistorico(item)}>Histórico</button>
                <button style={styles.editButton} onClick={() => editar(item)}>Corrigir</button>
                <button style={styles.deleteButton} onClick={() => excluir(item.id)}>Excluir</button>
              </div>
            </div>
          })}
        </div>
      </div>

      {clienteHistorico && <div style={styles.card}>
        <div style={styles.listHeader}><h3 style={styles.cardTitle}>Histórico — {clienteHistorico}</h3><button style={styles.secondaryButton} onClick={() => { setHistorico([]); setClienteHistorico("") }}>Fechar</button></div>
        <div style={styles.list}>{historico.length === 0 ? <p style={styles.empty}>Nenhuma alteração registrada.</p> : historico.map((item) => <div key={item.id} style={styles.historyItem}><strong>{item.acao}</strong><span style={styles.meta}>{item.detalhes || "-"}</span><span style={styles.meta}>{new Date(item.createdAt).toLocaleString("pt-BR")}</span></div>)}</div>
      </div>}
    </div>
  )
}

function Resumo({ titulo, valor, cor }) {
  return <div style={styles.resumo}><span style={styles.resumoTitulo}>{titulo}</span><strong style={{ ...styles.resumoValor, color: cor }}>{valor}</strong></div>
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: { background: "linear-gradient(135deg,#061f47,#032f68)", border: "1px solid rgba(55,255,116,.18)", borderRadius: "22px", padding: "24px" },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "8px 0", fontSize: "30px" },
  subtitle: { margin: 0, color: "#b8c7dc", maxWidth: "800px" },
  resumoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "12px" },
  resumo: { background: "#061f47", border: "1px solid rgba(255,255,255,.11)", borderRadius: "16px", padding: "18px" },
  resumoTitulo: { display: "block", color: "#a9b8cc", fontSize: "13px" },
  resumoValor: { display: "block", fontSize: "30px", marginTop: "5px" },
  card: { background: "rgba(255,255,255,.06)", borderRadius: "20px", padding: "22px", border: "1px solid rgba(255,255,255,.10)" },
  cardTitle: { margin: "0 0 16px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "12px" },
  input: { width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,.18)", background: "#061f47", color: "white" },
  textarea: { minHeight: "88px", resize: "vertical", gridColumn: "1 / -1" },
  label: { color: "#b8c7dc", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" },
  checkLabel: { color: "white", display: "flex", alignItems: "center", gap: "9px", background: "#061f47", borderRadius: "10px", padding: "12px" },
  actions: { display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" },
  primaryButton: { background: "#37ff74", color: "#00142f", border: "none", borderRadius: "10px", padding: "11px 16px", fontWeight: "bold", cursor: "pointer" },
  secondaryButton: { background: "transparent", color: "white", border: "1px solid rgba(255,255,255,.25)", borderRadius: "10px", padding: "11px 16px", cursor: "pointer" },
  listHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  search: { minWidth: "240px", padding: "10px", borderRadius: "10px", border: "1px solid rgba(255,255,255,.18)", background: "#061f47", color: "white" },
  list: { display: "flex", flexDirection: "column", gap: "10px" },
  item: { background: "#061f47", border: "1px solid rgba(255,255,255,.10)", borderRadius: "14px", padding: "15px", display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", flexWrap: "wrap" },
  itemMain: { display: "flex", flexDirection: "column", gap: "4px", minWidth: "260px", flex: 1 },
  client: { fontSize: "17px" },
  status: { fontWeight: "bold" },
  meta: { color: "#a9b8cc", fontSize: "13px" },
  itemActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  folderButton: { background: "#37ff74", color: "#00142f", border: "none", borderRadius: "9px", padding: "9px 12px", cursor: "pointer", fontWeight: "bold" },
  historyButton: { background: "#8e6cff", color: "white", border: "none", borderRadius: "9px", padding: "9px 12px", cursor: "pointer" },
  editButton: { background: "#00a8ff", color: "white", border: "none", borderRadius: "9px", padding: "9px 12px", cursor: "pointer" },
  deleteButton: { background: "#ff5f65", color: "white", border: "none", borderRadius: "9px", padding: "9px 12px", cursor: "pointer" },
  empty: { color: "#a9b8cc" },
  historyItem: { display: "grid", gridTemplateColumns: "140px 1fr auto", gap: "12px", background: "#061f47", borderRadius: "12px", padding: "12px" },
}
