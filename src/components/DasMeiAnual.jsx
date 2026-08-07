import { useEffect, useState } from "react"
import api from "../services/api"

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

function dataBR(data) {
  if (!data) return "—"
  const [a, m, d] = data.slice(0, 10).split("-")
  return `${d}/${m}/${a}`
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function nomeCompetencia(valor) {
  const [ano, mes] = String(valor || "").split("-")
  return `${MESES[Number(mes) - 1] || mes}/${ano}`
}

function campo(guia, camel, snake) {
  return guia?.[camel] ?? guia?.[snake] ?? ""
}

export default function DasMeiAnual({ cliente, onAtualizarFiscal }) {
  const [guias, setGuias] = useState([])
  const [arquivos, setArquivos] = useState([])
  const [substituir, setSubstituir] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [selecionadas, setSelecionadas] = useState([])
  const [resultado, setResultado] = useState([])
  const [editando, setEditando] = useState(null)

  async function carregar() {
    if (!cliente?.id) return
    try {
      const resposta = await api.get("/das-mei", { params: { clienteId: cliente.id } })
      setGuias(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("Erro ao carregar DAS-MEI", error)
    }
  }

  useEffect(() => { carregar() }, [cliente?.id])

  async function importar() {
    if (!arquivos.length) return alert("Selecione os PDFs mensais do PGMEI.")
    setCarregando(true)
    setResultado([])
    try {
      const dados = new FormData()
      Array.from(arquivos).forEach((arquivo) => dados.append("arquivos", arquivo))
      dados.append("substituir", String(substituir))
      const resposta = await api.post(`/das-mei/importar/${cliente.id}`, dados, { headers: { "Content-Type": "multipart/form-data" } })
      setResultado(resposta.data?.resultados || [])
      setArquivos([])
      await carregar()
    } catch (error) {
      setResultado(error.response?.data?.resultados || [{ arquivo: "Importação", status: "bloqueado", motivo: error.response?.data?.message || "Falha ao importar." }])
    } finally {
      setCarregando(false)
    }
  }

  function alternarSelecao(id) {
    setSelecionadas((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id])
  }

  async function publicarSelecionadas() {
    if (!selecionadas.length) return alert("Marque o mês que deseja enviar ao Portal do Cliente.")
    if (!window.confirm(`Enviar ${selecionadas.length} DAS selecionado(s) para as Pendências do Portal do Cliente?`)) return
    setPublicando(true)
    try {
      await api.post("/das-mei/publicar-portal", { ids: selecionadas })
      setSelecionadas([])
      await carregar()
      await onAtualizarFiscal?.()
      alert("DAS enviado ao Portal do Cliente.")
    } catch (error) {
      alert(error.response?.data?.message || "Não foi possível enviar o DAS ao portal.")
    } finally {
      setPublicando(false)
    }
  }

  function abrirEdicao(guia) {
    setEditando({
      id: guia.id,
      competencia: campo(guia, "competencia", "competencia"),
      vencimento: String(campo(guia, "vencimento", "vencimento")).slice(0, 10),
      valor: campo(guia, "valor", "valor"),
    })
  }

  async function salvarEdicao() {
    if (!editando?.competencia || !editando?.vencimento || !editando?.valor) return alert("Preencha competência, vencimento e valor.")
    try {
      await api.put(`/das-mei/${editando.id}`, {
        competencia: editando.competencia,
        vencimento: editando.vencimento,
        valor: editando.valor,
      })
      setEditando(null)
      await carregar()
      await onAtualizarFiscal?.()
    } catch (error) {
      alert(error.response?.data?.message || "Não foi possível salvar a guia.")
    }
  }

  return (
    <section id="central-das-mei" style={box}>
      <div style={topo}>
        <div>
          <span style={rotulo}>DAS-MEI anual</span>
          <p style={descricao}>Importe as guias do PGMEI, marque o mês desejado e envie diretamente para as Pendências do Portal do Cliente.</p>
        </div>
        <label style={botaoArquivo}>
          Selecionar PDFs
          <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => setArquivos(e.target.files)} />
        </label>
      </div>

      <div style={acoes}>
        <span style={textoAcao}>{arquivos.length ? `${arquivos.length} arquivo(s) selecionado(s)` : "Nenhum arquivo selecionado"}</span>
        <label style={checkboxLabel}><input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} /> Substituir guia recalculada</label>
        <button style={botaoPrimario} disabled={carregando || !arquivos.length} onClick={importar}>{carregando ? "Analisando..." : "Importar e organizar"}</button>
      </div>

      {resultado.length > 0 && <div style={resultadoBox}>{resultado.map((item, i) => <div key={i} style={{ color: item.status === "importado" ? "#86efac" : "#fca5a5" }}><strong>{item.arquivo}:</strong> {item.status === "importado" ? `${nomeCompetencia(item.competencia)} importado` : item.motivo}</div>)}</div>}

      <div style={barraEnvio}>
        <span>{selecionadas.length ? `${selecionadas.length} competência(s) selecionada(s)` : "Marque o mês que deseja disponibilizar ao cliente."}</span>
        <button style={botaoEnviarPortal} disabled={publicando || !selecionadas.length} onClick={publicarSelecionadas}>{publicando ? "Enviando..." : "Enviar ao Portal"}</button>
      </div>

      <div style={tabelaWrap}>
        <table style={tabela}>
          <thead><tr><th style={cabecalho}>Enviar</th><th style={cabecalho}>Competência</th><th style={cabecalho}>Vencimento</th><th style={cabecalho}>Valor</th><th style={cabecalho}>Portal</th><th style={cabecalho}>Editar</th></tr></thead>
          <tbody>
            {guias.map((guia) => {
              const publicada = Boolean(campo(guia, "publicadoNoPortal", "publicado_no_portal"))
              return <tr key={guia.id}>
                <td style={celula}><input aria-label={`Selecionar ${nomeCompetencia(guia.competencia)}`} type="checkbox" style={checkMes} checked={selecionadas.includes(guia.id)} disabled={publicada} onChange={() => alternarSelecao(guia.id)} /></td>
                <td style={celula}><strong>{nomeCompetencia(campo(guia, "competencia", "competencia"))}</strong></td>
                <td style={celula}>{dataBR(campo(guia, "vencimento", "vencimento"))}</td>
                <td style={celula}>{moeda(campo(guia, "valor", "valor"))}</td>
                <td style={celula}><span style={publicada ? statusPortal : statusAguardando}>{publicada ? "No portal" : "Não enviado"}</span></td>
                <td style={celula}><button style={botaoEditar} onClick={() => abrirEdicao(guia)}>Editar</button></td>
              </tr>
            })}
            {!guias.length && <tr><td colSpan="6" style={{ padding: 22, textAlign: "center", color: "#b9c9dc" }}>Nenhuma guia importada.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={nota}>Ao salvar uma edição, a mesma guia é atualizada e a alteração fica registrada no histórico.</p>

      {editando && <div style={modalFundo}>
        <div style={modal}>
          <h3 style={{ marginTop: 0 }}>Editar DAS-MEI</h3>
          <label style={campoLabel}>Competência<input style={input} type="month" value={editando.competencia} onChange={(e) => setEditando({ ...editando, competencia: e.target.value })} /></label>
          <label style={campoLabel}>Vencimento<input style={input} type="date" value={editando.vencimento} onChange={(e) => setEditando({ ...editando, vencimento: e.target.value })} /></label>
          <label style={campoLabel}>Valor<input style={input} type="number" min="0" step="0.01" value={editando.valor} onChange={(e) => setEditando({ ...editando, valor: e.target.value })} /></label>
          <div style={modalAcoes}><button style={botaoCancelar} onClick={() => setEditando(null)}>Cancelar</button><button style={botaoPrimario} onClick={salvarEdicao}>Salvar</button></div>
        </div>
      </div>}
    </section>
  )
}

const box = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: 20, marginBottom: 20 }
const topo = { display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }
const rotulo = { fontWeight: 800, color: "#fff", fontSize: 18 }
const descricao = { margin: "6px 0 0", color: "#c9d6e6" }
const acoes = { display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "16px 0" }
const textoAcao = { color: "#c9d6e6", fontSize: 14 }
const checkboxLabel = { color: "#dbeafe", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }
const botaoArquivo = { background: "#123e73", color: "#fff", border: "1px solid rgba(255,255,255,.14)", borderRadius: 9, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }
const botaoPrimario = { border: 0, background: "#2563eb", color: "#fff", borderRadius: 9, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }
const resultadoBox = { background: "rgba(2,18,43,.55)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 12, marginBottom: 14, display: "grid", gap: 5 }
const barraEnvio = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", background: "rgba(2,18,43,.45)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, color: "#c9d6e6", fontSize: 14 }
const botaoEnviarPortal = { border: 0, background: "#16a34a", color: "#fff", borderRadius: 8, padding: "9px 13px", fontWeight: 800, cursor: "pointer" }
const tabelaWrap = { overflowX: "auto" }
const tabela = { width: "100%", borderCollapse: "collapse", minWidth: 760, background: "transparent", color: "#fff" }
const cabecalho = { background: "rgba(2,18,43,.72)", color: "#bcd2ea", fontSize: 12, fontWeight: 800, textAlign: "left", padding: "11px 10px", borderBottom: "1px solid rgba(255,255,255,.12)", whiteSpace: "nowrap" }
const celula = { color: "#fff", fontSize: 14, textAlign: "left", padding: "11px 10px", borderBottom: "1px solid rgba(255,255,255,.09)", verticalAlign: "middle", background: "transparent", whiteSpace: "nowrap" }
const checkMes = { width: 18, height: 18, accentColor: "#22c55e", cursor: "pointer" }
const statusPortal = { background: "rgba(22,163,74,.22)", color: "#86efac", border: "1px solid rgba(34,197,94,.28)", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 800 }
const statusAguardando = { background: "rgba(37,99,235,.22)", color: "#bfdbfe", border: "1px solid rgba(96,165,250,.25)", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 800 }
const botaoEditar = { border: "1px solid rgba(255,255,255,.20)", background: "#123e73", color: "#fff", borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontWeight: 700 }
const nota = { color: "#b9c9dc", fontSize: 12, margin: "12px 0 0" }
const modalFundo = { position: "fixed", inset: 0, background: "rgba(0,8,24,.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 18 }
const modal = { width: "min(440px, 100%)", background: "#0b2d5b", border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, padding: 20, color: "#fff", boxShadow: "0 24px 70px rgba(0,0,0,.45)" }
const campoLabel = { display: "grid", gap: 7, marginBottom: 14, color: "#dbeafe", fontWeight: 700 }
const input = { width: "100%", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.18)", borderRadius: 9, padding: "10px 11px", background: "#061f47", color: "#fff" }
const modalAcoes = { display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }
const botaoCancelar = { border: "1px solid rgba(255,255,255,.18)", background: "transparent", color: "#fff", borderRadius: 9, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }
