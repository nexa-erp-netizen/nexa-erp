import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { carregarMemoriaCliente } from "../services/memoriaNexaService"
import ResumoInteligenteCard from "../components/ResumoInteligenteCard"
import TimelineCliente from "../components/TimelineCliente"

export default function MemoriaNexa() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState("")
  const [memoria, setMemoria] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState("")

  useEffect(() => {
    async function iniciar() {
      try {
        const resposta = await api.get("/clientes")
        const lista = Array.isArray(resposta.data) ? resposta.data : []
        setClientes(lista)

        const clienteSalvo = localStorage.getItem("nexaMemoriaClienteId")
        if (clienteSalvo && lista.some((item) => String(item.id) === String(clienteSalvo))) {
          setClienteId(String(clienteSalvo))
        }
      } catch (error) {
        console.error(error)
        setErro("Não foi possível carregar os clientes.")
      }
    }

    iniciar()
  }, [])

  useEffect(() => {
    if (!clienteId) {
      setMemoria(null)
      return
    }

    localStorage.setItem("nexaMemoriaClienteId", String(clienteId))
    carregar()
  }, [clienteId])

  async function carregar() {
    setCarregando(true)
    setErro("")
    try {
      const dados = await carregarMemoriaCliente(clienteId)
      setMemoria(dados)
    } catch (error) {
      console.error(error)
      setErro(error.response?.data?.message || error.message || "Erro ao carregar a memória da Nexa.")
      setMemoria(null)
    } finally {
      setCarregando(false)
    }
  }

  const clienteSelecionado = useMemo(
    () => clientes.find((item) => String(item.id) === String(clienteId)),
    [clientes, clienteId]
  )

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <span style={styles.badge}>Módulo 4 • Nexa IA</span>
          <h2 style={styles.title}>Memória da Nexa</h2>
          <p style={styles.subtitle}>Histórico unificado e contexto permanente de cada cliente.</p>
        </div>
        <button style={styles.refresh} onClick={carregar} disabled={!clienteId || carregando}>
          {carregando ? "Atualizando..." : "Atualizar memória"}
        </button>
      </header>

      <section style={styles.selectorCard}>
        <label style={styles.label}>Cliente</label>
        <select style={styles.select} value={clienteId} onChange={(event) => setClienteId(event.target.value)}>
          <option value="">Selecione um cliente...</option>
          {[...clientes]
            .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")))
            .map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
        </select>
        {clienteSelecionado && (
          <span style={styles.clientMeta}>
            {clienteSelecionado.regime || "Regime não informado"} • {clienteSelecionado.cnpj || clienteSelecionado.cpf || "Documento não informado"}
          </span>
        )}
      </section>

      {erro && <div style={styles.error}>{erro}</div>}
      {!clienteId && <div style={styles.empty}>Selecione um cliente para a Nexa montar o contexto completo.</div>}
      {carregando && <div style={styles.empty}>A Nexa está organizando o histórico do cliente...</div>}

      {!carregando && memoria && (
        <>
          <ResumoInteligenteCard memoria={memoria} />

          <div style={styles.identityGrid}>
            <IdentityCard
              titulo="Certificado digital"
              valor={memoria.identidadeDigital?.certificado ? `Válido até ${formatarData(memoria.identidadeDigital.certificado.dataValidade)}` : "Não cadastrado"}
            />
            <IdentityCard
              titulo="Procuração e-CAC"
              valor={memoria.identidadeDigital?.procuracao ? `Válida até ${formatarData(memoria.identidadeDigital.procuracao.dataValidade)}` : "Não cadastrada"}
            />
            <IdentityCard titulo="Próximas ações" valor={`${memoria.proximasAcoes?.length || 0} registrada(s)`} />
          </div>

          <TimelineCliente itens={memoria.timeline || []} />
        </>
      )}
    </div>
  )
}

function formatarData(data) {
  if (!data) return "-"
  const [ano, mes, dia] = String(data).slice(0, 10).split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : String(data)
}

function IdentityCard({ titulo, valor }) {
  return (
    <div style={styles.identityCard}>
      <span style={styles.identityLabel}>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  )
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: { background: "linear-gradient(135deg,#061f47,#032f68)", border: "1px solid rgba(55,255,116,.18)", borderRadius: "22px", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "8px 0", fontSize: "30px" },
  subtitle: { margin: 0, color: "#b8c7dc" },
  refresh: { background: "#00a8ff", color: "white", border: 0, borderRadius: "10px", padding: "11px 16px", fontWeight: "bold", cursor: "pointer" },
  selectorCard: { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: "18px", padding: "20px" },
  label: { display: "block", color: "#a9b8cc", fontSize: "13px", marginBottom: "7px" },
  select: { width: "100%", background: "#061f47", color: "white", border: "1px solid rgba(255,255,255,.18)", borderRadius: "10px", padding: "12px" },
  clientMeta: { display: "block", color: "#a9b8cc", marginTop: "9px", fontSize: "13px" },
  empty: { background: "rgba(255,255,255,.05)", borderRadius: "15px", padding: "22px", color: "#a9b8cc", textAlign: "center" },
  error: { background: "rgba(255,95,101,.12)", border: "1px solid rgba(255,95,101,.35)", borderRadius: "14px", padding: "15px", color: "#ffb5b8" },
  identityGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "12px" },
  identityCard: { background: "#061f47", border: "1px solid rgba(255,255,255,.10)", borderRadius: "15px", padding: "17px" },
  identityLabel: { display: "block", color: "#a9b8cc", fontSize: "12px", marginBottom: "7px" },
}
