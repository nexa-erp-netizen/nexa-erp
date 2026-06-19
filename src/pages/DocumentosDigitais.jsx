import { useEffect, useState } from "react"
import api from "../services/api"

export default function DocumentosDigitais() {
  const usuario = JSON.parse(localStorage.getItem("usuario"))
  const isCliente = usuario?.perfil === "Cliente"

  const [cliente, setCliente] = useState(
    isCliente ? usuario?.clienteVinculado || "" : ""
  )

  const [origem, setOrigem] = useState(
    isCliente ? "Cliente → Escritório" : "Escritório → Cliente"
  )

  const [tipo, setTipo] = useState("")
  const [anoCalendario, setAnoCalendario] = useState("")
  const [dataEnvio, setDataEnvio] = useState("")
  const [recibo, setRecibo] = useState("")

  const [status, setStatus] = useState(
    isCliente ? "Entregue pelo cliente" : "Disponível para baixar"
  )

  const [observacao, setObservacao] = useState("")
  const [anexos, setAnexos] = useState([])

  const [clientes, setClientes] = useState([])
  const [documentos, setDocumentos] = useState([])

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      const documentosResposta = await api.get("/documentos-digitais")
      const listaDocumentos = documentosResposta.data || []

      if (isCliente) {
        setDocumentos(
          listaDocumentos.filter(
            (item) => item.cliente === usuario?.clienteVinculado
          )
        )
      } else {
        const clientesResposta = await api.get("/clientes")
        setClientes(clientesResposta.data || [])
        setDocumentos(listaDocumentos)
      }
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

    try {
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
    } catch (error) {
      alert("Erro ao anexar documento")
      console.error(error)
    }
  }

  async function salvarDocumento() {
    const clienteFinal = isCliente ? usuario?.clienteVinculado : cliente

    if (!clienteFinal || !tipo || !anoCalendario) {
      alert("Preencha cliente, tipo e ano-calendário")
      return
    }

    try {
      await api.post("/documentos-digitais", {
        cliente: clienteFinal,
        origem,
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
    } catch (error) {
      alert("Erro ao salvar documento")
      console.error(error)
    }
  }

  async function excluirDocumento(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este documento?"
    )

    if (!confirmar) return

    try {
      await api.delete(`/documentos-digitais/${id}`)
      await carregarDados()
    } catch (error) {
      alert("Erro ao excluir documento")
      console.error(error)
    }
  }

  function limparCampos() {
    setCliente(isCliente ? usuario?.clienteVinculado || "" : "")
    setOrigem(isCliente ? "Cliente → Escritório" : "Escritório → Cliente")
    setTipo("")
    setAnoCalendario("")
    setDataEnvio("")
    setRecibo("")
    setStatus(isCliente ? "Entregue pelo cliente" : "Disponível para baixar")
    setObservacao("")
    setAnexos([])
  }

  return (
    <div style={box}>
      <div style={form}>
        {isCliente ? (
          <input style={input} value={usuario?.clienteVinculado || ""} readOnly />
        ) : (
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
        )}

        {!isCliente && (
          <select
            style={input}
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
          >
            <option value="Cliente → Escritório">Cliente → Escritório</option>
            <option value="Escritório → Cliente">Escritório → Cliente</option>
          </select>
        )}

        {isCliente && <input style={input} value={origem} readOnly />}

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
          placeholder="Ano-calendário / Competência"
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
          placeholder="Número do recibo / referência"
          value={recibo}
          onChange={(e) => setRecibo(e.target.value)}
        />

        <select
          style={input}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="Recebido">Recebido</option>
          <option value="Em análise">Em análise</option>
          <option value="Processado">Processado</option>
          <option value="Arquivado">Arquivado</option>
          <option value="Entregue pelo cliente">Entregue pelo cliente</option>
          <option value="Disponível para baixar">Disponível para baixar</option>
          <option value="Resolvido">Resolvido</option>
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
            <input type="file" multiple hidden onChange={adicionarAnexos} />
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
              {!isCliente && <th style={th}>Cliente</th>}
              <th style={th}>Origem</th>
              <th style={th}>Tipo</th>
              <th style={th}>Competência</th>
              <th style={th}>Data</th>
              <th style={th}>Referência</th>
              <th style={th}>Status</th>
              <th style={th}>Anexos</th>
              {!isCliente && <th style={th}>Ações</th>}
            </tr>
          </thead>

          <tbody>
            {documentos.map((item) => (
              <tr key={item.id}>
                {!isCliente && <td style={td}>{item.cliente}</td>}
                <td style={td}>{item.origem || "-"}</td>
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
                          href={
                            arquivo.caminho?.startsWith("http")
                              ? arquivo.caminho
                              : `https://nexa-erp-api.onrender.com${arquivo.caminho}`
                          }
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

                {!isCliente && (
                  <td style={td}>
                    <button
                      style={deleteButton}
                      onClick={() => excluirDocumento(item.id)}
                    >
                      Excluir
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {documentos.length === 0 && (
              <tr>
                <td style={td} colSpan={isCliente ? 7 : 9}>
                  Nenhum documento encontrado.
                </td>
              </tr>
            )}
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