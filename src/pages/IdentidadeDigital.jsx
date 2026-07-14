import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { classificarValidade, montarAlertasIdentidadeDigital, resumirAlertasIdentidade } from "../services/alertasIdentidadeService"

function statusPorValidade(data, ativo = true) {
  const status = classificarValidade(data, ativo)
  const cores = { vencido: "#ff5f65", critico: "#ff7a3d", alto: "#ffb84d", atencao: "#ffd54a", preventivo: "#00a8ff", regular: "#37ff74", incompleto: "#a9b8cc", inativo: "#a9b8cc" }
  const niveis = { vencido: 0, critico: 1, alto: 1, atencao: 1, preventivo: 2, regular: 3, incompleto: 4, inativo: 4 }
  return { texto: status.texto, cor: cores[status.nivel] || "#a9b8cc", nivel: niveis[status.nivel] ?? 4 }
}

function formatarData(data) {
  if (!data) return "-"
  const [ano, mes, dia] = String(data).slice(0, 10).split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : String(data)
}

export default function IdentidadeDigital({ setPage }) {
  const [clientes, setClientes] = useState([])
  const [certificados, setCertificados] = useState([])
  const [procuracoes, setProcuracoes] = useState([])
  const [pesquisa, setPesquisa] = useState("")
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const [rClientes, rCertificados, rProcuracoes] = await Promise.all([
        api.get("/clientes"),
        api.get("/certificados-digitais"),
        api.get("/procuracoes-ecac"),
      ])
      setClientes(Array.isArray(rClientes.data) ? rClientes.data : [])
      setCertificados(Array.isArray(rCertificados.data) ? rCertificados.data : [])
      setProcuracoes(Array.isArray(rProcuracoes.data) ? rProcuracoes.data : [])
    } catch (error) {
      console.error(error)
      alert("Erro ao carregar o Painel de Identidade Digital")
    } finally {
      setCarregando(false)
    }
  }

  const alertas = useMemo(() => montarAlertasIdentidadeDigital({ clientes, certificados, procuracoes }), [clientes, certificados, procuracoes])
  const resumoAlertas = useMemo(() => resumirAlertasIdentidade(alertas), [alertas])

  const linhas = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()
    return clientes
      .filter((cliente) => !termo || String(cliente.nome || "").toLowerCase().includes(termo))
      .map((cliente) => {
        const certs = certificados.filter((item) => String(item.clienteId) === String(cliente.id))
        const procs = procuracoes.filter((item) => String(item.clienteId) === String(cliente.id))
        const certificado = [...certs].sort((a, b) => String(b.dataValidade || "").localeCompare(String(a.dataValidade || "")))[0]
        const procuracao = [...procs].sort((a, b) => String(b.dataValidade || "").localeCompare(String(a.dataValidade || "")))[0]
        const statusCertificado = certificado ? statusPorValidade(certificado.dataValidade, certificado.ativo !== false) : { texto: "Não cadastrado", cor: "#a9b8cc", nivel: 3 }
        const statusProcuracao = procuracao ? statusPorValidade(procuracao.dataValidade, procuracao.ativa !== false) : { texto: "Não cadastrada", cor: "#a9b8cc", nivel: 3 }
        return { cliente, certificado, procuracao, statusCertificado, statusProcuracao, prioridade: Math.min(statusCertificado.nivel, statusProcuracao.nivel) }
      })
      .sort((a, b) => a.prioridade - b.prioridade || String(a.cliente.nome).localeCompare(String(b.cliente.nome)))
  }, [clientes, certificados, procuracoes, pesquisa])

  const resumo = useMemo(() => {
    const base = { regulares: 0, atencao: 0, vencidos: 0, incompletos: 0 }
    linhas.forEach((item) => {
      const niveis = [item.statusCertificado.nivel, item.statusProcuracao.nivel]
      if (niveis.includes(0)) base.vencidos += 1
      else if (niveis.includes(1)) base.atencao += 1
      else if (niveis.includes(3)) base.incompletos += 1
      else base.regulares += 1
    })
    return base
  }, [linhas])

  function abrirCertificados(cliente) {
    localStorage.setItem("nexaCertificadoClienteId", String(cliente.id))
    setPage("Certificados Digitais")
  }

  function abrirProcuracoes(cliente) {
    localStorage.setItem("nexaProcuracaoClienteId", String(cliente.id))
    setPage("Procurações e-CAC")
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <span style={styles.badge}>Módulo 3 • Identidade Digital</span>
          <h2 style={styles.title}>Painel de Identidade Digital</h2>
          <p style={styles.subtitle}>Visão única de certificados A1 e procurações e-CAC por cliente.</p>
        </div>
        <button style={styles.refreshButton} onClick={carregar}>Atualizar painel</button>
      </div>

      <div style={styles.resumoGrid}>
        <Resumo titulo="Regulares" valor={resumo.regulares} cor="#37ff74" />
        <Resumo titulo="Atenção" valor={resumo.atencao} cor="#ffd54a" />
        <Resumo titulo="Vencidos" valor={resumo.vencidos} cor="#ff5f65" />
        <Resumo titulo="Vencidos" valor={resumoAlertas.vencidos} cor="#ff5f65" />
        <Resumo titulo="Em até 7 dias" valor={resumoAlertas.em7Dias} cor="#ff7a3d" />
        <Resumo titulo="Em até 30 dias" valor={resumoAlertas.em15Dias + resumoAlertas.em30Dias} cor="#ffd54a" />
        <Resumo titulo="Em até 60 dias" valor={resumoAlertas.em60Dias} cor="#00a8ff" />
        <Resumo titulo="Cadastro incompleto" valor={resumo.incompletos} cor="#a9b8cc" />
      </div>

      <div style={styles.card}>
        <div style={styles.listHeader}>
          <div>
            <h3 style={styles.cardTitle}>Clientes e acessos digitais</h3>
            <p style={styles.help}>Clientes com vencimento ou cadastro incompleto aparecem primeiro.</p>
          </div>
          <input style={styles.search} placeholder="Pesquisar cliente..." value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
        </div>

        {carregando ? <p style={styles.empty}>Carregando identidade digital...</p> : (
          <div style={styles.list}>
            {linhas.length === 0 ? <p style={styles.empty}>Nenhum cliente encontrado.</p> : linhas.map((item) => (
              <div key={item.cliente.id} style={styles.item}>
                <div style={styles.clientHeader}>
                  <div>
                    <strong style={styles.clientName}>{item.cliente.nome}</strong>
                    <span style={styles.clientMeta}>{item.cliente.cnpj || item.cliente.cpf || "Documento não informado"}</span>
                  </div>
                  <span style={{ ...styles.overall, color: item.prioridade === 0 ? "#ff5f65" : item.prioridade === 1 ? "#ffd54a" : item.prioridade === 2 ? "#37ff74" : "#a9b8cc" }}>
                    {item.prioridade === 0 ? "Crítico" : item.prioridade === 1 ? "Atenção" : item.prioridade === 2 ? "Regular" : "Incompleto"}
                  </span>
                </div>

                <div style={styles.identityGrid}>
                  <IdentityBox
                    titulo="Certificado A1"
                    status={item.statusCertificado}
                    detalhe={item.certificado ? `Validade: ${formatarData(item.certificado.dataValidade)}` : "Nenhum certificado cadastrado"}
                    extra={item.certificado?.localArquivo ? `Local: ${item.certificado.localArquivo}` : ""}
                    botao={item.certificado ? "Abrir certificados" : "Cadastrar certificado"}
                    onClick={() => abrirCertificados(item.cliente)}
                  />
                  <IdentityBox
                    titulo="Procuração e-CAC"
                    status={item.statusProcuracao}
                    detalhe={item.procuracao ? `Validade: ${formatarData(item.procuracao.dataValidade)}` : "Nenhuma procuração cadastrada"}
                    extra={item.procuracao?.servicosAutorizados ? `Serviços: ${item.procuracao.servicosAutorizados}` : ""}
                    botao={item.procuracao ? "Abrir procurações" : "Cadastrar procuração"}
                    onClick={() => abrirProcuracoes(item.cliente)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Resumo({ titulo, valor, cor }) {
  return <div style={styles.resumo}><span style={styles.resumoTitulo}>{titulo}</span><strong style={{ ...styles.resumoValor, color: cor }}>{valor}</strong></div>
}

function IdentityBox({ titulo, status, detalhe, extra, botao, onClick }) {
  return (
    <div style={styles.identityBox}>
      <div style={styles.identityTop}>
        <strong>{titulo}</strong>
        <span style={{ ...styles.status, color: status.cor }}>{status.texto}</span>
      </div>
      <span style={styles.detail}>{detalhe}</span>
      {extra && <span style={styles.extra}>{extra}</span>}
      <button style={styles.actionButton} onClick={onClick}>{botao}</button>
    </div>
  )
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: { background: "linear-gradient(135deg,#061f47,#032f68)", border: "1px solid rgba(55,255,116,.18)", borderRadius: "22px", padding: "24px", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "8px 0", fontSize: "30px" },
  subtitle: { margin: 0, color: "#b8c7dc" },
  refreshButton: { background: "#00a8ff", color: "white", border: "none", borderRadius: "10px", padding: "11px 16px", fontWeight: "bold", cursor: "pointer" },
  resumoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px" },
  resumo: { background: "#061f47", border: "1px solid rgba(255,255,255,.11)", borderRadius: "16px", padding: "18px" },
  resumoTitulo: { display: "block", color: "#a9b8cc", fontSize: "13px" },
  resumoValor: { display: "block", fontSize: "30px", marginTop: "5px" },
  card: { background: "rgba(255,255,255,.06)", borderRadius: "20px", padding: "22px", border: "1px solid rgba(255,255,255,.10)" },
  listHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" },
  cardTitle: { margin: 0 },
  help: { margin: "6px 0 0", color: "#a9b8cc", fontSize: "13px" },
  search: { minWidth: "250px", padding: "10px", borderRadius: "10px", border: "1px solid rgba(255,255,255,.18)", background: "#061f47", color: "white" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  item: { background: "#061f47", border: "1px solid rgba(255,255,255,.10)", borderRadius: "16px", padding: "16px" },
  clientHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" },
  clientName: { display: "block", fontSize: "18px" },
  clientMeta: { display: "block", color: "#a9b8cc", fontSize: "13px", marginTop: "3px" },
  overall: { fontWeight: "bold" },
  identityGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "12px" },
  identityBox: { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", borderRadius: "13px", padding: "14px", display: "flex", flexDirection: "column", gap: "7px" },
  identityTop: { display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" },
  status: { fontWeight: "bold", fontSize: "13px" },
  detail: { color: "#dce8f8", fontSize: "13px" },
  extra: { color: "#a9b8cc", fontSize: "12px", wordBreak: "break-word" },
  actionButton: { alignSelf: "flex-start", background: "transparent", color: "#37ff74", border: "1px solid rgba(55,255,116,.35)", borderRadius: "9px", padding: "8px 11px", cursor: "pointer", fontWeight: "bold", marginTop: "4px" },
  empty: { color: "#a9b8cc" },
}
