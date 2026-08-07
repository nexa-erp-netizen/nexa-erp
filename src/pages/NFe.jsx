import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import "./NFe.css"

const produtoVazio = { clienteId: "", codigo: "", descricao: "", ncm: "", cest: "", cfop: "5102", unidade: "UN", valorUnitario: "", origem: "0", csosn: "102", ativo: true }
const destinatarioVazio = { nome: "", cpfCnpj: "", inscricaoEstadual: "", email: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "PR", codigoMunicipio: "4105805" }

const dinheiro = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function NFe() {
  const [aba, setAba] = useState("notas")
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState("")
  const [config, setConfig] = useState({ serie: 1, proximoNumero: 1, crt: "", naturezaOperacao: "Venda de mercadoria", inscricaoEstadual: "", codigoMunicipio: "4105805", certificadoDigitalId: "" })
  const [diagnostico, setDiagnostico] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [produto, setProduto] = useState(produtoVazio)
  const [produtoEditando, setProdutoEditando] = useState(null)
  const [notas, setNotas] = useState([])
  const [destinatario, setDestinatario] = useState(destinatarioVazio)
  const [itens, setItens] = useState([])
  const [naturezaOperacao, setNaturezaOperacao] = useState("Venda de mercadoria")
  const [valorFrete, setValorFrete] = useState(0)
  const [valorDesconto, setValorDesconto] = useState(0)
  const [mensagem, setMensagem] = useState("")
  const [consultandoSefaz, setConsultandoSefaz] = useState(false)
  const [statusSefaz, setStatusSefaz] = useState(null)
  const [transmitindoId, setTransmitindoId] = useState(null)

  useEffect(() => {
    api.get("/clientes").then((c) => {
      const ativos = (c.data || []).filter((item) => item.ativo !== false && item.cnpj)
      setClientes(ativos)
    }).catch(() => setMensagem("Não foi possível carregar os emitentes."))
  }, [])

  useEffect(() => {
    if (clienteId) carregarModulo()
    else {
      setConfig({ serie: 1, proximoNumero: 1, crt: "", naturezaOperacao: "Venda de mercadoria", inscricaoEstadual: "", codigoMunicipio: "4105805", certificadoDigitalId: "" })
      setDiagnostico(null); setStatusSefaz(null); setProdutos([]); setNotas([]); setProduto(produtoVazio); setProdutoEditando(null); setDestinatario(destinatarioVazio); setItens([])
    }
  }, [clienteId])

  async function carregarModulo() {
    try {
      const [cfg, diag, prods, listaNotas] = await Promise.all([
        api.get(`/nfe/configuracoes/${clienteId}`), api.get(`/nfe/diagnostico/${clienteId}`),
        api.get(`/nfe/produtos?clienteId=${clienteId}`), api.get(`/nfe/notas?clienteId=${clienteId}`),
      ])
      setConfig(cfg.data); setNaturezaOperacao(cfg.data.naturezaOperacao || "Venda de mercadoria")
      setDiagnostico(diag.data); setProdutos(prods.data || []); setNotas(listaNotas.data || [])
      setProduto((p) => ({ ...p, clienteId }))
    } catch { setMensagem("Erro ao carregar o módulo de NF-e.") }
  }

  async function salvarConfiguracao() {
    try { await api.put(`/nfe/configuracoes/${clienteId}`, config); setMensagem("Configuração salva em homologação."); await carregarModulo() }
    catch (error) { setMensagem(error.response?.data?.message || "Erro ao salvar configuração.") }
  }

  async function testarSefaz() {
    setConsultandoSefaz(true); setStatusSefaz(null)
    try {
      const resposta = await api.post(`/nfe/diagnostico/${clienteId}/status-sefaz`)
      setStatusSefaz(resposta.data)
      setMensagem(resposta.data.online ? "SEFA/PR está online e o certificado A1 foi aceito na conexão." : `SEFA/PR respondeu: ${resposta.data.xMotivo || resposta.data.cStat}`)
    } catch (error) { setMensagem(error.response?.data?.message || "Não foi possível consultar a SEFA/PR.") }
    finally { setConsultandoSefaz(false) }
  }

  async function salvarProduto() {
    try {
      const payload = { ...produto, clienteId }
      if (produtoEditando) await api.put(`/nfe/produtos/${produtoEditando}`, payload); else await api.post("/nfe/produtos", payload)
      setProduto({ ...produtoVazio, clienteId }); setProdutoEditando(null); setMensagem("Produto salvo."); await carregarModulo()
    } catch (error) { setMensagem(error.response?.data?.message || "Erro ao salvar produto.") }
  }

  function editarProduto(item) { setProdutoEditando(item.id); setProduto({ ...item, valorUnitario: String(item.valorUnitario || "") }); window.scrollTo({ top: 0, behavior: "smooth" }) }
  function adicionarItem(produtoId) {
    const p = produtos.find((item) => String(item.id) === String(produtoId)); if (!p) return
    setItens((atuais) => [...atuais, { produtoId: p.id, codigo: p.codigo, descricao: p.descricao, ncm: p.ncm, cfop: p.cfop, unidade: p.unidade, origem: p.origem, csosn: p.csosn, quantidade: 1, valorUnitario: Number(p.valorUnitario) }])
  }
  function alterarItem(indice, campo, valor) { setItens((atuais) => atuais.map((item, i) => i === indice ? { ...item, [campo]: valor } : item)) }
  const valorProdutos = useMemo(() => itens.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.valorUnitario || 0), 0), [itens])
  const valorTotal = Math.max(0, valorProdutos + Number(valorFrete || 0) - Number(valorDesconto || 0))

  async function salvarRascunho() {
    try {
      await api.post("/nfe/notas", { clienteId, serie: config.serie, naturezaOperacao, destinatario, itens, valorFrete, valorDesconto })
      setDestinatario(destinatarioVazio); setItens([]); setValorFrete(0); setValorDesconto(0); setMensagem("Rascunho de NF-e salvo."); await carregarModulo()
    } catch (error) { setMensagem(error.response?.data?.message || "Erro ao salvar rascunho.") }
  }

  async function transmitirNota(id) {
    if (!window.confirm("Transmitir esta NF-e para a homologação da SEFA/PR? Ela não terá valor fiscal.")) return
    setTransmitindoId(id)
    try { const resposta = await api.post(`/nfe/notas/${id}/transmitir`); setMensagem(resposta.data?.message || "NF-e autorizada em homologação."); await carregarModulo() }
    catch (error) { setMensagem(error.response?.data?.message || "Falha ao transmitir a NF-e."); await carregarModulo() }
    finally { setTransmitindoId(null) }
  }

  async function abrirArquivo(id, tipo) {
    try {
      const resposta = await api.get(`/nfe/notas/${id}/${tipo}`, { responseType: "blob" }); const url = URL.createObjectURL(resposta.data)
      if (tipo === "danfe") window.open(url, "_blank", "noopener,noreferrer")
      else { const link = document.createElement("a"); link.href = url; link.download = `NFe-${id}.xml`; link.click() }
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (error) { setMensagem(error.response?.data?.message || `Não foi possível abrir o ${tipo.toUpperCase()}.`) }
  }

  return <section className="nfe-page">
    <div className="nfe-head">
      <div><h2>NF-e de produtos</h2><p>Modelo 55 · ambiente de homologação</p></div>
      <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}><option value="">Selecione um cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
    </div>
    <div className="nfe-warning">Ambiente de homologação: as notas transmitidas não possuem valor fiscal. Produção permanece bloqueada.</div>
    {mensagem && <button className="nfe-message" onClick={() => setMensagem("")}>{mensagem} ×</button>}
    <nav className="nfe-tabs">{[["notas","Notas"],["produtos","Produtos"],["config","Configuração"]].map(([id,nome]) => <button className={aba === id ? "active" : ""} onClick={() => setAba(id)} key={id}>{nome}</button>)}</nav>

    {aba === "config" && <div className="nfe-grid">
      <div className="nfe-card"><h3>Emissão</h3><label>Ambiente<input value="Homologação" disabled /></label><label>Inscrição Estadual<input inputMode="numeric" placeholder="Somente números" value={config.inscricaoEstadual || ""} onChange={(e) => setConfig({ ...config, inscricaoEstadual: e.target.value.replace(/\D/g, "") })} /></label><label>Série<input type="number" value={config.serie || 1} onChange={(e) => setConfig({ ...config, serie: e.target.value })} /></label><label>Próximo número<input type="number" value={config.proximoNumero || 1} onChange={(e) => setConfig({ ...config, proximoNumero: e.target.value })} /></label><label>CRT<select value={config.crt || ""} onChange={(e) => setConfig({ ...config, crt: e.target.value })}><option value="">Selecione</option><option value="1">1 — Simples Nacional</option><option value="2">2 — Simples, excesso sublimite</option><option value="3">3 — Regime Normal</option><option value="4">4 — MEI</option></select></label><label>Código IBGE do município<input value={config.codigoMunicipio || ""} placeholder="4105805" onChange={(e) => setConfig({ ...config, codigoMunicipio: e.target.value })} /></label><label>Natureza da operação<input value={config.naturezaOperacao || ""} onChange={(e) => setConfig({ ...config, naturezaOperacao: e.target.value })} /></label><div className={diagnostico?.certificadoA1?.configurado ? "nfe-ok" : "nfe-pendency"}>{diagnostico?.certificadoA1?.configurado ? `✓ A1 do cofre: ${diagnostico.certificadoA1.nomeArquivo || "configurado"}` : "⚠ Certificado A1 ainda não localizado no cofre"}</div><button className="primary" onClick={salvarConfiguracao}>Salvar configuração</button></div>
      <div className="nfe-card"><h3>Diagnóstico SEFA/PR</h3><p>NF-e 4.00 · modelo 55 · homologação</p>{diagnostico?.pendencias?.map((p) => <div className="nfe-pendency" key={p}>⚠ {p}</div>)}{diagnostico?.prontoParaRascunho && <div className="nfe-ok">Cadastro pronto para rascunhos.</div>}{statusSefaz && <div className={statusSefaz.online ? "nfe-ok" : "nfe-pendency"}>{statusSefaz.cStat} — {statusSefaz.xMotivo}</div>}<button className="primary" disabled={!clienteId || !diagnostico?.certificadoA1?.configurado || consultandoSefaz} onClick={testarSefaz}>{consultandoSefaz ? "Consultando SEFA/PR..." : "Testar conexão com a SEFA/PR"}</button></div>
    </div>}

    {aba === "produtos" && <><div className="nfe-card nfe-form"><h3>{produtoEditando ? "Editar produto" : "Novo produto"}</h3>{[["codigo","Código"],["descricao","Descrição"],["ncm","NCM (8 dígitos)"],["cest","CEST"],["cfop","CFOP"],["unidade","Unidade"],["valorUnitario","Valor unitário"],["origem","Origem"],["csosn","CSOSN"]].map(([campo,nome]) => <label key={campo}>{nome}<input value={produto[campo] ?? ""} type={campo === "valorUnitario" ? "number" : "text"} onChange={(e) => setProduto({ ...produto, [campo]: e.target.value })} /></label>)}<button className="primary" onClick={salvarProduto}>Salvar produto</button></div><div className="nfe-card"><h3>Produtos cadastrados</h3><div className="nfe-table"><table><thead><tr><th>Código</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th>Valor</th><th></th></tr></thead><tbody>{produtos.map((p) => <tr key={p.id}><td>{p.codigo}</td><td>{p.descricao}</td><td>{p.ncm}</td><td>{p.cfop}</td><td>{dinheiro(p.valorUnitario)}</td><td><button onClick={() => editarProduto(p)}>Editar</button></td></tr>)}</tbody></table></div></div></>}

    {aba === "notas" && <><div className="nfe-card"><h3>Novo rascunho</h3><div className="nfe-form">{[["nome","Nome/Razão social"],["cpfCnpj","CPF/CNPJ"],["inscricaoEstadual","Inscrição estadual"],["email","E-mail"],["cep","CEP"],["endereco","Endereço"],["numero","Número"],["bairro","Bairro"],["cidade","Cidade"],["estado","UF"],["codigoMunicipio","Código IBGE do município"]].map(([campo,nome]) => <label key={campo}>{nome}<input value={destinatario[campo]} onChange={(e) => setDestinatario({ ...destinatario, [campo]: e.target.value })} /></label>)}</div><label>Natureza da operação<input value={naturezaOperacao} onChange={(e) => setNaturezaOperacao(e.target.value)} /></label><label>Adicionar produto<select defaultValue="" onChange={(e) => { adicionarItem(e.target.value); e.target.value = "" }}><option value="">Selecione</option>{produtos.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}</select></label>{itens.map((item, i) => <div className="nfe-item" key={`${item.produtoId}-${i}`}><strong>{item.descricao}</strong><label>Qtd.<input type="number" value={item.quantidade} onChange={(e) => alterarItem(i,"quantidade",e.target.value)} /></label><label>Unitário<input type="number" value={item.valorUnitario} onChange={(e) => alterarItem(i,"valorUnitario",e.target.value)} /></label><b>{dinheiro(Number(item.quantidade) * Number(item.valorUnitario))}</b><button onClick={() => setItens(itens.filter((_, idx) => idx !== i))}>Remover</button></div>)}<div className="nfe-totals"><label>Frete<input type="number" value={valorFrete} onChange={(e) => setValorFrete(e.target.value)} /></label><label>Desconto<input type="number" value={valorDesconto} onChange={(e) => setValorDesconto(e.target.value)} /></label><strong>Total: {dinheiro(valorTotal)}</strong></div><button className="primary" onClick={salvarRascunho}>Salvar rascunho</button></div>
      <div className="nfe-card"><h3>Notas</h3><div className="nfe-table"><table><thead><tr><th>Data</th><th>Número</th><th>Destinatário</th><th>Status</th><th>Total</th><th>Retorno</th><th>Ações</th></tr></thead><tbody>{notas.map((n) => <tr key={n.id}><td>{new Date(n.createdAt).toLocaleDateString("pt-BR")}</td><td>{n.numero ? `${n.numero}/${n.serie}` : "—"}</td><td>{n.destinatario?.nome}</td><td><span className={`nfe-status ${n.status}`}>{n.status}</span></td><td>{dinheiro(n.valorTotal)}</td><td>{n.codigoStatus ? `${n.codigoStatus} — ${n.motivoStatus || ""}` : "—"}</td><td><div className="nfe-actions">{["rascunho","rejeitada","erro"].includes(n.status) && <button className="primary" disabled={!diagnostico?.prontoParaEmitir || transmitindoId === n.id} onClick={() => transmitirNota(n.id)}>{transmitindoId === n.id ? "Transmitindo..." : "Transmitir"}</button>}{n.status === "autorizada" && <><button onClick={() => abrirArquivo(n.id,"danfe")}>DANFE</button><button onClick={() => abrirArquivo(n.id,"xml")}>XML</button></>}</div></td></tr>)}</tbody></table></div></div></>}
  </section>
}
