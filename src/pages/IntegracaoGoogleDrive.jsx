import { useCallback, useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function IntegracaoGoogleDrive() {
  const [status, setStatus] = useState(null)
  const [pastasRaiz, setPastasRaiz] = useState([])
  const [dadosVinculos, setDadosVinculos] = useState({ itens: [], pastas: [] })
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")
  const [selecoes, setSelecoes] = useState({})
  const [vinculandoId, setVinculandoId] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro("")
    try {
      const { data: atual } = await api.get("/google-drive/status")
      setStatus(atual)
      if (atual.conectado) {
        if (!atual.pastaRaizId) {
          const { data } = await api.get("/google-drive/pastas")
          setPastasRaiz(data)
          setDadosVinculos({ itens: [], pastas: [] })
        } else {
          const { data } = await api.get("/google-drive/vinculos")
          setDadosVinculos(data)
        }
      }
    } catch (error) {
      setErro(error.response?.data?.message || "Não foi possível carregar a integração.")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    function autorizacaoConcluida(evento) {
      if (evento.data?.tipo !== "nexa-google-drive-oauth") return
      if (evento.data.sucesso) {
        setMensagem("Google Drive conectado.")
        carregar()
      } else {
        setErro(evento.data.mensagem || "Não foi possível conectar o Google Drive.")
      }
    }
    window.addEventListener("message", autorizacaoConcluida)
    return () => window.removeEventListener("message", autorizacaoConcluida)
  }, [carregar])

  const vinculados = useMemo(
    () => dadosVinculos.itens.filter((item) => item.vinculo).length,
    [dadosVinculos.itens]
  )

  async function conectar() {
    setErro("")
    try {
      const { data } = await api.get("/google-drive/autorizar")
      const popup = window.open(data.url, "nexa-google-drive", "width=620,height=760")
      if (!popup) setErro("Permita pop-ups neste site para conectar o Google Drive.")
    } catch (error) {
      setErro(error.response?.data?.message || "Não foi possível iniciar a conexão.")
    }
  }

  async function definirRaiz(pasta) {
    setErro("")
    try {
      await api.put("/google-drive/pasta-raiz", { pastaId: pasta.id, pastaNome: pasta.name })
      setMensagem(`Pasta principal definida: ${pasta.name}`)
      await carregar()
    } catch (error) {
      setErro(error.response?.data?.message || "Não foi possível salvar a pasta principal.")
    }
  }

  async function vincular(clienteId, pastaId) {
    const pasta = dadosVinculos.pastas.find((item) => item.id === pastaId)
    if (!pasta) return
    setErro("")
    setVinculandoId(clienteId)
    try {
      await api.put(`/google-drive/vinculos/${clienteId}`, {
        pastaId: pasta.id,
        pastaNome: pasta.name,
      })
      setMensagem(`Pasta “${pasta.name}” vinculada.`)
      setSelecoes((atual) => {
        const proximo = { ...atual }
        delete proximo[clienteId]
        return proximo
      })
      await carregar()
    } catch (error) {
      setErro(error.response?.data?.message || "Não foi possível vincular a pasta.")
    } finally {
      setVinculandoId(null)
    }
  }

  async function desvincular(clienteId) {
    await api.delete(`/google-drive/vinculos/${clienteId}`)
    setMensagem("Vínculo removido.")
    await carregar()
  }

  async function desconectar() {
    if (!window.confirm("Desconectar o Google Drive e remover os vínculos de pastas?")) return
    await api.delete("/google-drive/conexao")
    setMensagem("Google Drive desconectado.")
    await carregar()
  }

  if (carregando && !status) return <div style={styles.pagina}>Carregando integração...</div>

  return (
    <div style={styles.pagina}>
      <div style={styles.cabecalho}>
        <div>
          <h2 style={styles.titulo}>Google Drive</h2>
          <p style={styles.subtitulo}>
            Acesso somente para leitura aos documentos do escritório.
          </p>
        </div>
        {status?.conectado && (
          <span style={styles.selo}>Conectado: {status.emailGoogle}</span>
        )}
      </div>

      {mensagem && <div style={styles.sucesso}>{mensagem}</div>}
      {erro && <div style={styles.erro}>{erro}</div>}

      {!status?.configurado && (
        <section style={styles.card}>
          <h3>Configuração pendente no servidor</h3>
          <p>Cadastre as credenciais OAuth e a chave de criptografia no Render antes de conectar.</p>
        </section>
      )}

      {status?.configurado && !status?.conectado && (
        <section style={styles.card}>
          <h3>Conectar conta Google Workspace</h3>
          <p>A Nexa poderá apenas visualizar e pesquisar arquivos. Ela não poderá alterar, mover ou excluir documentos.</p>
          <button style={styles.botaoPrimario} onClick={conectar}>Conectar Google Drive</button>
        </section>
      )}

      {status?.conectado && !status.pastaRaizId && (
        <section style={styles.card}>
          <h3>Escolha a pasta principal</h3>
          <p>Selecione <strong>Contabilidade Infinity1</strong>. Somente as pastas internas serão usadas nos vínculos.</p>
          <div style={styles.gradePastas}>
            {pastasRaiz.map((pasta) => (
              <button key={pasta.id} style={styles.pasta} onClick={() => definirRaiz(pasta)}>
                📁 {pasta.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {status?.conectado && status.pastaRaizId && (
        <>
          <section style={styles.resumo}>
            <div><small>Pasta principal</small><strong>{status.pastaRaizNome}</strong></div>
            <div><small>Clientes vinculados</small><strong>{vinculados} de {dadosVinculos.itens.length}</strong></div>
            <button style={styles.botaoSecundario} onClick={() => desconectar()}>Desconectar</button>
          </section>

          <section style={styles.card}>
            <h3>Vincular pastas aos clientes</h3>
            <p>Confirme cada associação. Pastas administrativas e modelos podem ficar sem vínculo.</p>
            <div style={styles.lista}>
              {dadosVinculos.itens.map((item) => {
                const sugestao = item.sugestoes?.[0]
                const pastaSelecionada = selecoes[item.clienteId] ?? sugestao?.id ?? ""
                return (
                  <div key={item.clienteId} style={styles.linha}>
                    <div style={styles.cliente}>
                      <strong>{item.clienteNome}</strong>
                      <small>{item.clienteAtivo ? "Cliente ativo" : "Cliente inativo"}</small>
                    </div>
                    {item.vinculo ? (
                      <div style={styles.vinculo}>
                        <span>📁 {item.vinculo.pastaNome}</span>
                        <button style={styles.botaoTexto} onClick={() => desvincular(item.clienteId)}>Remover</button>
                      </div>
                    ) : (
                      <div style={styles.vinculo}>
                        <select
                          style={styles.select}
                          value={pastaSelecionada}
                          onChange={(event) => setSelecoes((atual) => ({
                            ...atual,
                            [item.clienteId]: event.target.value,
                          }))}
                        >
                          <option value="">Selecionar pasta...</option>
                          {dadosVinculos.pastas.map((pasta) => (
                            <option key={pasta.id} value={pasta.id}>
                              {pasta.name}{sugestao?.id === pasta.id ? " — sugestão" : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          style={{
                            ...styles.botaoConfirmar,
                            opacity: !pastaSelecionada || vinculandoId === item.clienteId ? 0.55 : 1,
                          }}
                          disabled={!pastaSelecionada || vinculandoId === item.clienteId}
                          onClick={() => vincular(item.clienteId, pastaSelecionada)}
                        >
                          {vinculandoId === item.clienteId ? "Salvando..." : "Confirmar"}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

const styles = {
  pagina: { padding: 24, color: "#fff", overflowY: "auto", height: "100%" },
  cabecalho: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 20 },
  titulo: { margin: 0, fontSize: 28 },
  subtitulo: { margin: "7px 0 0", color: "#a9bdd8" },
  selo: { background: "#123e36", color: "#67f0bd", padding: "9px 13px", borderRadius: 18, fontSize: 13 },
  card: { background: "rgba(4,24,52,.9)", border: "1px solid #24476e", borderRadius: 14, padding: 20, marginBottom: 18 },
  sucesso: { background: "#123e36", color: "#67f0bd", padding: 12, borderRadius: 9, marginBottom: 14 },
  erro: { background: "#4b1d2a", color: "#ffb3c1", padding: 12, borderRadius: 9, marginBottom: 14 },
  botaoPrimario: { background: "#22c98b", color: "#03271e", border: 0, borderRadius: 9, padding: "11px 17px", fontWeight: 700, cursor: "pointer" },
  botaoSecundario: { background: "transparent", color: "#ff9aad", border: "1px solid #8e3d51", borderRadius: 8, padding: "9px 12px", cursor: "pointer" },
  gradePastas: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 15 },
  pasta: { textAlign: "left", background: "#0c315b", border: "1px solid #2a5b88", color: "#fff", padding: 13, borderRadius: 9, cursor: "pointer" },
  resumo: { display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "center", background: "#092747", border: "1px solid #24476e", borderRadius: 12, padding: 16, marginBottom: 18 },
  lista: { display: "grid", gap: 8, marginTop: 16 },
  linha: { display: "grid", gridTemplateColumns: "minmax(220px,1fr) minmax(280px,1.3fr)", gap: 14, alignItems: "center", background: "#092747", padding: 13, borderRadius: 9 },
  cliente: { display: "flex", flexDirection: "column", gap: 4 },
  vinculo: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  select: { width: "100%", background: "#061a31", color: "#fff", border: "1px solid #315b82", borderRadius: 8, padding: 10 },
  botaoConfirmar: { background: "#22c98b", color: "#03271e", border: 0, borderRadius: 8, padding: "10px 13px", fontWeight: 700, cursor: "pointer" },
  botaoTexto: { background: "transparent", color: "#ff9aad", border: 0, cursor: "pointer" },
}
