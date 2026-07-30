import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

const LINKS = [
  { id: "ecac", titulo: "e-CAC", descricao: "Portal de serviços da Receita Federal", url: "https://cav.receita.fazenda.gov.br/autenticacao/login" },
  { id: "pgdas", titulo: "PGDAS-D", descricao: "Apuração do Simples Nacional", url: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgdasd.app/" },
  { id: "dctfweb", titulo: "DCTFWeb", descricao: "Declarações e débitos previdenciários", url: "https://cav.receita.fazenda.gov.br/autenticacao/login" },
  { id: "caixa-postal", titulo: "Caixa Postal", descricao: "Mensagens e comunicações da Receita", url: "https://cav.receita.fazenda.gov.br/autenticacao/login" },
  { id: "situacao-fiscal", titulo: "Situação Fiscal", descricao: "Pendências e diagnóstico fiscal", url: "https://cav.receita.fazenda.gov.br/autenticacao/login" },
  { id: "cnpj", titulo: "Consulta CNPJ", descricao: "Comprovante de inscrição e situação cadastral", url: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp" },
]

const ACESSO_INICIAL = { metodo:"A1", identificador:"", segredo:"", certificado:null }
const ROTULOS_METODO = {
  A1: "Certificado A1",
  CODIGO_ACESSO: "Código de acesso",
  PROCURACAO: "Procuração eletrônica",
  GOV_BR: "Conta gov.br",
}

function normalizarPerfil(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function diasAte(data) {
  if (!data) return null
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const alvo = new Date(`${String(data).slice(0,10)}T00:00:00`)
  return Math.ceil((alvo-hoje)/86400000)
}

function statusValidade(data, ativo=true) {
  if (!data) return { texto: "Não cadastrado", cor: "#a9b8cc" }
  if (!ativo) return { texto: "Inativo", cor: "#a9b8cc" }
  const dias=diasAte(data)
  if (dias < 0) return { texto: `Vencido há ${Math.abs(dias)} dias`, cor: "#ff5f65" }
  if (dias <= 30) return { texto: `Vence em ${dias} dias`, cor: "#ffd54a" }
  return { texto: `Válido por ${dias} dias`, cor: "#37ff74" }
}

function formatarData(data) {
  if (!data) return "-"
  const [a,m,d]=String(data).slice(0,10).split("-")
  return `${d}/${m}/${a}`
}

export default function CentralEcac({ usuarioLogado }) {
  const [clientes,setClientes]=useState([])
  const [certificados,setCertificados]=useState([])
  const [procuracoes,setProcuracoes]=useState([])
  const [historico,setHistorico]=useState([])
  const [clienteId,setClienteId]=useState("")
  const [carregando,setCarregando]=useState(true)
  const [credenciais,setCredenciais]=useState([])
  const [cofreAtivo,setCofreAtivo]=useState(false)
  const [acesso,setAcesso]=useState(ACESSO_INICIAL)
  const [salvandoAcesso,setSalvandoAcesso]=useState(false)
  const usuario=useMemo(()=>{
    if (usuarioLogado) return usuarioLogado
    try {
      return JSON.parse(localStorage.getItem("usuario")||"{}")
    } catch {
      return {}
    }
  },[usuarioLogado])
  const administrador=normalizarPerfil(usuario?.perfil)==="administrador"

  useEffect(()=>{ carregar() },[])

  async function carregar() {
    setCarregando(true)
    try {
      const [c,cert,proc,hist]=await Promise.all([
        api.get("/clientes"), api.get("/certificados-digitais"), api.get("/procuracoes-ecac"), api.get("/ecac/historico")
      ])
      setClientes(Array.isArray(c.data)?c.data:[])
      setCertificados(Array.isArray(cert.data)?cert.data:[])
      setProcuracoes(Array.isArray(proc.data)?proc.data:[])
      setHistorico(Array.isArray(hist.data)?hist.data:[])
      if (administrador) {
        const [cred, status] = await Promise.all([
          api.get("/credenciais-fiscais"),
          api.get("/credenciais-fiscais/status-cofre"),
        ])
        setCredenciais(Array.isArray(cred.data)?cred.data:[])
        setCofreAtivo(status.data?.configurado===true)
      }
    } catch (e) {
      console.error(e); alert("Não foi possível carregar a Central e-CAC.")
    } finally { setCarregando(false) }
  }

  const cliente=useMemo(()=>clientes.find(c=>String(c.id)===String(clienteId)),[clientes,clienteId])
  const certificado=useMemo(()=>certificados.filter(x=>String(x.clienteId)===String(clienteId)).sort((a,b)=>String(b.dataValidade||"").localeCompare(String(a.dataValidade||"")))[0],[certificados,clienteId])
  const procuracao=useMemo(()=>procuracoes.filter(x=>String(x.clienteId)===String(clienteId)).sort((a,b)=>String(b.dataValidade||"").localeCompare(String(a.dataValidade||"")))[0],[procuracoes,clienteId])
  const acessos=useMemo(()=>historico.filter(x=>!clienteId || String(x.clienteId)===String(clienteId)).slice(0,8),[historico,clienteId])
  const credenciaisCliente=useMemo(
    ()=>credenciais.filter(x=>String(x.clienteId)===String(clienteId)),
    [credenciais,clienteId]
  )

  async function salvarCredencial() {
    if (!cliente) return alert("Selecione o cliente.")
    if (!cofreAtivo) return alert("Ative primeiro a chave do cofre no servidor.")
    if (acesso.metodo==="A1" && !acesso.certificado) return alert("Selecione o certificado .PFX ou .P12.")
    if (acesso.metodo!=="PROCURACAO" && !acesso.segredo) return alert("Informe a senha ou o código de acesso.")
    const dados=new FormData()
    dados.append("clienteId",cliente.id)
    dados.append("cliente",cliente.nome)
    dados.append("metodo",acesso.metodo)
    dados.append("identificador",acesso.identificador)
    dados.append("segredo",acesso.segredo)
    if (acesso.certificado) dados.append("certificado",acesso.certificado)
    setSalvandoAcesso(true)
    try {
      const resposta=await api.post("/credenciais-fiscais",dados)
      setCredenciais(atual=>[resposta.data,...atual])
      setAcesso(ACESSO_INICIAL)
      alert("Acesso protegido e vinculado ao cliente.")
    } catch(e) {
      console.error(e)
      alert(e?.response?.data?.message||"Não foi possível salvar o acesso.")
    } finally { setSalvandoAcesso(false) }
  }

  async function removerCredencial(item) {
    if (!window.confirm(`Remover ${ROTULOS_METODO[item.metodo]||item.metodo} do cofre?`)) return
    try {
      await api.delete(`/credenciais-fiscais/${item.id}`)
      setCredenciais(atual=>atual.filter(x=>x.id!==item.id))
    } catch(e) { alert(e?.response?.data?.message||"Não foi possível remover o acesso.") }
  }

  async function abrir(link) {
    if (!cliente) return alert("Selecione um cliente antes de abrir o serviço.")
    window.open(link.url,"_blank","noopener,noreferrer")
    try {
      const usuario=JSON.parse(localStorage.getItem("usuario")||"{}")
      const resposta=await api.post("/ecac/historico",{
        clienteId: cliente.id, cliente: cliente.nome, servico: link.titulo,
        responsavel: usuario.nome || usuario.email || "Usuário Nexa"
      })
      setHistorico((atual)=>[resposta.data,...atual])
    } catch(e) { console.error("Acesso aberto, mas o histórico não foi registrado:",e) }
  }

  const stCert=statusValidade(certificado?.dataValidade, certificado?.ativo!==false)
  const stProc=statusValidade(procuracao?.dataValidade, procuracao?.ativa!==false)

  return <div style={styles.page}>
    <div style={styles.hero}>
      <div><span style={styles.badge}>Módulo 3 • Identidade Digital</span><h2 style={styles.title}>Central e-CAC</h2><p style={styles.subtitle}>Acessos tributários organizados por cliente, com certificado, procuração e histórico.</p></div>
      <button style={styles.refresh} onClick={carregar}>Atualizar</button>
    </div>

    <div style={styles.card}>
      <label style={styles.label}>Cliente</label>
      <select style={styles.select} value={clienteId} onChange={e=>setClienteId(e.target.value)}>
        <option value="">Selecione uma empresa...</option>
        {[...clientes].sort((a,b)=>String(a.nome).localeCompare(String(b.nome))).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    </div>

    {cliente && <>
      <div style={styles.statusGrid}>
        <Status titulo="Certificado A1" status={stCert} detalhe={certificado?`Validade: ${formatarData(certificado.dataValidade)}`:"Nenhum certificado cadastrado"}/>
        <Status titulo="Procuração e-CAC" status={stProc} detalhe={procuracao?`Validade: ${formatarData(procuracao.dataValidade)}`:"Nenhuma procuração cadastrada"}/>
        <Status titulo="Responsável" status={{texto:procuracao?.responsavel||certificado?.responsavel||"Não informado",cor:"#00a8ff"}} detalhe={procuracao?.servicosAutorizados||"Controle interno da Nexa"}/>
      </div>

      <div style={styles.linksGrid}>{LINKS.map(link=><button key={link.id} style={styles.linkCard} onClick={()=>abrir(link)}><strong style={styles.linkTitle}>{link.titulo}</strong><span style={styles.linkDesc}>{link.descricao}</span><span style={styles.open}>Abrir serviço →</span></button>)}</div>

      {administrador ? <div style={styles.card}>
        <div style={styles.listHeader}>
          <div><h3 style={styles.cardTitle}>Cofre de acessos fiscais</h3><p style={styles.empty}>Vincule o acesso ao cliente. Senhas e certificados nunca retornam da API.</p></div>
          <span style={{...styles.cofreBadge,color:cofreAtivo?"#37ff74":"#ff5f65"}}>{cofreAtivo?"Cofre ativo":"Chave não configurada"}</span>
        </div>
        <div style={styles.formGrid}>
          <select style={styles.select} value={acesso.metodo} onChange={e=>setAcesso({...ACESSO_INICIAL,metodo:e.target.value})}>
            <option value="A1">Certificado digital A1</option>
            <option value="CODIGO_ACESSO">Código de acesso</option>
            <option value="PROCURACAO">Procuração eletrônica</option>
            <option value="GOV_BR">Conta gov.br (cadastro apenas)</option>
          </select>
          <input style={styles.input} value={acesso.identificador} onChange={e=>setAcesso({...acesso,identificador:e.target.value})} placeholder={acesso.metodo==="CODIGO_ACESSO"?"CNPJ/CPF responsável":"Identificador ou observação"} />
          {acesso.metodo==="A1" && <input style={styles.input} type="file" accept=".pfx,.p12" onChange={e=>setAcesso({...acesso,certificado:e.target.files?.[0]||null})} />}
          {acesso.metodo!=="PROCURACAO" && <input style={styles.input} type="password" autoComplete="new-password" value={acesso.segredo} onChange={e=>setAcesso({...acesso,segredo:e.target.value})} placeholder={acesso.metodo==="CODIGO_ACESSO"?"Código de acesso":"Senha (será criptografada)"} />}
          <button style={styles.safeButton} disabled={!cofreAtivo||salvandoAcesso} onClick={salvarCredencial}>{salvandoAcesso?"Protegendo...":"Salvar no cofre"}</button>
        </div>
        <div style={styles.vaultList}>
          {credenciaisCliente.length===0?<p style={styles.empty}>Nenhum método de acesso vinculado.</p>:credenciaisCliente.map(item=><div key={item.id} style={styles.vaultItem}>
            <div><strong>{ROTULOS_METODO[item.metodo]||item.metodo}</strong><span style={styles.meta}>{item.nomeArquivo||item.identificador||"Vínculo cadastrado"} • {item.possuiSegredo?"segredo protegido":"sem senha"} • {item.ativo?"ativo":"inativo"}</span></div>
            <button style={styles.removeButton} onClick={()=>removerCredencial(item)}>Remover</button>
          </div>)}
        </div>
        <p style={styles.warning}>Esta etapa não acessa, transmite nem retifica declarações. A conta gov.br fica cadastrada, mas a automação permanece bloqueada.</p>
      </div> : <div style={styles.card}>
        <h3 style={styles.cardTitle}>Cofre de acessos fiscais</h3>
        <p style={styles.warning}>Disponível somente para usuário com perfil Administrador. Perfil atual: {usuario?.perfil || "não identificado"}.</p>
      </div>}
    </>}

    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Histórico recente de acessos</h3>
      {carregando?<p style={styles.empty}>Carregando...</p>:acessos.length===0?<p style={styles.empty}>Nenhum acesso registrado.</p>:acessos.map(item=><div key={item.id} style={styles.history}><div><strong>{item.servico}</strong><span style={styles.meta}>{item.cliente}</span></div><div style={styles.right}><span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span><span style={styles.meta}>{item.responsavel||"Nexa"}</span></div></div>)}
    </div>
  </div>
}

function Status({titulo,status,detalhe}) { return <div style={styles.statusCard}><span style={styles.label}>{titulo}</span><strong style={{color:status.cor,fontSize:"18px"}}>{status.texto}</strong><span style={styles.meta}>{detalhe}</span></div> }

const styles={
  page:{display:"flex",flexDirection:"column",gap:"18px"}, hero:{background:"linear-gradient(135deg,#061f47,#032f68)",border:"1px solid rgba(55,255,116,.18)",borderRadius:"22px",padding:"24px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"16px",flexWrap:"wrap"}, badge:{color:"#37ff74",fontWeight:"bold",fontSize:"13px"}, title:{margin:"8px 0",fontSize:"30px"}, subtitle:{margin:0,color:"#b8c7dc"}, refresh:{background:"#00a8ff",color:"white",border:0,borderRadius:"10px",padding:"11px 16px",fontWeight:"bold",cursor:"pointer"},
  card:{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)",borderRadius:"18px",padding:"20px"}, label:{display:"block",color:"#a9b8cc",fontSize:"13px",marginBottom:"7px"}, select:{width:"100%",background:"#061f47",color:"white",border:"1px solid rgba(255,255,255,.18)",borderRadius:"10px",padding:"12px"}, input:{width:"100%",boxSizing:"border-box",background:"#061f47",color:"white",border:"1px solid rgba(255,255,255,.18)",borderRadius:"10px",padding:"12px"}, statusGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"12px"}, statusCard:{background:"#061f47",border:"1px solid rgba(255,255,255,.11)",borderRadius:"16px",padding:"17px",display:"flex",flexDirection:"column",gap:"6px"},
  linksGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"12px"}, linkCard:{textAlign:"left",background:"linear-gradient(145deg,#061f47,#07346d)",color:"white",border:"1px solid rgba(0,168,255,.25)",borderRadius:"16px",padding:"18px",cursor:"pointer",display:"flex",flexDirection:"column",gap:"8px"}, linkTitle:{fontSize:"18px"}, linkDesc:{color:"#b8c7dc",minHeight:"38px"}, open:{color:"#37ff74",fontWeight:"bold"}, cardTitle:{marginTop:0}, empty:{color:"#a9b8cc"}, history:{display:"flex",justifyContent:"space-between",gap:"12px",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.08)",flexWrap:"wrap"}, meta:{display:"block",color:"#a9b8cc",fontSize:"13px",marginTop:"4px"}, right:{textAlign:"right",color:"#dce8f8"}
  ,listHeader:{display:"flex",justifyContent:"space-between",gap:"12px",alignItems:"center",flexWrap:"wrap"}, formGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:"10px"}, safeButton:{background:"#37ff74",color:"#00142f",border:0,borderRadius:"10px",padding:"12px",fontWeight:"bold",cursor:"pointer"}, cofreBadge:{fontWeight:"bold",background:"#061f47",padding:"9px 12px",borderRadius:"999px"}, vaultList:{display:"flex",flexDirection:"column",gap:"8px",marginTop:"16px"}, vaultItem:{display:"flex",justifyContent:"space-between",gap:"12px",alignItems:"center",background:"#061f47",padding:"12px",borderRadius:"12px"}, removeButton:{background:"transparent",color:"#ff8a8f",border:"1px solid rgba(255,95,101,.5)",borderRadius:"9px",padding:"8px 11px",cursor:"pointer"}, warning:{color:"#ffd54a",fontSize:"13px",marginBottom:0}
}
