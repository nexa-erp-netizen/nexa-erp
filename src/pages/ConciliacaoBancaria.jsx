import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

const vazio = { bancoCodigo: "", bancoNome: "", agencia: "", conta: "", digito: "", tipoConta: "Conta corrente", moeda: "BRL", saldoInicial: "", dataSaldoInicial: "", principal: false, ativo: true, observacoes: "" }

export default function ConciliacaoBancaria({ setPage }) {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState(localStorage.getItem("nexaConciliacaoClienteId") || "")
  const [contas, setContas] = useState([])
  const [form, setForm] = useState(vazio)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [contaExtratoId, setContaExtratoId] = useState("")
  const [arquivo, setArquivo] = useState(null)
  const [movimentos, setMovimentos] = useState([])
  const [importacoes, setImportacoes] = useState([])
  const [importando, setImportando] = useState(false)
  const [resumoImportacao, setResumoImportacao] = useState(null)
  const [planoContas, setPlanoContas] = useState([])
  const [classificacoes, setClassificacoes] = useState({})
  const [selecionados, setSelecionados] = useState([])
  const [planoLoteId, setPlanoLoteId] = useState("")
  const [filtroStatus, setFiltroStatus] = useState("Todos")
  const [processando, setProcessando] = useState(false)

  useEffect(() => {
    api.get("/clientes").then(r => setClientes(r.data || [])).catch(() => setClientes([]))
    api.get("/plano-contas").then(r => setPlanoContas(r.data || [])).catch(() => setPlanoContas([]))
  }, [])
  useEffect(() => {
    if (!clienteId) { setContas([]); return }
    localStorage.setItem("nexaConciliacaoClienteId", String(clienteId))
    carregar()
  }, [clienteId])
  useEffect(() => { if (contaExtratoId) carregarExtratos(); else { setMovimentos([]); setImportacoes([]) } }, [contaExtratoId])

  async function carregar() {
    try {
      const r = await api.get("/contas-bancarias-clientes", { params: { clienteId } })
      const lista = r.data || []
      setContas(lista)
      setContaExtratoId(atual => lista.some(c => String(c.id) === String(atual)) ? atual : String(lista.find(c => c.principal && c.ativo)?.id || lista.find(c => c.ativo)?.id || ""))
    }
    catch (e) { alert(e.response?.data?.message || "Erro ao carregar contas bancárias") }
  }

  const cliente = useMemo(() => clientes.find(c => String(c.id) === String(clienteId)), [clientes, clienteId])
  const alterar = (campo, valor) => setForm(atual => ({ ...atual, [campo]: valor }))
  function limpar() { setForm(vazio); setEditandoId(null) }

  function editar(item) {
    setEditandoId(item.id)
    setForm({ ...vazio, ...item, saldoInicial: moedaCampo(item.saldoInicial), dataSaldoInicial: item.dataSaldoInicial || "" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function salvar(e) {
    e.preventDefault()
    if (!clienteId) return alert("Selecione a empresa")
    setSalvando(true)
    try {
      const corpo = { ...form, clienteId, saldoInicial: numeroMoeda(form.saldoInicial) }
      if (editandoId) await api.put(`/contas-bancarias-clientes/${editandoId}`, corpo)
      else await api.post("/contas-bancarias-clientes", corpo)
      limpar(); await carregar()
    } catch (e) { alert(e.response?.data?.message || "Erro ao salvar conta bancária") }
    finally { setSalvando(false) }
  }

  async function alternar(item) {
    try { await api.patch(`/contas-bancarias-clientes/${item.id}/status`, { ativo: !item.ativo }); await carregar() }
    catch (e) { alert(e.response?.data?.message || "Erro ao alterar situação") }
  }

  async function carregarExtratos() {
    try {
      const semCache = Date.now()
      const [m, i] = await Promise.all([
        api.get("/extratos-bancarios/movimentos", { params: { contaBancariaId: contaExtratoId, _t: semCache } }),
        api.get("/extratos-bancarios/importacoes", { params: { contaBancariaId: contaExtratoId, _t: semCache } }),
      ])
      const lista = m.data || []
      setMovimentos(lista); setImportacoes(i.data || [])
      setClassificacoes(Object.fromEntries(lista.map(item => [item.id, item.planoContaId || ""])))
      setSelecionados(atual => atual.filter(id => lista.some(item => item.id === id)))
    } catch (e) { alert(e.response?.data?.message || "Erro ao carregar extratos") }
  }

  async function importarExtrato(e) {
    e.preventDefault()
    if (!contaExtratoId) return alert("Selecione a conta bancária")
    if (!arquivo) return alert("Selecione um arquivo OFX ou CSV")
    const dados = new FormData()
    dados.append("contaBancariaId", contaExtratoId)
    dados.append("arquivo", arquivo)
    setImportando(true); setResumoImportacao(null)
    try {
      const r = await api.post("/extratos-bancarios/importar", dados, { headers: { "Content-Type": "multipart/form-data" } })
      setResumoImportacao(r.data.resumo); setArquivo(null)
      const inputArquivo = document.getElementById("nexa-arquivo-extrato")
      if (inputArquivo) inputArquivo.value = ""
      await carregarExtratos()
    } catch (e) { alert(e.response?.data?.message || "Erro ao importar extrato") }
    finally { setImportando(false) }
  }

  const resumoMovimentos = useMemo(() => movimentos.reduce((r, m) => {
    const valor = Number(m.valor || 0)
    if (m.natureza === "Entrada") r.entradas += valor; else r.saidas += valor
    if (m.statusConciliacao === "Pendente") r.pendentes += 1
    if (m.statusConciliacao === "Classificado") r.classificados += 1
    if (m.statusConciliacao === "Conciliado") r.conciliados += 1
    return r
  }, { entradas: 0, saidas: 0, pendentes: 0, classificados: 0, conciliados: 0 }), [movimentos])

  const movimentosVisiveis = useMemo(() => filtroStatus === "Todos" ? movimentos : movimentos.filter(m => m.statusConciliacao === filtroStatus), [movimentos, filtroStatus])
  const planosPara = natureza => planoContas.filter(p => naturezaCompativel(p, natureza))
  function naturezaCompativel(plano, natureza) {
    const texto = `${plano?.natureza || ""} ${plano?.tipo || ""} ${plano?.conta || ""}`.toLowerCase()
    return natureza === "Entrada"
      ? texto.includes("credor") || texto.includes("receita") || texto.includes("fatur")
      : texto.includes("devedor") || texto.includes("despesa") || texto.includes("custo") || texto.includes("taxa") || texto.includes("imposto")
  }

  function alternarSelecao(id) { setSelecionados(atual => atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id]) }
  function selecionarVisiveis() { setSelecionados(movimentosVisiveis.filter(m => !m.lancamentoContabilId).map(m => m.id)) }

  async function classificarUm(movimento, status) {
    const planoContaId = classificacoes[movimento.id]
    if (["Classificado", "Conciliado"].includes(status) && !planoContaId) return alert("Selecione a conta contábil deste movimento")
    setProcessando(true)
    try { await api.patch(`/extratos-bancarios/movimentos/${movimento.id}`, { planoContaId, statusConciliacao: status }); await carregarExtratos() }
    catch (e) { alert(e.response?.data?.message || "Erro ao classificar movimento") }
    finally { setProcessando(false) }
  }

  async function classificarLote(status) {
    if (!selecionados.length) return alert("Selecione os movimentos")
    if (["Classificado", "Conciliado"].includes(status) && !planoLoteId) return alert("Selecione uma conta contábil para o lote")
    setProcessando(true)
    try {
      const r = await api.post("/extratos-bancarios/movimentos/classificar-lote", { ids: selecionados, planoContaId: planoLoteId || null, statusConciliacao: status })
      setSelecionados([]); await carregarExtratos(); alert(`${r.data.atualizados} movimento(s) atualizado(s).`)
    } catch (e) { alert(e.response?.data?.message || "Erro na classificação em lote") }
    finally { setProcessando(false) }
  }

  async function sugerirClassificacoes() {
    setProcessando(true)
    try { const r = await api.post("/extratos-bancarios/movimentos/sugerir", { contaBancariaId: contaExtratoId }); await carregarExtratos(); alert(`${r.data.sugeridos} classificação(ões) sugerida(s) pelo histórico.`) }
    catch (e) { alert(e.response?.data?.message || "Erro ao sugerir classificações") }
    finally { setProcessando(false) }
  }

  async function gerarLancamentos() {
    const ids = selecionados.filter(id => movimentos.some(m => m.id === id && m.statusConciliacao === "Conciliado"))
    if (!ids.length) return alert("Selecione movimentos com status Conciliado")
    if (!confirm(`Gerar ${ids.length} lançamento(s) contábil(eis)?`)) return
    setProcessando(true)
    try { const r = await api.post("/extratos-bancarios/gerar-lancamentos", { ids }); setSelecionados([]); await carregarExtratos(); alert(`${r.data.gerados} lançamento(s) gerado(s) com sucesso.`) }
    catch (e) { alert(e.response?.data?.message || "Erro ao gerar lançamentos") }
    finally { setProcessando(false) }
  }

  function voltarEmpresa() {
    if (!clienteId) return
    localStorage.setItem("nexaAbrirClienteId", String(clienteId))
    setPage?.("Clientes")
  }

  return <div style={s.page}>
    <div style={s.hero}>
      <div><span style={s.badge}>Contábil</span><h2 style={s.h2}>Conciliação Bancária</h2><p style={s.p}>Contas bancárias vinculadas à empresa para conciliação, lançamentos e relatórios.</p></div>
      {clienteId && <button style={s.home} title="Voltar para a empresa" aria-label="Voltar para a empresa" onClick={voltarEmpresa}>🏠</button>}
    </div>

    <div style={s.card}>
      <label style={s.label}>Empresa
        <select style={s.input} value={clienteId} onChange={e => { setClienteId(e.target.value); limpar() }}>
          <option value="">Selecione a empresa</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
    </div>

    {clienteId && <>
      <form style={s.card} onSubmit={salvar}>
        <div style={s.titleRow}><div><h3 style={s.h3}>{editandoId ? "Corrigir conta bancária" : "Cadastrar conta bancária"}</h3><p style={s.p}>Empresa: <strong>{cliente?.nome || "-"}</strong></p></div>{editandoId && <button type="button" style={s.secondary} onClick={limpar}>Cancelar edição</button>}</div>
        <div style={s.grid}>
          <Campo t="Código do banco"><input style={s.input} value={form.bancoCodigo} onChange={e => alterar("bancoCodigo", e.target.value)} placeholder="Ex.: 001" /></Campo>
          <Campo t="Banco *"><input style={s.input} value={form.bancoNome} onChange={e => alterar("bancoNome", e.target.value)} placeholder="Ex.: Banco do Brasil" required /></Campo>
          <Campo t="Agência *"><input style={s.input} value={form.agencia} onChange={e => alterar("agencia", e.target.value)} required /></Campo>
          <Campo t="Conta *"><input style={s.input} value={form.conta} onChange={e => alterar("conta", e.target.value)} required /></Campo>
          <Campo t="Dígito"><input style={s.input} value={form.digito || ""} onChange={e => alterar("digito", e.target.value)} /></Campo>
          <Campo t="Tipo de conta"><select style={s.input} value={form.tipoConta} onChange={e => alterar("tipoConta", e.target.value)}><option>Conta corrente</option><option>Conta poupança</option><option>Conta pagamento</option><option>Investimentos</option><option>Caixa interno</option></select></Campo>
          <Campo t="Saldo inicial"><input inputMode="numeric" style={s.input} value={form.saldoInicial} onChange={e => alterar("saldoInicial", formatarMoedaDigitada(e.target.value))} placeholder="R$ 0,00" /></Campo>
          <Campo t="Data-base do saldo"><input type="date" style={s.input} value={form.dataSaldoInicial} onChange={e => alterar("dataSaldoInicial", e.target.value)} /></Campo>
        </div>
        <label style={s.check}><input type="checkbox" checked={form.principal} onChange={e => alterar("principal", e.target.checked)} /> Definir como conta principal da empresa</label>
        <Campo t="Observações"><textarea style={{ ...s.input, minHeight: 80 }} value={form.observacoes || ""} onChange={e => alterar("observacoes", e.target.value)} /></Campo>
        <button style={s.primary} disabled={salvando}>{salvando ? "Salvando..." : editandoId ? "Salvar correção" : "Cadastrar conta"}</button>
      </form>

      <div style={s.card}>
        <div style={s.titleRow}><div><h3 style={s.h3}>Contas da empresa</h3><p style={s.p}>{contas.length} conta(s) cadastrada(s).</p></div><span style={s.next}>Importação OFX e CSV disponível</span></div>
        {contas.length === 0 ? <div style={s.empty}>Nenhuma conta bancária cadastrada.</div> : <div style={{ overflowX: "auto" }}><table style={s.table}><thead><tr><th>Banco</th><th>Agência</th><th>Conta</th><th>Tipo</th><th>Saldo inicial</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{contas.map(item => <tr key={item.id}><td><strong>{item.bancoCodigo ? `${item.bancoCodigo} • ` : ""}{item.bancoNome}</strong>{item.principal && <span style={s.principal}>Principal</span>}</td><td>{item.agencia}</td><td>{item.conta}{item.digito ? `-${item.digito}` : ""}</td><td>{item.tipoConta}</td><td>{moeda(item.saldoInicial)}</td><td>{item.ativo ? "Ativa" : "Inativa"}</td><td><div style={s.actions}><button style={s.small} onClick={() => editar(item)}>Corrigir</button><button style={item.ativo ? s.danger : s.secondary} onClick={() => alternar(item)}>{item.ativo ? "Inativar" : "Ativar"}</button></div></td></tr>)}</tbody></table></div>}
      </div>

      {contas.some(c => c.ativo) && <div style={s.card}>
        <div style={s.titleRow}><div><h3 style={s.h3}>Importar extrato bancário</h3><p style={s.p}>Envie o extrato da conta em OFX ou CSV. Limite de 10 MB.</p></div><span style={s.next}>Duplicidades bloqueadas</span></div>
        <form onSubmit={importarExtrato}>
          <div style={s.grid}>
            <Campo t="Conta bancária"><select style={s.input} value={contaExtratoId} onChange={e => { setContaExtratoId(e.target.value); setResumoImportacao(null) }}>{contas.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.bancoNome} • Ag. {c.agencia} • {c.conta}{c.digito ? `-${c.digito}` : ""}</option>)}</select></Campo>
            <Campo t="Arquivo OFX ou CSV"><input id="nexa-arquivo-extrato" type="file" accept=".ofx,.csv,text/csv,application/x-ofx" style={s.input} onChange={e => setArquivo(e.target.files?.[0] || null)} /></Campo>
          </div>
          <button style={s.primary} disabled={importando}>{importando ? "Lendo extrato..." : "Importar e ler extrato"}</button>
        </form>
        {resumoImportacao && <div style={s.success}><strong>Extrato importado com sucesso.</strong><span>{resumoImportacao.importados} movimento(s) novo(s) • {resumoImportacao.duplicados} duplicado(s) ignorado(s)</span></div>}
      </div>}

      {contaExtratoId && <div style={s.card}>
        <div style={s.titleRow}><div><h3 style={s.h3}>Movimentos importados</h3><p style={s.p}>Leitura bancária aguardando classificação e conciliação.</p></div><span style={s.next}>{importacoes.length} importação(ões)</span></div>
        <div style={s.summary}><Resumo t="Entradas" v={moeda(resumoMovimentos.entradas)} cor="#42f5a7"/><Resumo t="Saídas" v={moeda(resumoMovimentos.saidas)} cor="#ff7d88"/><Resumo t="Movimento líquido" v={moeda(resumoMovimentos.entradas-resumoMovimentos.saidas)} cor="#53c9ff"/><Resumo t="Pendentes" v={resumoMovimentos.pendentes} cor="#ffd45b"/><Resumo t="Classificados" v={resumoMovimentos.classificados} cor="#9ac7ff"/><Resumo t="Conciliados" v={resumoMovimentos.conciliados} cor="#73ffd4"/></div>
        {movimentos.length > 0 && <div style={s.batch}>
          <select style={s.input} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}><option>Todos</option><option>Pendente</option><option>Classificado</option><option>Conciliado</option><option>Ignorado</option><option>Lançado</option></select>
          <button style={s.secondary} onClick={selecionarVisiveis}>Selecionar visíveis</button><button style={s.secondary} onClick={() => setSelecionados([])}>Limpar seleção</button>
          <select style={s.input} value={planoLoteId} onChange={e => setPlanoLoteId(e.target.value)}><option value="">Conta contábil para o lote</option>{planoContas.map(p => <option key={p.id} value={p.id}>{p.codigo} • {p.conta}</option>)}</select>
          <button style={s.small} disabled={processando} onClick={() => classificarLote("Classificado")}>Classificar lote</button>
          <button style={s.primary} disabled={processando} onClick={() => classificarLote("Conciliado")}>Conciliar lote</button>
          <button style={s.secondary} disabled={processando} onClick={() => classificarLote("Ignorado")}>Ignorar lote</button>
          <button style={s.small} disabled={processando} onClick={sugerirClassificacoes}>Sugerir pelo histórico</button>
          <button style={s.launch} disabled={processando} onClick={gerarLancamentos}>Gerar lançamentos</button>
          <strong>{selecionados.length} selecionado(s)</strong>
        </div>}
        {movimentos.length === 0 ? <div style={s.empty}>Nenhum extrato importado para esta conta.</div> : <div style={{ overflowX: "auto" }}><table style={s.table}><thead><tr><th>✓</th><th>Data</th><th>Descrição</th><th>Natureza</th><th>Valor</th><th>Plano de Contas</th><th>Status</th><th>Ações</th></tr></thead><tbody>{movimentosVisiveis.map(m => <tr key={m.id}><td><input type="checkbox" checked={selecionados.includes(m.id)} disabled={Boolean(m.lancamentoContabilId)} onChange={() => alternarSelecao(m.id)} /></td><td>{dataBr(m.data)}</td><td><strong>{m.descricao}</strong><small style={s.block}>{m.documento || ""}</small></td><td><span style={m.natureza === "Entrada" ? s.entrada : s.saida}>{m.natureza}</span></td><td style={{ color: m.natureza === "Entrada" ? "#42f5a7" : "#ff9ba4", fontWeight: 800 }}>{m.natureza === "Saída" ? "- " : "+ "}{moeda(m.valor)}</td><td><select style={s.tableSelect} value={classificacoes[m.id] || ""} disabled={Boolean(m.lancamentoContabilId)} onChange={e => setClassificacoes(a => ({ ...a, [m.id]: e.target.value }))}><option value="">Selecione</option>{planosPara(m.natureza).map(p => <option key={p.id} value={p.id}>{p.codigo} • {p.conta}</option>)}</select>{m.categoriaSugerida && <small style={s.block}>Sugestão: {m.categoriaSugerida}</small>}</td><td>{m.statusConciliacao}</td><td><div style={s.actions}>{!m.lancamentoContabilId && <><button style={s.small} disabled={processando} onClick={() => classificarUm(m,"Classificado")}>Classificar</button><button style={s.primary} disabled={processando} onClick={() => classificarUm(m,"Conciliado")}>Conciliar</button><button style={s.secondary} disabled={processando} onClick={() => classificarUm(m,"Ignorado")}>Ignorar</button></>}{m.lancamentoContabilId && <span style={s.lancado}>Lançamento #{m.lancamentoContabilId}</span>}</div></td></tr>)}</tbody></table></div>}
        {importacoes.length > 0 && <div style={{ marginTop: 18 }}><h4>Histórico de importações</h4>{importacoes.slice(0, 5).map(i => <div key={i.id} style={s.importItem}><span><strong>{i.nomeArquivo}</strong> • {i.formato}</span><span>{i.totalImportados} novos • {i.totalDuplicados} duplicados • {dataBr(String(i.createdAt).slice(0,10))}</span></div>)}</div>}
      </div>}
    </>}
  </div>
}

function Campo({ t, children }) { return <label style={s.label}>{t}{children}</label> }
function Resumo({ t, v, cor }) { return <div style={s.summaryItem}><span>{t}</span><strong style={{ color: cor }}>{v}</strong></div> }
function moeda(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
function moedaCampo(v) { return moeda(v) }
function formatarMoedaDigitada(v) { const d=String(v||"").replace(/\D/g,""); return d ? (Number(d)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : "" }
function numeroMoeda(v) { const t=String(v||"").replace(/R\$/g,"").replace(/\s/g,"").replace(/\./g,"").replace(",","."); return Number(t||0) }
function dataBr(v) { if(!v)return "-"; return new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR") }
const s = {
  page:{padding:24,color:"#fff",background:"#082e61",minHeight:"100vh"},hero:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,background:"linear-gradient(135deg,#0b4a84,#087c7c)",padding:24,borderRadius:20,marginBottom:18,border:"1px solid #18c9b2"},badge:{color:"#58ffd0",fontWeight:800},h2:{margin:"6px 0",fontSize:30},h3:{margin:"0 0 6px"},p:{margin:0,color:"#bcd8f5"},home:{width:46,height:46,borderRadius:12,border:"1px solid #49f2c2",background:"#092750",fontSize:23,cursor:"pointer"},card:{background:"#0b2852",border:"1px solid #22558d",borderRadius:18,padding:20,marginBottom:18},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14},label:{display:"flex",flexDirection:"column",gap:7,color:"#bcd8f5",fontSize:13,fontWeight:700,marginBottom:12},input:{boxSizing:"border-box",width:"100%",padding:"12px 13px",borderRadius:10,border:"1px solid #2b6098",background:"#071f43",color:"#fff",fontSize:14},check:{display:"flex",gap:9,alignItems:"center",margin:"4px 0 16px",color:"#dff"},primary:{border:0,borderRadius:10,padding:"12px 18px",background:"linear-gradient(90deg,#08b8ef,#27ed8b)",fontWeight:800,cursor:"pointer"},secondary:{border:"1px solid #2f74ae",borderRadius:9,padding:"9px 13px",background:"#123b6b",color:"#fff",cursor:"pointer"},danger:{border:"1px solid #ff6a78",borderRadius:9,padding:"9px 13px",background:"#6b2433",color:"#fff",cursor:"pointer"},small:{border:0,borderRadius:9,padding:"9px 13px",background:"#09bcea",fontWeight:800,cursor:"pointer"},titleRow:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"},next:{background:"#164f69",color:"#65ffd0",padding:"8px 12px",borderRadius:999,fontSize:12,fontWeight:800},table:{width:"100%",borderCollapse:"collapse"},actions:{display:"flex",gap:8,flexWrap:"wrap"},principal:{display:"inline-block",marginLeft:8,padding:"3px 7px",background:"#167a64",borderRadius:999,fontSize:10},empty:{padding:20,textAlign:"center",color:"#9ab8d7",background:"#071f43",borderRadius:12},success:{display:"flex",flexDirection:"column",gap:5,marginTop:15,padding:14,borderRadius:12,background:"#0c5c50",color:"#caffee"},summary:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:18},summaryItem:{display:"flex",flexDirection:"column",gap:6,padding:14,background:"#071f43",borderRadius:12},entrada:{padding:"4px 8px",borderRadius:999,background:"#145c4a",color:"#6cffc5"},saida:{padding:"4px 8px",borderRadius:999,background:"#652c3b",color:"#ffabb2"},importItem:{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"10px 12px",marginTop:7,background:"#071f43",borderRadius:10,color:"#bcd8f5"},batch:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:14,marginBottom:14,background:"#071f43",borderRadius:12},tableSelect:{minWidth:210,padding:8,borderRadius:8,border:"1px solid #2b6098",background:"#071f43",color:"#fff"},launch:{border:0,borderRadius:9,padding:"10px 14px",background:"#8f69ff",color:"#fff",fontWeight:800,cursor:"pointer"},block:{display:"block",marginTop:5,color:"#91b4d8"},lancado:{padding:"6px 9px",borderRadius:8,background:"#3c3476",color:"#d9d2ff",whiteSpace:"nowrap"}
}
