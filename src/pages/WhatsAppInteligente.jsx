import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import WhatsAppMenu from "../components/WhatsAppMenu"
import { MODELOS_WHATSAPP, montarMensagemWhatsApp } from "../services/whatsappService"

export default function WhatsAppInteligente() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState("")
  const [modeloId, setModeloId] = useState("das_disponivel")
  const [competencia, setCompetencia] = useState("")
  const [vencimento, setVencimento] = useState("")
  const [valor, setValor] = useState("")
  const [pendencia, setPendencia] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarClientes()
  }, [])

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      const lista = Array.isArray(resposta.data) ? resposta.data : []
      setClientes(lista)
      setClienteId(lista[0]?.id ? String(lista[0].id) : "")
    } catch (error) {
      alert("Erro ao carregar clientes")
      console.error(error)
    } finally {
      setCarregando(false)
    }
  }

  const clienteSelecionado = useMemo(
    () => clientes.find((cliente) => String(cliente.id) === String(clienteId)),
    [clientes, clienteId]
  )

  const dados = useMemo(
    () => ({ competencia, vencimento, valor, pendencia, mensagem }),
    [competencia, vencimento, valor, pendencia, mensagem]
  )

  const previa = useMemo(
    () => montarMensagemWhatsApp({ modeloId, cliente: clienteSelecionado, dados, textoLivre: mensagem }),
    [modeloId, clienteSelecionado, dados, mensagem]
  )

  function atualizarCliente(clienteAtualizado) {
    if (!clienteAtualizado?.id) return

    setClientes((lista) =>
      lista.map((cliente) => (String(cliente.id) === String(clienteAtualizado.id) ? clienteAtualizado : cliente))
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.badge}>Release 3.2</span>
          <h1 style={styles.titulo}>Central de Comunicação WhatsApp</h1>
          <p style={styles.subtitulo}>
            Mensagens prontas, personalizadas por cliente e registradas automaticamente no histórico.
          </p>
        </div>
      </div>

      <div style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitulo}>Preparar mensagem</h2>

          {carregando ? (
            <p style={styles.texto}>Carregando clientes...</p>
          ) : (
            <>
              <label style={styles.label}>Cliente</label>
              <select style={styles.input} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome} {cliente.telefone ? `• ${cliente.telefone}` : ""}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Modelo</label>
              <select style={styles.input} value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
                {MODELOS_WHATSAPP.map((modelo) => (
                  <option key={modelo.id} value={modelo.id}>
                    {modelo.categoria} • {modelo.titulo}
                  </option>
                ))}
              </select>

              <div style={styles.linhaDupla}>
                <div>
                  <label style={styles.label}>Competência</label>
                  <input style={styles.input} placeholder="07/2026" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
                </div>

                <div>
                  <label style={styles.label}>Vencimento</label>
                  <input style={styles.input} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                </div>
              </div>

              <div style={styles.linhaDupla}>
                <div>
                  <label style={styles.label}>Valor</label>
                  <input style={styles.input} placeholder="Ex: 76,90" value={valor} onChange={(e) => setValor(e.target.value)} />
                </div>

                <div>
                  <label style={styles.label}>Pendência</label>
                  <input style={styles.input} placeholder="Ex: DAS, documento, honorário" value={pendencia} onChange={(e) => setPendencia(e.target.value)} />
                </div>
              </div>

              {modeloId === "mensagem_personalizada" && (
                <>
                  <label style={styles.label}>Mensagem personalizada</label>
                  <textarea style={styles.textarea} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
                </>
              )}

              <div style={styles.acaoFinal}>
                <WhatsAppMenu
                  cliente={clienteSelecionado}
                  dados={dados}
                  modeloInicial={modeloId}
                  onRegistrado={atualizarCliente}
                />
              </div>
            </>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitulo}>Prévia inteligente</h2>
          <pre style={styles.preview}>{previa}</pre>

          <div style={styles.assistBox}>
            <strong>🤖 Nexa Assist</strong>
            <p>
              Use “Vence hoje” para cobrança urgente, “Vence em 3 dias” para prevenção e “Documento pendente” quando o cliente ainda precisa enviar algo.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

const styles = {
  container: {
    color: "white",
    padding: "24px",
  },
  header: {
    background: "linear-gradient(135deg, #06285c, #0f766e)",
    borderRadius: "22px",
    padding: "26px",
    marginBottom: "22px",
    border: "1px solid rgba(255,255,255,.12)",
  },
  badge: {
    display: "inline-block",
    background: "rgba(34,197,94,.18)",
    color: "#bbf7d0",
    border: "1px solid rgba(34,197,94,.35)",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 800,
  },
  titulo: {
    margin: "12px 0 6px",
    fontSize: "28px",
  },
  subtitulo: {
    margin: 0,
    color: "#dbeafe",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, .85fr)",
    gap: "20px",
  },
  card: {
    background: "#061f47",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "20px",
    padding: "22px",
  },
  cardTitulo: {
    margin: "0 0 16px",
    fontSize: "20px",
  },
  texto: {
    color: "#c7d2fe",
  },
  label: {
    display: "block",
    margin: "12px 0 7px",
    color: "#9fb7d8",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: "12px",
    padding: "12px",
    background: "#082a5f",
    color: "white",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "100px",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: "12px",
    padding: "12px",
    background: "#082a5f",
    color: "white",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
  linhaDupla: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  acaoFinal: {
    marginTop: "18px",
  },
  preview: {
    minHeight: "260px",
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
    color: "#e5eefc",
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "16px",
    padding: "16px",
    margin: 0,
  },
  assistBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "16px",
    background: "rgba(34,197,94,.10)",
    border: "1px solid rgba(34,197,94,.20)",
    color: "#dcfce7",
  },
}
