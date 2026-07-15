import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { calcularDasSimples, calcularFatorR } from "../motorTributario"
import { simularConsultoriaTributaria } from "../services/consultoriaTributariaService"

const inicial = {
  rbt12: "",
  receitaMensal: "",
  folha12: "",
  anexo: "III",
  taxaPresumido: "",
  taxaReal: "",
}

export default function ConsultoraTributaria() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState("")
  const [form, setForm] = useState(inicial)
  const [resultado, setResultado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState("")

  useEffect(() => {
    api.get("/clientes").then((resposta) => {
      const lista = Array.isArray(resposta.data) ? resposta.data : []
      setClientes(lista)
      const salvo = localStorage.getItem("nexaConsultoraClienteId")
      if (salvo && lista.some((item) => String(item.id) === String(salvo))) setClienteId(String(salvo))
    }).catch(() => setErro("Não foi possível carregar os clientes."))
  }, [])

  const cliente = useMemo(
    () => clientes.find((item) => String(item.id) === String(clienteId)),
    [clientes, clienteId]
  )

  useEffect(() => {
    if (!cliente) return
    localStorage.setItem("nexaConsultoraClienteId", String(cliente.id))
    setResultado(null)
    setForm((atual) => ({
      ...atual,
      anexo: cliente.anexoSimples || atual.anexo || "III",
    }))
  }, [cliente])

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function analisar(event) {
    event.preventDefault()
    if (!clienteId) return setErro("Selecione um cliente.")
    setCarregando(true)
    setErro("")
    try {
      const rbt12 = Number(form.rbt12)
      const receitaMensal = Number(form.receitaMensal)
      const folha12 = Number(form.folha12 || 0)
      const usaFatorR = cliente?.utilizaFatorR === "Sim"
      const fator = usaFatorR ? calcularFatorR({ rbt12, fs12: folha12 }) : null
      const anexo = usaFatorR ? fator.anexoSugerido : form.anexo
      const das = calcularDasSimples({ anexo, rbt12, receitaTributavel: receitaMensal })

      const resposta = await simularConsultoriaTributaria(clienteId, {
        rbt12,
        receitaMensal,
        folha12,
        taxaSimples: das.aliquotaEfetivaPercentual,
        taxaPresumido: form.taxaPresumido === "" ? null : Number(form.taxaPresumido),
        taxaReal: form.taxaReal === "" ? null : Number(form.taxaReal),
      })

      setResultado({ ...resposta, calculoSimples: das, fatorR: fator, anexoAplicado: anexo })
    } catch (error) {
      console.error(error)
      setErro(error.response?.data?.message || error.message || "Não foi possível concluir a análise.")
      setResultado(null)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <span style={styles.badge}>Módulo 4 • Etapa 3</span>
          <h2 style={styles.title}>Consultora Tributária</h2>
          <p style={styles.subtitle}>Compare cenários, veja riscos e receba uma opinião técnica fundamentada da Nexa.</p>
        </div>
      </header>

      <form style={styles.form} onSubmit={analisar}>
        <Campo label="Cliente">
          <select style={styles.input} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione...</option>
            {[...clientes].sort((a,b) => String(a.nome || "").localeCompare(String(b.nome || ""))).map((item) => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </Campo>
        <Campo label="RBT12">
          <input style={styles.input} type="number" min="0" step="0.01" value={form.rbt12} onChange={(e) => alterar("rbt12", e.target.value)} required />
        </Campo>
        <Campo label="Receita do mês">
          <input style={styles.input} type="number" min="0" step="0.01" value={form.receitaMensal} onChange={(e) => alterar("receitaMensal", e.target.value)} required />
        </Campo>
        <Campo label="Folha 12 meses">
          <input style={styles.input} type="number" min="0" step="0.01" value={form.folha12} onChange={(e) => alterar("folha12", e.target.value)} />
        </Campo>
        <Campo label="Anexo do Simples">
          <select style={styles.input} value={form.anexo} onChange={(e) => alterar("anexo", e.target.value)}>
            {['I','II','III','IV','V'].map((item) => <option key={item} value={item}>Anexo {item}</option>)}
          </select>
        </Campo>
        <Campo label="Taxa projetada Lucro Presumido (%)">
          <input style={styles.input} type="number" min="0" step="0.01" value={form.taxaPresumido} onChange={(e) => alterar("taxaPresumido", e.target.value)} placeholder="Opcional" />
        </Campo>
        <Campo label="Taxa projetada Lucro Real (%)">
          <input style={styles.input} type="number" min="0" step="0.01" value={form.taxaReal} onChange={(e) => alterar("taxaReal", e.target.value)} placeholder="Opcional" />
        </Campo>
        <button style={styles.button} disabled={carregando}>{carregando ? "Analisando..." : "Analisar com a Nexa"}</button>
      </form>

      {cliente && <div style={styles.clientMeta}>{cliente.regime || "Regime não informado"} • {cliente.ramoAtividade || "Ramo não informado"} • {cliente.utilizaFatorR === "Sim" ? "Sujeito ao Fator R" : "Fator R não indicado"}</div>}
      {erro && <div style={styles.error}>{erro}</div>}

      {resultado && (
        <>
          <section style={styles.parecer}>
            <span style={styles.parecerLabel}>Parecer da Nexa</span>
            <strong style={styles.parecerText}>{resultado.parecer}</strong>
            <p style={styles.opinion}>{resultado.opiniaoTecnica}</p>
            <span style={styles.notice}>{resultado.aviso}</span>
          </section>

          <section style={styles.grid}>
            {resultado.cenarios.map((cenario) => (
              <article key={cenario.nome} style={{...styles.card, ...(cenario.nome === resultado.melhorCenarioMatematico ? styles.bestCard : {})}}>
                <span style={styles.cardLabel}>{cenario.nome === resultado.melhorCenarioMatematico ? "Menor custo matemático" : "Cenário"}</span>
                <h3 style={styles.cardTitle}>{cenario.nome}</h3>
                <strong style={styles.value}>{moeda(cenario.valorMensal)}/mês</strong>
                <span style={styles.rate}>{percentual(cenario.taxaEfetiva)}</span>
                <span style={styles.annual}>{moeda(cenario.valorAnualLinear)}/ano em projeção linear</span>
                {cenario.diferencaParaMelhor > 0 && <span style={styles.diff}>+ {moeda(cenario.diferencaParaMelhor)} em relação ao menor cenário</span>}
                <p style={styles.small}>{cenario.observacao}</p>
              </article>
            ))}
          </section>

          <section style={styles.analysisGrid}>
            <Lista titulo="Riscos encontrados" itens={resultado.riscos} vazio="Nenhum risco específico identificado com os dados informados." />
            <Lista titulo="Oportunidades" itens={resultado.oportunidades} vazio="Inclua outros cenários para ampliar a comparação." />
          </section>

          <section style={styles.memory}>
            <h3 style={styles.sectionTitle}>Memória do cálculo do Simples</h3>
            <div style={styles.memoryGrid}>
              <Info label="Anexo aplicado" value={resultado.anexoAplicado} />
              <Info label="Faixa" value={resultado.calculoSimples.faixa} />
              <Info label="Alíquota nominal" value={percentual(resultado.calculoSimples.aliquotaNominalPercentual)} />
              <Info label="Alíquota efetiva" value={percentual(resultado.calculoSimples.aliquotaEfetivaPercentual)} />
              <Info label="DAS-base estimado" value={moeda(resultado.calculoSimples.valorDasBase)} />
              <Info label="Fator R" value={resultado.fatorR ? percentual(resultado.fatorR.fatorRPercentual) : "Não aplicado"} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Campo({ label, children }) {
  return <label style={styles.field}><span style={styles.label}>{label}</span>{children}</label>
}
function Lista({ titulo, itens = [], vazio }) {
  return <section style={styles.listCard}><h3 style={styles.sectionTitle}>{titulo}</h3>{itens.length ? <ul style={styles.list}>{itens.map((item) => <li key={item}>{item}</li>)}</ul> : <p style={styles.small}>{vazio}</p>}</section>
}
function Info({ label, value }) {
  return <div style={styles.info}><span style={styles.label}>{label}</span><strong>{value}</strong></div>
}
function moeda(valor) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0) }
function percentual(valor) { return `${Number(valor || 0).toFixed(2).replace(".", ",")}%` }

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "18px" },
  hero: { background: "linear-gradient(135deg,#061f47,#063875)", border: "1px solid rgba(0,168,255,.28)", borderRadius: "22px", padding: "24px" },
  badge: { color: "#37ff74", fontWeight: "bold", fontSize: "13px" },
  title: { margin: "8px 0", fontSize: "30px" },
  subtitle: { margin: 0, color: "#b8c7dc" },
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "13px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: "18px", padding: "20px" },
  field: { display: "flex", flexDirection: "column", gap: "7px" },
  label: { color: "#a9b8cc", fontSize: "12px" },
  input: { background: "#061f47", color: "white", border: "1px solid rgba(255,255,255,.18)", borderRadius: "10px", padding: "11px", minWidth: 0 },
  button: { alignSelf: "end", background: "#00a8ff", color: "white", border: 0, borderRadius: "10px", padding: "12px 16px", fontWeight: "bold", cursor: "pointer" },
  clientMeta: { color: "#a9b8cc", fontSize: "13px" },
  error: { background: "rgba(255,95,101,.12)", border: "1px solid rgba(255,95,101,.35)", borderRadius: "14px", padding: "15px", color: "#ffb5b8" },
  parecer: { background: "rgba(55,255,116,.08)", border: "1px solid rgba(55,255,116,.24)", borderRadius: "18px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" },
  parecerLabel: { color: "#37ff74", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" },
  parecerText: { fontSize: "18px", lineHeight: 1.5 },
  opinion: { margin: 0, color: "#dce8f8", lineHeight: 1.55 },
  notice: { color: "#a9b8cc", fontSize: "12px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "15px" },
  card: { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: "18px", padding: "19px", display: "flex", flexDirection: "column", gap: "8px" },
  bestCard: { borderColor: "rgba(55,255,116,.65)", boxShadow: "0 0 0 1px rgba(55,255,116,.12)" },
  cardLabel: { color: "#37ff74", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase" },
  cardTitle: { margin: 0, fontSize: "19px" },
  value: { color: "white", fontSize: "25px" },
  rate: { color: "#8bd7ff", fontWeight: "bold" },
  annual: { color: "#c5d2e5" },
  diff: { color: "#ffcf70", fontSize: "13px" },
  small: { color: "#a9b8cc", lineHeight: 1.5, margin: 0 },
  analysisGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "15px" },
  listCard: { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)", borderRadius: "17px", padding: "18px" },
  sectionTitle: { margin: "0 0 12px", fontSize: "17px" },
  list: { margin: 0, paddingLeft: "20px", color: "#dce8f8", lineHeight: 1.7 },
  memory: { background: "#061f47", border: "1px solid rgba(255,255,255,.12)", borderRadius: "18px", padding: "20px" },
  memoryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "11px" },
  info: { background: "rgba(255,255,255,.055)", borderRadius: "12px", padding: "13px", display: "flex", flexDirection: "column", gap: "6px" },
}
