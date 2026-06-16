import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

export default function Declaracoes() {
  const [clientes, setClientes] = useState([])
  const [declaracoes, setDeclaracoes] = useState([])
  const [clienteFiltro, setClienteFiltro] = useState("")
  const [editandoId, setEditandoId] = useState(null)
  const [arquivoAberto, setArquivoAberto] = useState(null)

  const [form, setForm] = useState({
    cliente: "",
    tipo: "",
    ano: "",
    vencimento: "",
    status: "Pendente",
    observacao: "",
    anexos: [],
  })

  useEffect(() => {
    carregarTudo()
  }, [])

  async function carregarTudo() {
    await Promise.all([carregarClientes(), carregarDeclaracoes()])
  }

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientes(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("Erro ao carregar clientes:", error)
      setClientes([])
    }
  }

  async function carregarDeclaracoes() {
    try {
      const resposta = await api.get("/declaracoes")
      setDeclaracoes(Array.isArray(resposta.data) ? resposta.data : [])
    } catch (error) {
      console.error("Erro ao carregar declarações:", error)
      setDeclaracoes([])
    }
  }

  function formatarData(data) {
    if (!data) return "-"
    return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR")
  }

  function statusVisual(status) {
    const texto = String(status || "Pendente").toLowerCase()

    if (texto.includes("conclu") || texto.includes("entregue")) {
      return { label: "Concluída", style: "green" }
    }

    if (texto.includes("documentos enviados")) {
      return { label: "Conferir", style: "blue" }
    }

    if (texto.includes("análise") || texto.includes("analise")) {
      return { label: "Em análise", style: "blue" }
    }

    if (texto.includes("pendente")) {
      return { label: "Pendente", style: "yellow" }
    }

    return { label: status || "Pendente", style: "yellow" }
  }

  async function adicionarAnexos(e) {
    const arquivos = Array.from(e.target.files || [])
    if (arquivos.length === 0) return

    const formData = new FormData()
    arquivos.forEach((arquivo) => formData.append("arquivos", arquivo))

    try {
      const resposta = await api.post("/declaracoes/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      setForm({
        ...form,
        anexos: [...(form.anexos || []), ...resposta.data],
      })
    } catch (error) {
      console.error(error)
      alert("Erro ao enviar anexo da declaração.")
    }
  }

  async function obterUrlAnexo(item) {
    if (!item.anexos || item.anexos.length === 0) return ""

    const arquivo = item.anexos[0]
    const caminho = arquivo.caminho || arquivo.url || ""

    if (!caminho) return ""

    const resposta = await api.get(
      `/declaracoes/anexo-url?path=${encodeURIComponent(caminho)}`
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

  async function baixarAnexo(item) {
    try {
      const url = await obterUrlAnexo(item)

      if (!url) {
        alert("Nenhum anexo disponível.")
        return
      }

      window.open(url, "_blank")
    } catch (error) {
      console.error(error)
      alert("Erro ao baixar anexo.")
    }
  }

  async function salvarDeclaracao() {
    if (!form.cliente || !form.tipo || !form.ano || !form.status) {
      alert("Preencha cliente, tipo, ano e status.")
      return
    }

    try {
      if (editandoId) {
        await api.put(`/declaracoes/${editandoId}`, form)
      } else {
        await api.post("/declaracoes", form)
      }

      limparFormulario()
      await carregarDeclaracoes()
    } catch (error) {
      console.error(error)
      alert("Erro ao salvar declaração.")
    }
  }

  function editarDeclaracao(item) {
    setEditandoId(item.id)
    setForm({
      cliente: item.cliente || "",
      tipo: item.tipo || "",
      ano: item.ano || "",
      vencimento: item.vencimento || "",
      status: item.status || "Pendente",
      observacao: item.observacao || "",
      anexos: item.anexos || [],
    })

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function concluirDeclaracao(item) {
    if (!window.confirm("Deseja concluir esta declaração?")) return

    try {
      await api.patch(`/declaracoes/${item.id}/concluir`)
      await carregarDeclaracoes()
    } catch (error) {
      console.error(error)
      alert("Erro ao concluir declaração.")
    }
  }

  async function excluirDeclaracao(item) {
    if (!window.confirm("Deseja excluir esta declaração?")) return

    try {
      await api.delete(`/declaracoes/${item.id}`)
      await carregarDeclaracoes()
    } catch (error) {
      console.error(error)
      alert("Erro ao excluir declaração.")
    }
  }

  function limparFormulario() {
    setEditandoId(null)
    setForm({
      cliente: "",
      tipo: "",
      ano: "",
      vencimento: "",
      status: "Pendente",
      observacao: "",
      anexos: [],
    })
  }

  const declaracoesFiltradas = useMemo(() => {
    return declaracoes.filter((item) => {
      if (!clienteFiltro) return true
      return item.cliente === clienteFiltro
    })
  }, [declaracoes, clienteFiltro])

  return (
    <div className="dec-page">
      <style>{`
        .dec-page { color: white; }
        .dec-card {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 22px;
          padding: 20px;
          margin-bottom: 18px;
        }
        .dec-title { font-size: 28px; font-weight: 900; margin: 0 0 16px; }
        .dec-form {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 10px;
        }
        .dec-input, .dec-select, .dec-textarea {
          background: #061f47;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 10px;
          color: white;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }
        .dec-input, .dec-select { height: 42px; padding: 0 12px; }
        .dec-textarea {
          grid-column: 1 / -1;
          min-height: 58px;
          padding: 10px 12px;
          resize: vertical;
        }
        .dec-actions {
          grid-column: 1 / -1;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dec-btn {
          min-height: 42px;
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          font-weight: 900;
          cursor: pointer;
        }
        .dec-btn-main { background: linear-gradient(90deg,#00a8ff,#37ff74); color: #00112b; }
        .dec-btn-blue { background: #00a8ff; color: white; }
        .dec-btn-red { background: #ff4d4f; color: white; }
        .dec-filter {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .dec-table-wrapper { overflow-x: auto; }
        .dec-table { width: 100%; border-collapse: collapse; }
        .dec-table th {
          color: #a9b8cc;
          text-align: left;
          padding: 11px 10px;
          font-size: 13px;
          white-space: nowrap;
        }
        .dec-table td {
          padding: 10px;
          font-size: 14px;
          border-top: 1px solid rgba(255,255,255,.07);
          vertical-align: middle;
        }
        .dec-badge {
          display: inline-block;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }
        .green { background: #37ff74; color: #00112b; }
        .blue { background: #00a8ff; color: white; }
        .yellow { background: #ffc107; color: #00112b; }
        .dec-action-select {
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.15);
          background: #061f47;
          color: white;
          font-weight: 800;
          padding: 0 10px;
        }
        .dec-files {
          grid-column: 1 / -1;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .dec-file {
          background: #061f47;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 13px;
        }
        .modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.7);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal-pdf {
          width: 90%;
          height: 90%;
          background: #061f47;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.15);
          overflow: hidden;
        }
        .modal-header {
          height: 56px;
          padding: 0 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .modal-pdf iframe { width: 100%; height: calc(100% - 56px); border: none; background: white; }
      `}</style>

      <div className="dec-card">
        <h2 className="dec-title">Declarações</h2>

        <div className="dec-form">
          <select
            className="dec-select"
            value={form.cliente}
            onChange={(e) => setForm({ ...form, cliente: e.target.value })}
          >
            <option value="">Cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.nome}>
                {cliente.nome}
              </option>
            ))}
          </select>

          <select
            className="dec-select"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            <option value="">Tipo</option>
            <option value="IRPF">IRPF</option>
            <option value="DASN-SIMEI">DASN-SIMEI</option>
            <option value="DEFIS">DEFIS</option>
            <option value="DIRF">DIRF</option>
            <option value="ECD">ECD</option>
            <option value="ECF">ECF</option>
            <option value="Outras">Outras</option>
          </select>

          <input
            className="dec-input"
            placeholder="Ano"
            value={form.ano}
            onChange={(e) => setForm({ ...form, ano: e.target.value })}
          />

          <input
            className="dec-input"
            type="date"
            value={form.vencimento}
            onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
          />

          <select
            className="dec-select"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="Pendente">Pendente</option>
            <option value="Aguardando documentos">Aguardando documentos</option>
            <option value="Documentos enviados pelo cliente">Documentos enviados pelo cliente</option>
            <option value="Em análise">Em análise</option>
            <option value="Concluída">Concluída</option>
          </select>

          <textarea
            className="dec-textarea"
            placeholder="Observação"
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
          />

          <div className="dec-actions">
            <label className="dec-btn dec-btn-blue">
              Anexar declaração/documento
              <input type="file" multiple style={{ display: "none" }} onChange={adicionarAnexos} />
            </label>

            <button type="button" className="dec-btn dec-btn-main" onClick={salvarDeclaracao}>
              {editandoId ? "Salvar alterações" : "Salvar"}
            </button>

            {editandoId && (
              <button type="button" className="dec-btn dec-btn-red" onClick={limparFormulario}>
                Cancelar edição
              </button>
            )}
          </div>

          {form.anexos?.length > 0 && (
            <div className="dec-files">
              {form.anexos.map((arquivo, index) => (
                <div className="dec-file" key={index}>📎 {arquivo.nome}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dec-card">
        <div className="dec-filter">
          <strong style={{ color: "#c9d6e6" }}>Visualizar cliente</strong>
          <select
            className="dec-select"
            style={{ maxWidth: "280px" }}
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
          >
            <option value="">Todos os clientes</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.nome}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="dec-table-wrapper">
          <table className="dec-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Ano</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Anexo</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {declaracoesFiltradas.map((item) => {
                const status = statusVisual(item.status)

                return (
                  <tr key={item.id}>
                    <td>{item.cliente}</td>
                    <td>{item.tipo}</td>
                    <td>{item.ano}</td>
                    <td>{formatarData(item.vencimento)}</td>
                    <td><span className={`dec-badge ${status.style}`}>{status.label}</span></td>
                    <td>{item.anexos?.length > 0 ? `${item.anexos.length} arquivo(s)` : "-"}</td>
                    <td>
                      <select
                        className="dec-action-select"
                        defaultValue=""
                        onChange={(e) => {
                          const acao = e.target.value
                          e.target.value = ""

                          if (acao === "visualizar") abrirAnexo(item)
                          if (acao === "baixar") baixarAnexo(item)
                          if (acao === "concluir") concluirDeclaracao(item)
                          if (acao === "editar") editarDeclaracao(item)
                          if (acao === "excluir") excluirDeclaracao(item)
                        }}
                      >
                        <option value="">Ações</option>
                        {item.anexos?.length > 0 && (
                          <>
                            <option value="visualizar">Visualizar</option>
                            <option value="baixar">Baixar</option>
                          </>
                        )}
                        {item.status !== "Concluída" && <option value="concluir">Concluir</option>}
                        <option value="editar">Editar</option>
                        <option value="excluir">Excluir</option>
                      </select>
                    </td>
                  </tr>
                )
              })}

              {declaracoesFiltradas.length === 0 && (
                <tr>
                  <td colSpan="7">Nenhuma declaração encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {arquivoAberto && (
        <div className="modal-bg">
          <div className="modal-pdf">
            <div className="modal-header">
              <strong>Visualizar Declaração</strong>
              <button type="button" className="dec-btn dec-btn-red" onClick={() => setArquivoAberto(null)}>
                Fechar
              </button>
            </div>
            <iframe src={arquivoAberto} title="Declaração" />
          </div>
        </div>
      )}
    </div>
  )
}
