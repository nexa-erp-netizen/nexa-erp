import { useEffect, useState } from "react"
import api from "../services/api"

export default function PortalCliente() {
  const [cliente, setCliente] = useState("")
  const [titulo, setTitulo] = useState("")
  const [categoria, setCategoria] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [anexos, setAnexos] = useState([])

  const [clientes, setClientes] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      const clientesResposta = await api.get("/clientes")
      const solicitacoesResposta = await api.get(
        "/solicitacoes-clientes"
      )

      setClientes(clientesResposta.data)
      setSolicitacoes(solicitacoesResposta.data)
    } catch (error) {
      alert("Erro ao carregar portal do cliente")
      console.error(error)
    }
  }

  async function adicionarAnexos(e) {
    const arquivos = Array.from(e.target.files)

    if (arquivos.length === 0) {
      return
    }

    const formData = new FormData()

    arquivos.forEach((arquivo) => {
      formData.append("arquivos", arquivo)
    })

    try {
      const resposta = await api.post(
        "/solicitacoes-clientes/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      )

      setAnexos([
        ...anexos,
        ...resposta.data,
      ])
    } catch (error) {
      alert("Erro ao anexar arquivo")
      console.error(error)
    }
  }

  async function enviarSolicitacao() {
    if (!cliente || !titulo || !categoria || !mensagem) {
      alert("Preencha cliente, título, categoria e mensagem")
      return
    }

    const dados = {
      cliente,
      titulo,
      categoria,
      mensagem,
      status: "Aberta",
      anexos,
    }

    try {
      await api.post("/solicitacoes-clientes", dados)

      await carregarDados()

      limparCampos()
    } catch (error) {
      alert("Erro ao enviar solicitação")
      console.error(error)
    }
  }

  async function excluirSolicitacao(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir esta solicitação?"
    )

    if (!confirmar) {
      return
    }

    try {
      await api.delete(`/solicitacoes-clientes/${id}`)

      await carregarDados()
    } catch (error) {
      alert("Erro ao excluir solicitação")
      console.error(error)
    }
  }

  async function atualizarStatus(item, novoStatus) {
    try {
      await api.put(`/solicitacoes-clientes/${item.id}`, {
        ...item,
        status: novoStatus,
      })

      await carregarDados()
    } catch (error) {
      alert("Erro ao atualizar status")
      console.error(error)
    }
  }

  function limparCampos() {
    setCliente("")
    setTitulo("")
    setCategoria("")
    setMensagem("")
    setAnexos([])
  }

  return (
    <div style={box}>
      <h2>Portal do Cliente</h2>

      <div style={cards}>
        <Card
          title="Solicitações"
          value={solicitacoes.length}
        />

        <Card
          title="Abertas"
          value={
            solicitacoes.filter(
              (item) => item.status === "Aberta"
            ).length
          }
        />

        <Card
          title="Em análise"
          value={
            solicitacoes.filter(
              (item) => item.status === "Em análise"
            ).length
          }
        />

        <Card
          title="Concluídas"
          value={
            solicitacoes.filter(
              (item) => item.status === "Concluída"
            ).length
          }
        />
      </div>

      <div style={formBox}>
        <h3>Nova Solicitação</h3>

        <div style={form}>
          <select
            style={input}
            value={cliente}
            onChange={(e) =>
              setCliente(e.target.value)
            }
          >
            <option value="">
              Selecione o cliente
            </option>

            {clientes.map((item) => (
              <option
                key={item.id}
                value={item.nome}
              >
                {item.nome}
              </option>
            ))}
          </select>

          <input
            style={input}
            placeholder="Título da solicitação"
            value={titulo}
            onChange={(e) =>
              setTitulo(e.target.value)
            }
          />

          <select
            style={input}
            value={categoria}
            onChange={(e) =>
              setCategoria(e.target.value)
            }
          >
            <option value="">
              Categoria
            </option>

            <option value="Documento">
              Documento
            </option>

            <option value="Fiscal">
              Fiscal
            </option>

            <option value="Financeiro">
              Financeiro
            </option>

            <option value="Departamento Pessoal">
              Departamento Pessoal
            </option>

            <option value="Dúvida">
              Dúvida
            </option>
          </select>

          <textarea
            style={textarea}
            placeholder="Mensagem para o escritório"
            value={mensagem}
            onChange={(e) =>
              setMensagem(e.target.value)
            }
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
              <div style={arquivosLista}>
                {anexos.map((arquivo, index) => (
                  <div
                    key={index}
                    style={arquivoItem}
                  >
                    📎 {arquivo.nome}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            style={button}
            onClick={enviarSolicitacao}
          >
            Enviar Solicitação
          </button>
        </div>
      </div>

      <div style={tableBox}>
        <h3>Histórico de Solicitações</h3>

        <div style={tableWrapper}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Cliente</th>
                <th style={th}>Título</th>
                <th style={th}>Categoria</th>
                <th style={th}>Status</th>
                <th style={th}>Anexos</th>
                <th style={th}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {solicitacoes.map((item) => (
                <tr key={item.id}>
                  <td style={td}>{item.cliente}</td>
                  <td style={td}>{item.titulo}</td>
                  <td style={td}>{item.categoria}</td>

                  <td style={td}>
                    <select
                      style={statusSelect}
                      value={item.status}
                      onChange={(e) =>
                        atualizarStatus(
                          item,
                          e.target.value
                        )
                      }
                    >
                      <option value="Aberta">
                        Aberta
                      </option>

                      <option value="Em análise">
                        Em análise
                      </option>

                      <option value="Concluída">
                        Concluída
                      </option>
                    </select>
                  </td>

                  <td style={td}>
                    {item.anexos &&
                      item.anexos.length > 0 ? (
                      <div style={arquivosLista}>
                        {item.anexos.map(
                          (arquivo, index) => (
                            <a
                              key={index}
                              href={`http://localhost:3000${arquivo.caminho}`}
                              target="_blank"
                              rel="noreferrer"
                              style={linkArquivo}
                            >
                              Abrir Anexo
                            </a>
                          )
                        )}
                      </div>
                    ) : (
                      "Nenhum"
                    )}
                  </td>

                  <td style={td}>
                    <button
                      style={deleteButton}
                      onClick={() =>
                        excluirSolicitacao(item.id)
                      }
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
    </div>
  )
}

function Card({ title, value }) {
  return (
    <div style={card}>
      <span style={cardTitle}>
        {title}
      </span>

      <strong style={cardValue}>
        {value}
      </strong>
    </div>
  )
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
}

const cards = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginBottom: "25px",
}

const card = {
  background: "#061f47",
  border:
    "1px solid rgba(255,255,255,.12)",
  borderRadius: "16px",
  padding: "20px",
}

const cardTitle = {
  display: "block",
  color: "#a9b8cc",
  marginBottom: "10px",
}

const cardValue = {
  color: "white",
  fontSize: "26px",
}

const formBox = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "20px",
  padding: "24px",
  marginBottom: "25px",
}

const form = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
}

const input = {
  padding: "15px",
  borderRadius: "12px",
  border:
    "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
}

const textarea = {
  padding: "15px",
  borderRadius: "12px",
  border:
    "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
  minHeight: "110px",
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
  background:
    "linear-gradient(90deg, #00a8ff, #37ff74)",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
}

const tableBox = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "20px",
  padding: "24px",
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
  padding: "16px",
}

const statusSelect = {
  padding: "10px",
  borderRadius: "10px",
  border:
    "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
}

const linkArquivo = {
  color: "#37ff74",
  textDecoration: "none",
  fontWeight: "bold",
}

const deleteButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#ff4d4f",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}