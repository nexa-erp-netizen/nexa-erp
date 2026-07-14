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

export default function CentralEcac() {
  const [clientes,setClientes]=useState([])
  const [certificados,setCertificados]=useState([])
  const [procuracoes,setProcuracoes]=useState([])
  const [historico,setHistorico]=useState([])
  const [clienteId,setClienteId]=useState("")
  const [carregando,setCarregando]=useState(true)

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
    } catch (e) {
      console.error(e); alert("Não foi possível carregar a Central e-CAC.")
    } finally { setCarregando(false) }
  }

  const cliente=useMemo(()=>clientes.find(c=>String(c.id)===String(clienteId)),[clientes,clienteId])
  const certificado=useMemo(()=>certificados.filter(x=>String(x.clienteId)===String(clienteId)).sort((a,b)=>String(b.dataValidade||"").localeCompare(String(a.dataValidade||"")))[0],[certificados,clienteId])
  const procuracao=useMemo(()=>procuracoes.filter(x=>String(x.clienteId)===String(clienteId)).sort((a,b)=>String(b.dataValidade||"").localeCompare(String(a.dataValidade||"")))[0],[procuracoes,clienteId])
  const acessos=useMemo(()=>historico.filter(x=>!clienteId || String(x.clienteId)===String(clienteId)).slice(0,8),[historico,clienteId])

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
  card:{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)",borderRadius:"18px",padding:"20px"}, label:{display:"block",color:"#a9b8cc",fontSize:"13px",marginBottom:"7px"}, select:{width:"100%",background:"#061f47",color:"white",border:"1px solid rgba(255,255,255,.18)",borderRadius:"10px",padding:"12px"}, statusGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"12px"}, statusCard:{background:"#061f47",border:"1px solid rgba(255,255,255,.11)",borderRadius:"16px",padding:"17px",display:"flex",flexDirection:"column",gap:"6px"},
  linksGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"12px"}, linkCard:{textAlign:"left",background:"linear-gradient(145deg,#061f47,#07346d)",color:"white",border:"1px solid rgba(0,168,255,.25)",borderRadius:"16px",padding:"18px",cursor:"pointer",display:"flex",flexDirection:"column",gap:"8px"}, linkTitle:{fontSize:"18px"}, linkDesc:{color:"#b8c7dc",minHeight:"38px"}, open:{color:"#37ff74",fontWeight:"bold"}, cardTitle:{marginTop:0}, empty:{color:"#a9b8cc"}, history:{display:"flex",justifyContent:"space-between",gap:"12px",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.08)",flexWrap:"wrap"}, meta:{display:"block",color:"#a9b8cc",fontSize:"13px",marginTop:"4px"}, right:{textAlign:"right",color:"#dce8f8"}
}
