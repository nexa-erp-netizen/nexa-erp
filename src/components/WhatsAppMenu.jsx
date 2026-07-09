import { useEffect, useMemo, useState } from "react"
import {
  MODELOS_WHATSAPP,
  abrirWhatsAppWeb,
  montarMensagemWhatsApp,
  obterModeloWhatsApp,
  sugerirModeloWhatsApp,
} from "../services/whatsappService"

export default function WhatsAppMenu({
  cliente,
  contexto = {},
  dados: dadosExternos = {},
  modeloInicial,
  onRegister,
  onRegistrado,
  modo = "compacto",
  compacto = false,
}) {
  const contextoUnificado = useMemo(
    () => ({ ...(contexto || {}), ...(dadosExternos || {}) }),
    [contexto, dadosExternos]
  )

  const modeloSugerido = useMemo(() => sugerirModeloWhatsApp(contextoUnificado), [contextoUnificado])
  const modeloInicialId = modeloInicial || modeloSugerido?.id || "das_disponivel"

  const [modeloId, setModeloId] = useState(modeloInicialId)
  const [mensagemEditada, setMensagemEditada] = useState("")
  const [aberto, setAberto] = useState(modo === "central")

  const dados = useMemo(
    () => ({
      cliente,
      clienteNome: cliente?.nome || contextoUnificado.cliente || contextoUnificado.nome || "cliente",
      empresa: cliente?.razaoSocial || cliente?.nomeFantasia || cliente?.nome || contextoUnificado.empresa || "cliente",
      telefone:
        cliente?.whatsapp ||
        cliente?.celular ||
        cliente?.telefone ||
        contextoUnificado.whatsapp ||
        contextoUnificado.celular ||
        contextoUnificado.telefone ||
        "",
      descricao: contextoUnificado.descricao || contextoUnificado.pendencia || contextoUnificado.obrigacao || "pendência",
      pendencia: contextoUnificado.pendencia || contextoUnificado.obrigacao || contextoUnificado.descricao || "pendência",
      competencia: contextoUnificado.competencia || "07/2026",
      vencimento: contextoUnificado.vencimento || contextoUnificado.prazo || "2026-07-20",
      valor: contextoUnificado.valor || "87,05",
      status: contextoUnificado.status || "",
      usuario: contextoUnificado.usuario || "Equipe Nexa",
      mensagem: contextoUnificado.mensagem || "Estamos entrando em contato pelo Nexa ERP.",
      textoLivre: contextoUnificado.textoLivre || contextoUnificado.mensagem || "Estamos entrando em contato pelo Nexa ERP.",
    }),
    [cliente, contextoUnificado]
  )

  const mensagemPronta = useMemo(
    () => montarMensagemWhatsApp({ modeloId, cliente, ...dados }),
    [modeloId, cliente, dados]
  )

  useEffect(() => {
    setModeloId(modeloInicialId)
  }, [modeloInicialId])

  useEffect(() => {
    setMensagemEditada(mensagemPronta)
  }, [mensagemPronta])

  function selecionarModelo(novoModeloId) {
    setModeloId(novoModeloId)
    setMensagemEditada(montarMensagemWhatsApp({ modeloId: novoModeloId, cliente, ...dados }))
  }

  async function copiarMensagem() {
    try {
      await navigator.clipboard.writeText(mensagemEditada)
      alert("Mensagem copiada.")
    } catch {
      alert("Não foi possível copiar a mensagem automaticamente.")
    }
  }

  function enviar() {
    const abriu = abrirWhatsAppWeb({ cliente, telefone: dados.telefone, mensagem: mensagemEditada })
    if (!abriu) return

    const modelo = obterModeloWhatsApp(modeloId)
    const payload = {
      modelo: modeloId,
      modeloTitulo: modelo?.titulo || "Mensagem WhatsApp",
      mensagem: mensagemEditada,
      dados,
      cliente: dados.clienteNome,
    }

    if (typeof onRegister === "function") onRegister(payload)
    if (typeof onRegistrado === "function") onRegistrado(cliente)
    if (modo !== "central") setAberto(false)
  }

  return (
    <div style={modo === "central" ? styles.wrapperCentral : styles.wrapper}>
      {modo !== "central" && (
        <button
          type="button"
          style={compacto ? styles.botaoCompacto : styles.button}
          onClick={() => setAberto(!aberto)}
        >
          💬 WhatsApp
        </button>
      )}

      {aberto && (
        <div style={modo === "central" ? styles.panelCentral : styles.panel}>
          <div style={styles.topo}>
            <div>
              <strong style={styles.titulo}>WhatsApp Inteligente</strong>
              <p style={styles.subtitulo}>Sugestão automática: {modeloSugerido?.titulo}</p>
            </div>
            {modo !== "central" && (
              <button type="button" style={styles.close} onClick={() => setAberto(false)}>
                ×
              </button>
            )}
          </div>

          <div style={styles.modelosGrid}>
            {MODELOS_WHATSAPP.map((item) => {
              const ativo = item.id === modeloId
              const sugerido = item.id === modeloSugerido?.id
              return (
                <button
                  key={item.id}
                  type="button"
                  style={{ ...styles.modeloCard, ...(ativo ? styles.modeloCardAtivo : {}) }}
                  onClick={() => selecionarModelo(item.id)}
                >
                  <span style={styles.modeloIcone}>{item.icone}</span>
                  <span style={styles.modeloTitulo}>{item.titulo}</span>
                  <small style={styles.modeloCategoria}>{sugerido ? "Sugerido pelo Assist" : item.categoria}</small>
                </button>
              )
            })}
          </div>

          <label style={styles.label}>Mensagem</label>
          <textarea
            style={styles.textarea}
            value={mensagemEditada}
            onChange={(e) => setMensagemEditada(e.target.value)}
          />

          <div style={styles.infoLinha}>
            <span>
              Cliente: <strong>{dados.clienteNome}</strong>
            </span>
            <span>
              Telefone: <strong>{dados.telefone || "não cadastrado"}</strong>
            </span>
          </div>

          <div style={styles.actions}>
            <button type="button" style={styles.cancel} onClick={copiarMensagem}>
              Copiar
            </button>
            <button type="button" style={styles.send} onClick={enviar}>
              Abrir WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrapper: { position: "relative", display: "inline-block" },
  wrapperCentral: { width: "100%" },
  button: { border: "none", borderRadius: "12px", padding: "12px 16px", background: "linear-gradient(90deg, #1bd741, #37ff74)", color: "#00112b", fontWeight: "bold", cursor: "pointer" },
  botaoCompacto: { border: "1px solid rgba(34,197,94,.45)", borderRadius: "999px", padding: "7px 10px", background: "rgba(34,197,94,.14)", color: "#bbf7d0", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" },
  panel: { position: "absolute", right: 0, top: "48px", width: "min(620px, 90vw)", background: "#061f47", border: "1px solid rgba(55,255,116,.35)", borderRadius: "18px", padding: "16px", zIndex: 50, boxShadow: "0 18px 45px rgba(0,0,0,.38)" },
  panelCentral: { width: "100%", background: "rgba(6,31,71,.72)", border: "1px solid rgba(55,255,116,.22)", borderRadius: "18px", padding: "16px", boxSizing: "border-box" },
  topo: { display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "14px" },
  titulo: { color: "white", fontSize: "18px" },
  subtitulo: { margin: "6px 0 0", color: "#a9b8cc", fontSize: "13px" },
  close: { border: "none", background: "rgba(255,255,255,.12)", color: "white", width: "30px", height: "30px", borderRadius: "10px", cursor: "pointer" },
  modelosGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "14px" },
  modeloCard: { textAlign: "left", border: "1px solid rgba(255,255,255,.12)", borderRadius: "14px", padding: "12px", background: "#001f45", color: "white", cursor: "pointer" },
  modeloCardAtivo: { border: "1px solid rgba(55,255,116,.85)", background: "linear-gradient(135deg, rgba(0,168,255,.25), rgba(55,255,116,.16))" },
  modeloIcone: { display: "block", fontSize: "20px", marginBottom: "7px" },
  modeloTitulo: { display: "block", fontWeight: "bold", fontSize: "13px" },
  modeloCategoria: { display: "block", color: "#a9b8cc", marginTop: "5px" },
  label: { display: "block", color: "#a9b8cc", fontSize: "12px", margin: "0 0 6px" },
  textarea: { width: "100%", minHeight: "170px", padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,.14)", background: "#001f45", color: "white", resize: "vertical", boxSizing: "border-box", whiteSpace: "pre-wrap" },
  infoLinha: { display: "flex", flexWrap: "wrap", gap: "12px", color: "#a9b8cc", fontSize: "12px", marginTop: "10px" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" },
  cancel: { border: "none", borderRadius: "10px", padding: "10px 13px", background: "rgba(255,255,255,.12)", color: "white", cursor: "pointer" },
  send: { border: "none", borderRadius: "10px", padding: "10px 13px", background: "#37ff74", color: "#00112b", fontWeight: "bold", cursor: "pointer" },
}
