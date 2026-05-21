import { useEffect, useState } from "react"
import api from "../services/api"

export default function DocumentosDigitais() {
  const [cliente, setCliente] = useState("")
  const [tipo, setTipo] = useState("")
  const [anoCalendario, setAnoCalendario] = useState("")
  const [dataEnvio, setDataEnvio] = useState("")
  const [recibo, setRecibo] = useState("")
  const [status, setStatus] = useState("Arquivado")
  const [observacao, setObservacao] = useState("")
  const [anexos, setAnexos] = useState([])

  const [clientes, setClientes] = useState([])
  const [documentos, setDocumentos] = useState([])

  useEffect(() => {
    async function iniciar() {
      await carregarDados()
    }

  iniciar()
}, [])

  async function carregarDados() {
    try {
      const clientesResposta = await api.get("/clientes")
      const documentosResposta = await api.get("/documentos-digitais")

      setClientes(clientesResposta.data || [])
      setDocumentos(documentosResposta.data || [])
    } catch (error) {
      alert("Erro ao carregar documentos digitais")
      console.error(error)
    }
  }

  async function adicionarAnexos(e) {
    const arquivos = Array.from(e.target.files)

    if (arquivos.length === 0) return

    const formData = new FormData()

    arquivos.forEach((arquivo) => {
      formData.append("arquivos", arquivo)
    })

    const resposta = await api.post(
      "/documentos-digitais/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    )

    setAnexos([...anexos, ...resposta.data])
  }

  async function salvarDocumento() {
    if (!cliente || !tipo || !anoCalendario) {
      alert("Preencha cliente, tipo e ano-calendário")
      return
    }

    await api.post("/documentos-digitais", {
      cliente,
      tipo,
      anoCalendario,
      dataEnvio,
      recibo,
      status,
      observacao,
      anexos,
    })

    limparCampos()
    await carregarDados()
  }

  async function excluirDocumento(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este documento?"
    )

    if (!confirmar) return

    await api.delete(`/documentos-digitais/${id}`)
    await carregarDados()
  }

  function limparCampos() {
    setCliente("")
    setTipo("")
    setAnoCalendario("")
    setDataEnvio("")
    setRecibo("")
    setStatus("Arquivado")
    setObservacao("")
    setAnexos([])
  }

  return (
    <div style={box}>
      <h2>Documentos Digitais</h2>

      <div style={form}>
        <select
          style={input}
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
        >
          <option value="">Selecione o cliente</option>

          {clientes.map((item) => (
            <option key={item.id} value={item.nome}>
              {item.nome}
            </option>
          ))}
        </select>

        <select
          style={input}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Tipo de Documento</option>
          <option value="DASN-MEI">DASN-MEI</option>
          <option value="IRPF">IRPF</option>
          <option value="Recibo">Recibo</option>
          <option value="Contrato">Contrato</option>
          <option value="NF-e">NF-e</option>
          <option value="XML">XML</option>
          <option value="Comprovante">Comprovante</option>
          <option value="Outro">Outro</option>
        </select>

        <input
          style={input}
          placeholder="Ano-calendário"
          value={anoCalendario}
          onChange={(e) => setAnoCalendario(e.target.value)}
        />

        <input
          type="date"
          style={input}
          value={dataEnvio}
          onChange={(e) => setDataEnvio(e.target.value)}
        />

        <input
          style={input}
          placeholder="Número do recibo"
          value={recibo}
          onChange={(e) => setRecibo(e.target.value)}
        />

        <select
          style={input}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="Arquivado">Arquivado</option>
          <option value="Entregue">Entregue</option>
          <option value="Pendente">Pendente</option>
          <option value="Conferir">Conferir</option>
        </select>

        <textarea
          style={textarea}
          placeholder="Observação"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />

        <div style={uploadBox}>
          <label style={uploadLabel}>
            Anexar Documento

            <input
              type="file"
              multiple
              hidden
              onChange={adicionarAnexos}
            />
          </label>

          {anexos.length > 0 && (
            <div style={listaArquivos}>
              {anexos.map((arquivo, index) => (
                <div key={index} style={arquivoItem}>
                  📎 {arquivo.nome}
                </div>
              ))}
            </div>
          )}
        </div>

        <button style={button} onClick={salvarDocumento}>
          Salvar Documento
        </button>
      </div>

      <div style={tableWrapper}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Cliente</th>
              <th style={th}>Tipo</th>
              <th style={th}>Ano</th>
              <th style={th}>Data Envio</th>
              <th style={th}>Recibo</th>
              <th style={th}>Status</th>
              <th style={th}>Anexos</th>
              <th style={th}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {documentos.map((item) => (
              <tr key={item.id}>
                <td style={td}>{item.cliente}</td>
                <td style={td}>{item.tipo}</td>
                <td style={td}>{item.anoCalendario}</td>
                <td style={td}>{item.dataEnvio || "-"}</td>
                <td style={td}>{item.recibo || "-"}</td>
                <td style={td}>{item.status}</td>

                <td style={td}>
                  {item.anexos?.length > 0 ? (
                    <div style={listaArquivos}>
                      {item.anexos.map((arquivo, index) => (
                        <a
                          key={index}
                          href={`http://localhost:3000${arquivo.caminho}`}
                          target="_blank"
                          rel="noreferrer"
                          style={linkArquivo}
                        >
                          Abrir Anexo
                        </a>
                      ))}
                    </div>
                  ) : (
                    "Nenhum"
                  )}
                </td>

                <td style={td}>
                  <button
                    style={deleteButton}
                    onClick={() => excluirDocumento(item.id)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

const listaArquivos = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
}

const arquivoItem = {
  background: "rgba(255,255,255,.05)",
  padding: "12px",
  borderRadius: "10px",
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
}

const td = {
  padding: "14px",
}

const linkArquivo = {
  color: "#37ff74",
  textDecoration: "none",
  fontWeight: "bold",
}

const deleteButton = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "none",
  background: "#ff4d4f",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "12px",
}