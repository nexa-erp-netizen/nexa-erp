import { useEffect, useState } from "react"
import api from "../services/api"

export default function Fiscal() {
  const [cliente, setCliente] = useState("")
  const [obrigacao, setObrigacao] = useState("")
  const [competencia, setCompetencia] = useState("")
  const [vencimento, setVencimento] = useState("")
  const [status, setStatus] = useState("")
  const [valor, setValor] = useState("")
  const [observacao, setObservacao] = useState("")
  const [anexos, setAnexos] = useState([])
  const [editandoIndex, setEditandoIndex] = useState(null)

  const [clientesCadastrados, setClientesCadastrados] = useState([])
  const [obrigacoes, setObrigacoes] = useState([])
  
  useEffect(() => {
    carregarObrigacoes()
    carregarClientes()
  }, [])

  async function carregarObrigacoes() {
    try {
      const resposta = await api.get("/fiscal")

      setObrigacoes(resposta.data)
    } catch (error) {
      alert("Erro ao carregar obrigações")
      console.error(error)
    }
  }

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientesCadastrados(resposta.data)
    } catch (error) {
      alert("Erro ao carregar clientes")
      console.error(error)
    }
  }

  function formatarValor(valorDigitado) {
    const somenteNumeros = valorDigitado.replace(/\D/g, "")
    const numero = Number(somenteNumeros) / 100

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function formatarCompetencia(valorDigitado) {
    let valor = valorDigitado.replace(/\D/g, "")

    if (valor.length > 6) {
      valor = valor.slice(0, 6)
    }

    if (valor.length >= 3) {
      valor =
        valor.slice(0, 2) +
        "/" +
        valor.slice(2)
    }

    return valor
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
        "/fiscal/upload",
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
      alert("Erro ao enviar arquivo fiscal")
      console.error(error)
    }
  }

  async function salvarObrigacao() {
  if (
    !cliente ||
    !obrigacao ||
    !competencia ||
    !vencimento ||
    !status
  ) {
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
    if (editandoIndex !== null) {
      const itemEditando =
        obrigacoes[editandoIndex]

      await api.put(
        `/fiscal/${itemEditando.id}`,
        novaObrigacao
      )
    } else {
      await api.post(
        "/fiscal",
        novaObrigacao
      )
    }

    await carregarObrigacoes()

    limparCampos()

    setEditandoIndex(null)
  } catch (error) {
    alert("Erro ao salvar obrigação")
    console.error(error)
  }
}

  function editarObrigacao(index) {
    const item = obrigacoes[index]

    setCliente(item.cliente)
    setObrigacao(item.obrigacao)
    setCompetencia(item.competencia)
    setVencimento(item.vencimento)
    setStatus(item.status)
    setValor(item.valor)
    setObservacao(item.observacao)
    setAnexos(item.anexos || [])

    setEditandoIndex(index)
  }

  async function excluirObrigacao(index) {
  const confirmar = window.confirm(
    "Deseja realmente excluir esta obrigação?"
  )

  if (!confirmar) {
    return
  }

  try {
    const item = obrigacoes[index]

    await api.delete(
      `/fiscal/${item.id}`
    )

    await carregarObrigacoes()
  } catch (error) {
    alert("Erro ao excluir obrigação")
    console.error(error)
  }
}

  function limparCampos() {
    setCliente("")
    setObrigacao("")
    setCompetencia("")
    setVencimento("")
    setStatus("")
    setValor("")
    setObservacao("")
    setAnexos([])
  }
  return (
    <div style={box}>
      <h2>Fiscal</h2>

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

          {clientesCadastrados.map((item) => (
            <option
              key={item.id}
              value={item.nome}
            >
              {item.nome}
            </option>
          ))}
        </select>

        <select
          style={input}
          value={obrigacao}
          onChange={(e) =>
            setObrigacao(e.target.value)
          }
        >
          <option value="">Obrigação</option>
          <option value="DAS">DAS</option>
          <option value="DCTFWeb">
            DCTFWeb
          </option>
          <option value="SPED Fiscal">
            SPED Fiscal
          </option>
          <option value="DEFIS">
            DEFIS
          </option>
          <option value="PGDAS-D">
            PGDAS-D
          </option>
        </select>

        <input
          style={input}
          placeholder="00/0000"
          value={competencia}
          onChange={(e) =>
            setCompetencia(
              formatarCompetencia(
                e.target.value
              )
            )
          }
        />

        <input
          type="date"
          style={input}
          value={vencimento}
          onChange={(e) =>
            setVencimento(e.target.value)
          }
        />

        <select
          style={input}
          value={status}
          onChange={(e) =>
            setStatus(e.target.value)
          }
        >
          <option value="">Status</option>
          <option value="Pendente">
            Pendente
          </option>
          <option value="Em andamento">
            Em andamento
          </option>
          <option value="Enviado">
            Enviado
          </option>
          <option value="Pago">
            Pago
          </option>
          <option value="Atrasado">
            Atrasado
          </option>
        </select>

        <input
          style={input}
          placeholder="R$ 0,00"
          value={valor}
          onChange={(e) =>
            setValor(
              formatarValor(
                e.target.value
              )
            )
          }
        />

        <textarea
          style={textarea}
          placeholder="Observação"
          value={observacao}
          onChange={(e) =>
            setObservacao(e.target.value)
          }
        />

        <div style={uploadBox}>
          <label style={uploadLabel}>
            Anexar Guia / Documento

            <input
              type="file"
              multiple
              style={{
                display: "none",
              }}
              onChange={
                adicionarAnexos
              }
            />
          </label>

          {anexos.length > 0 && (
            <div style={arquivosLista}>
              {anexos.map(
                (arquivo, index) => (
                  <div
                    key={index}
                    style={arquivoItem}
                  >
                    📎 {arquivo.nome}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <button
          style={button}
          onClick={salvarObrigacao}
        >
          {editandoIndex !== null
            ? "Salvar Correção"
            : "Salvar Obrigação"}
        </button>
      </div>

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Cliente</th>
            <th style={th}>Obrigação</th>
            <th style={th}>
              Competência
            </th>
            <th style={th}>
              Vencimento
            </th>
            <th style={th}>Status</th>
            <th style={th}>Valor</th>
            <th style={th}>Alerta</th>
            <th style={th}>Dias</th>
            <th style={th}>Ações</th>
          </tr>
        </thead>

        <tbody>
          {obrigacoes.map(
            (item, index) => (
              <tr key={index}>
                <td style={td}>
                  {item.cliente}
                </td>

                <td style={td}>
                  {item.obrigacao}
                </td>

                <td style={td}>
                  {item.competencia}
                </td>

                <td style={td}>
                  {item.vencimento}
                </td>

                <td style={td}>
                  {item.status}
                </td>

                <td style={td}>
  {item.valor || "Não informado"}
</td>

<td style={td}>
  <span
    style={{
      ...badge,
      ...(item.alertaFiscal === "Vencido"
        ? badgeDanger
        : {}),
      ...(item.alertaFiscal === "Vencendo" ||
      item.alertaFiscal === "Vence hoje"
        ? badgeWarning
        : {}),
      ...(item.alertaFiscal === "Regularizado"
        ? badgeSuccess
        : {}),
    }}
  >
    {item.alertaFiscal || "Em dia"}
  </span>
</td>

<td style={td}>
  {item.diasParaVencer !== null &&
  item.diasParaVencer !== undefined
    ? item.diasParaVencer
    : "-"}
</td>

<td style={td}>
  <div style={actions}>
                    <button
                      style={editButton}
                      onClick={() =>
                        editarObrigacao(
                          index
                        )
                      }
                    >
                      Corrigir
                    </button>

                    <button
                      style={deleteButton}
                      onClick={() =>
                        excluirObrigacao(
                          index
                        )
                      }
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
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
  padding: "12px 10px",
  fontSize: "14px",
}

const actions = {
  display: "flex",
  gap: "10px",
}

const editButton = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "none",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "12px",
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
const badge = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: "999px",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  fontSize: "12px",
}

const badgeDanger = {
  background: "#ff4d4f",
}

const badgeWarning = {
  background: "#ffc107",
  color: "#00112b",
}

const badgeSuccess = {
  background: "#37ff74",
  color: "#00112b",
}