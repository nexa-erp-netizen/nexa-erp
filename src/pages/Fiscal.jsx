import { useEffect, useState } from "react"
import api from "../services/api"

export default function Fiscal() {
  const [cliente, setCliente] = useState("")
  const [clienteFiltro, setClienteFiltro] = useState("")
  const [obrigacao, setObrigacao] = useState("")
  const [competencia, setCompetencia] = useState("")
  const [vencimento, setVencimento] = useState("")
  const [status, setStatus] = useState("")
  const [valor, setValor] = useState("")
  const [observacao, setObservacao] = useState("")
  const [anexos, setAnexos] = useState([])
  const [editandoId, setEditandoId] = useState(null)
  const [arquivoAberto, setArquivoAberto] = useState(null)

  const [clientesCadastrados, setClientesCadastrados] = useState([])
  const [obrigacoes, setObrigacoes] = useState([])

  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}")

  useEffect(() => {
    carregarObrigacoes()
    carregarClientes()

    if (usuario?.perfil === "Cliente") {
      setCliente(usuario.clienteVinculado || "")
      setClienteFiltro(usuario.clienteVinculado || "")
    }
  }, [])

  async function carregarObrigacoes() {
    try {
      const resposta = await api.get("/fiscal")
      setObrigacoes(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      alert("Erro ao carregar obrigações")
      console.error(error)
    }
  }

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientesCadastrados(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      alert("Erro ao carregar clientes")
      console.error(error)
    }
  }

  function formatarValor(valorDigitado) {
    const somenteNumeros = String(valorDigitado).replace(/\D/g, "")
    const numero = Number(somenteNumeros) / 100

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function formatarCompetencia(valorDigitado) {
    let valor = String(valorDigitado).replace(/\D/g, "")

    if (valor.length > 6) valor = valor.slice(0, 6)
    if (valor.length >= 3) valor = valor.slice(0, 2) + "/" + valor.slice(2)

    return valor
  }

  async function obterUrlAnexo(item) {
    if (!item.anexos || item.anexos.length === 0) return ""

    const arquivo = item.anexos[0]
    const caminho = arquivo.caminho || arquivo.url || ""

    if (!caminho) return ""

    const resposta = await api.get(
      `/fiscal/anexo-url?path=${encodeURIComponent(caminho)}`
    )

    return resposta.data.url
  }

  async function abrirAnexo(item) {
    try {
      const url = await obterUrlAnexo(item)

      if (!url) {
        alert("Nenhum anexo disponível.")
        return
      }

      setArquivoAberto(url)
    } catch (error) {
      console.error(error)
      alert("Erro ao abrir anexo.")
    }
  }

  async function adicionarAnexos(e) {
    const arquivos = Array.from(e.target.files || [])
    e.target.value = ""

    if (arquivos.length === 0) return

    const formData = new FormData()
    arquivos.forEach((arquivo) => formData.append("arquivos", arquivo))

    try {
      const resposta = await api.post("/fiscal/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      setAnexos((anteriores) => [...anteriores, ...resposta.data])
    } catch (error) {
      alert("Erro ao enviar arquivo fiscal")
      console.error(error)
    }
  }

  function removerAnexo(index) {
    setAnexos((anteriores) => anteriores.filter((_, i) => i !== index))
  }

  async function salvarObrigacao() {
    if (!cliente || !obrigacao || !competencia || !vencimento || !status) {
      alert("Preencha os campos obrigatórios")
      return
    }

    const novaObrigacao = {
      cliente,
      obrigacao,
      competencia,
      vencimento,
      status,
      valor,
      observacao,
      anexos,
    }

    try {
      if (editandoId !== null) {
        await api.put(`/fiscal/${editandoId}`, novaObrigacao)
      } else {
        await api.post("/fiscal", novaObrigacao)
      }

      await carregarObrigacoes()
      limparCampos()
    } catch (error) {
      alert("Erro ao salvar pendência")
      console.error(error)
    }
  }

  function editarObrigacao(item) {
    setCliente(item.cliente || "")
    setObrigacao(item.obrigacao || "")
    setCompetencia(item.competencia || "")
    setVencimento(item.vencimento || "")
    setStatus(item.status || "")
    setValor(item.valor || "")
    setObservacao(item.observacao || "")
    setAnexos(Array.isArray(item.anexos) ? item.anexos : [])
    setEditandoId(item.id)

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function concluirObrigacao(item) {
    const confirmar = window.confirm(
      "Deseja concluir esta obrigação e gerar lançamento contábil automático?"
    )

    if (!confirmar) return

    try {
      await api.patch(`/fiscal/${item.id}/concluir`)
      await carregarObrigacoes()
    } catch (error) {
      alert("Erro ao concluir obrigação")
      console.error(error)
    }
  }

  async function excluirObrigacao(item) {
    const confirmar = window.confirm("Deseja realmente excluir esta obrigação?")

    if (!confirmar) return

    try {
      if (!item?.id) {
        alert("Não foi possível excluir: ID da obrigação não encontrado.")
        return
      }

      await api.delete(`/fiscal/${item.id}`)
      await carregarObrigacoes()
      alert("Obrigação excluída com sucesso")
    } catch (error) {
      console.error("ERRO AO EXCLUIR OBRIGAÇÃO:", error)
      alert(error?.response?.data?.message || "Erro ao excluir obrigação")
    }
  }

  function limparCampos() {
    setCliente(usuario?.perfil === "Cliente" ? usuario.clienteVinculado || "" : "")
    setObrigacao("")
    setCompetencia("")
    setVencimento("")
    setStatus("")
    setValor("")
    setObservacao("")
    setAnexos([])
    setEditandoId(null)
  }

  function corStatusFiscal(statusFiscal) {
    if (statusFiscal === "Concluído") return badgeBlue
    if (statusFiscal === "Pago pelo cliente" || statusFiscal === "Pago") return badgeSuccess
    if (statusFiscal === "Atrasado") return badgeDanger
    if (statusFiscal === "Pendente" || statusFiscal === "Em andamento") return badgeWarning
    return {}
  }

  const obrigacoesVisiveis = obrigacoes.filter((item) => {
    const statusAtual = String(item.status || "").toLowerCase()
    const concluido = statusAtual.includes("concluído") || statusAtual.includes("concluido")

    if (concluido) return false

    if (usuario?.perfil === "Cliente") {
      return item.cliente === usuario.clienteVinculado
    }

    if (!clienteFiltro) return false

    return item.cliente === clienteFiltro
  })

  return (
    <div style={box}>
      <h2>Pendências e Guias</h2>

      {usuario?.perfil !== "Cliente" && (
        <div style={form}>
          <select style={input} value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="">Selecione o cliente</option>
            {clientesCadastrados.map((item) => (
              <option key={item.id} value={item.nome}>{item.nome}</option>
            ))}
          </select>

          <select style={input} value={obrigacao} onChange={(e) => setObrigacao(e.target.value)}>
            <option value="">Obrigação</option>
            <option value="DAS">DAS</option>
            <option value="Honorários Contábeis">Honorários Contábeis</option>
            <option value="DCTFWeb">DCTFWeb</option>
            <option value="SPED Fiscal">SPED Fiscal</option>
            <option value="DEFIS">DEFIS</option>
            <option value="PGDAS-D">PGDAS-D</option>
          </select>

          <input
            style={input}
            placeholder="00/0000"
            value={competencia}
            onChange={(e) => setCompetencia(formatarCompetencia(e.target.value))}
          />

          <input type="date" style={input} value={vencimento} onChange={(e) => setVencimento(e.target.value)} />

          <select style={input} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Enviado">Enviado</option>
            <option value="Pago">Pago</option>
            <option value="Pago pelo cliente">Pago pelo cliente</option>
            <option value="Concluído">Concluído</option>
            <option value="Atrasado">Atrasado</option>
          </select>

          <input style={input} placeholder="R$ 0,00" value={valor} onChange={(e) => setValor(formatarValor(e.target.value))} />

          <textarea style={textarea} placeholder="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />

          <div style={uploadBox}>
            <label style={uploadLabel}>
              Anexar Guia / Documento
              <input type="file" multiple style={{ display: "none" }} onChange={adicionarAnexos} />
            </label>

            {anexos.length > 0 && (
              <div style={arquivosLista}>
                {anexos.map((arquivo, index) => (
                  <div key={`${arquivo.caminho || arquivo.nome || "arquivo"}-${index}`} style={arquivoItem}>
                    <span>📎 {arquivo.nome || "Arquivo anexado"}</span>

                    <button type="button" style={botaoExcluirAnexo} onClick={() => removerAnexo(index)}>
                      Excluir anexo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="button" style={button} onClick={salvarObrigacao}>
            {editandoId !== null ? "Salvar Correção" : "Salvar Pendência"}
          </button>

          {editandoId !== null && (
            <button type="button" style={buttonSecondary} onClick={limparCampos}>
              Cancelar Correção
            </button>
          )}
        </div>
      )}

      {usuario?.perfil === "Cliente" && (
        <div style={clienteAviso}>
          <strong>Pendências e Guias</strong>
          <span>Visualize guias, honorários, vencimentos e documentos enviados pelo escritório.</span>
        </div>
      )}

      {usuario?.perfil !== "Cliente" && (
        <div style={filterBox}>
          <strong style={{ color: "white" }}>Visualizar cliente</strong>
          <select style={filterInput} value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)}>
            <option value="">Selecione um cliente</option>
            {clientesCadastrados.map((item) => (
              <option key={item.id} value={item.nome}>{item.nome}</option>
            ))}
          </select>
        </div>
      )}

      <div style={tableWrapper}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={th}>Obrigação</th>
              <th style={th}>Competência</th>
              <th style={th}>Vencimento</th>
              <th style={th}>Status</th>
              <th style={th}>Valor</th>
              <th style={th}>Alerta</th>
              <th style={th}>Dias</th>
              <th style={th}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {obrigacoesVisiveis.map((item) => (
              <tr key={item.id}>
                <td style={td}>{item.cliente}</td>
                <td style={td}>{item.obrigacao}</td>
                <td style={td}>{item.competencia}</td>
                <td style={td}>{item.vencimento}</td>

                <td style={td}>
                  <span style={{ ...badge, ...corStatusFiscal(item.status) }}>{item.status}</span>
                </td>

                <td style={td}>{item.valor || "Não informado"}</td>

                <td style={td}>
                  <span
                    style={{
                      ...badge,
                      ...(item.alertaFiscal === "Vencido" ? badgeDanger : {}),
                      ...(item.alertaFiscal === "Vencendo" || item.alertaFiscal === "Vence hoje" ? badgeWarning : {}),
                      ...(item.alertaFiscal === "Regularizado" ? badgeSuccess : {}),
                    }}
                  >
                    {item.alertaFiscal || "Em dia"}
                  </span>
                </td>

                <td style={td}>{item.diasParaVencer !== null && item.diasParaVencer !== undefined ? item.diasParaVencer : "-"}</td>

                <td style={td}>
                  <select
                    style={actionSelect}
                    defaultValue=""
                    onChange={async (e) => {
                      const acao = e.target.value
                      e.target.value = ""

                      if (acao === "visualizar") abrirAnexo(item)

                      if (acao === "baixar") {
                        const url = await obterUrlAnexo(item)
                        if (url) window.open(url, "_blank")
                      }

                      if (acao === "concluir") concluirObrigacao(item)
                      if (acao === "editar") editarObrigacao(item)
                      if (acao === "excluir") excluirObrigacao(item)
                    }}
                  >
                    <option value="">Ações</option>

                    {item.anexos?.length > 0 && (
                      <>
                        <option value="visualizar">Visualizar</option>
                        <option value="baixar">Baixar</option>
                      </>
                    )}

                    {usuario?.perfil !== "Cliente" && item.status !== "Concluído" && (
                      <option value="concluir">Concluir</option>
                    )}

                    {usuario?.perfil !== "Cliente" && (
                      <>
                        <option value="editar">Editar</option>
                        <option value="excluir">Excluir</option>
                      </>
                    )}
                  </select>
                </td>
              </tr>
            ))}

            {obrigacoesVisiveis.length === 0 && (
              <tr>
                <td style={td} colSpan="9">Selecione um cliente para visualizar pendências ativas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {arquivoAberto && (
        <div style={modalBg}>
          <div style={modalPdf}>
            <div style={modalHeader}>
              <strong>Visualizar Documento</strong>
              <button style={modalClose} onClick={() => setArquivoAberto(null)}>Fechar</button>
            </div>

            <iframe src={arquivoAberto} title="Documento Fiscal" style={iframePdf} />
          </div>
        </div>
      )}
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const form = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginBottom: "30px",
}

const input = {
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
}

const textarea = {
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
  minHeight: "100px",
  resize: "vertical",
  gridColumn: "1 / -1",
}

const uploadBox = {
  gridColumn: "1 / -1",
}

const uploadLabel = {
  display: "inline-block",
  padding: "14px 20px",
  borderRadius: "12px",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const arquivosLista = {
  marginTop: "15px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
}

const arquivoItem = {
  background: "#061f47",
  padding: "12px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
}

const botaoExcluirAnexo = {
  background: "#ff4d4f",
  border: "none",
  color: "white",
  padding: "7px 12px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
}

const actionSelect = {
  padding: "9px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const button = {
  padding: "15px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const buttonSecondary = {
  ...button,
  background: "#ff4d4f",
  color: "white",
}

const clienteAviso = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "16px",
  padding: "18px",
  marginBottom: "22px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
}

const filterBox = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: "18px",
  padding: "18px",
  marginBottom: "22px",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
}

const filterInput = {
  ...input,
  minWidth: "260px",
}

const tableWrapper = {
  width: "100%",
  overflowX: "auto",
}

const table = {
  width: "100%",
  borderCollapse: "collapse",
}

const th = {
  textAlign: "left",
  padding: "16px",
  color: "#a9b8cc",
  whiteSpace: "nowrap",
}

const td = {
  padding: "12px 10px",
  fontSize: "14px",
  verticalAlign: "middle",
}

const badge = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: "999px",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  fontSize: "12px",
  whiteSpace: "nowrap",
}

const badgeBlue = { background: "#00a8ff", color: "white" }
const badgeDanger = { background: "#ff4d4f", color: "white" }
const badgeWarning = { background: "#ffc107", color: "#00112b" }
const badgeSuccess = { background: "#37ff74", color: "#00112b" }

const modalBg = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.7)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
}

const modalPdf = {
  width: "90%",
  height: "90%",
  background: "#061f47",
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,.15)",
  overflow: "hidden",
}

const modalHeader = {
  height: "58px",
  padding: "0 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "white",
}

const modalClose = {
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  background: "#ff4d4f",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}

const iframePdf = {
  width: "100%",
  height: "calc(100% - 58px)",
  border: "none",
  background: "white",
}
