import { useEffect, useState } from "react"
import api from "../services/api"
import { abrirWhatsAppWeb } from "../services/whatsappService"

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

export default function DasMeiAnual({ cliente }) {
  const [guias, setGuias] = useState([])
  const [arquivos, setArquivos] = useState([])
  const [substituir, setSubstituir] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState([])

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

  async function atualizar(guia, alteracoes) {
    try {
      await api.put(`/das-mei/${guia.id}`, alteracoes)
      await carregar()
    } catch (error) {
      alert(error.response?.data?.message || "Não foi possível atualizar a guia.")
    }
  }

  async function abrirGuia(guia) {
    try {
      const resposta = await api.get(`/das-mei/${guia.id}/arquivo`)
      window.open(resposta.data.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      alert("Não foi possível abrir o PDF.")
    }
  }

  async function enviarAgora(guia) {
    const mensagem = `Olá, ${cliente.nome}. Seu DAS-MEI de ${nomeCompetencia(campo(guia, "competencia", "competencia"))} está disponível. Valor: ${moeda(campo(guia, "valor", "valor"))}. Vencimento: ${dataBR(campo(guia, "vencimento", "vencimento"))}.`
    if (!abrirWhatsAppWeb(cliente, mensagem)) return
    await api.post(`/das-mei/${guia.id}/registrar-envio`)
    await carregar()
  }

  return (
    <section id="central-das-mei" style={box}>
      <div style={topo}>
        <div>
          <span style={rotulo}>DAS-MEI anual</span>
          <p style={descricao}>Importe as guias mensais do PGMEI. A Nexa programa automaticamente cada envio para o dia 15 do mês do vencimento.</p>
        </div>
        <label style={botaoArquivo}>
          Selecionar PDFs
          <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => setArquivos(e.target.files)} />
        </label>
      </div>

      <div style={acoes}>
        <span>{arquivos.length ? `${arquivos.length} arquivo(s) selecionado(s)` : "Nenhum arquivo selecionado"}</span>
        <label><input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} /> Substituir guia recalculada</label>
        <button style={botaoPrimario} disabled={carregando || !arquivos.length} onClick={importar}>{carregando ? "Analisando..." : "Importar e organizar"}</button>
      </div>

      {resultado.length > 0 && <div style={resultadoBox}>{resultado.map((item, i) => <div key={i} style={{ color: item.status === "importado" ? "#166534" : "#991b1b" }}><strong>{item.arquivo}:</strong> {item.status === "importado" ? `${nomeCompetencia(item.competencia)} importado` : item.motivo}</div>)}</div>}

      <div style={tabelaWrap}>
        <table style={tabela}>
          <thead><tr><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Envio programado</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {guias.map((guia) => <tr key={guia.id}>
              <td>{nomeCompetencia(campo(guia, "competencia", "competencia"))}</td>
              <td>{dataBR(campo(guia, "vencimento", "vencimento"))}</td>
              <td>{moeda(campo(guia, "valor", "valor"))}</td>
              <td><strong>{dataBR(campo(guia, "dataProgramadaEnvio", "data_programada_envio"))}</strong></td>
              <td><span style={status}>{campo(guia, "statusCalculado", "status_calculado") || guia.status}</span></td>
              <td><div style={botoesLinha}><button style={botaoSecundario} onClick={() => abrirGuia(guia)}>Abrir PDF</button><button style={botaoWhats} onClick={() => enviarAgora(guia)}>Enviar agora</button><button style={botaoPago} onClick={() => atualizar(guia, { status: "Paga" })}>Marcar paga</button></div></td>
            </tr>)}
            {!guias.length && <tr><td colSpan="6" style={{ padding: 22, textAlign: "center", color: "#64748b" }}>Nenhuma guia importada.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={nota}>A data é definida automaticamente no dia 15 do mês do vencimento e não precisa ser preenchida guia por guia.</p>
    </section>
  )
}

const box = { background: "#fff", border: "1px solid #dbe5f0", borderRadius: 16, padding: 20, marginBottom: 20 }
const topo = { display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }
const rotulo = { fontWeight: 800, color: "#0f172a", fontSize: 18 }
const descricao = { margin: "6px 0 0", color: "#64748b" }
const acoes = { display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "16px 0" }
const botaoArquivo = { background: "#e8f0ff", color: "#174ea6", borderRadius: 9, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }
const botaoPrimario = { border: 0, background: "#174ea6", color: "#fff", borderRadius: 9, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }
const resultadoBox = { background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 14, display: "grid", gap: 5 }
const tabelaWrap = { overflowX: "auto" }
const tabela = { width: "100%", borderCollapse: "collapse", minWidth: 920 }
const status = { background: "#eef2ff", color: "#3730a3", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }
const botoesLinha = { display: "flex", gap: 6, flexWrap: "wrap" }
const botaoSecundario = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 7, padding: "7px 9px", cursor: "pointer" }
const botaoWhats = { border: 0, background: "#16a34a", color: "#fff", borderRadius: 7, padding: "7px 9px", cursor: "pointer" }
const botaoPago = { border: 0, background: "#0f766e", color: "#fff", borderRadius: 7, padding: "7px 9px", cursor: "pointer" }
const nota = { color: "#64748b", fontSize: 12, margin: "12px 0 0" }
