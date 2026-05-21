import { useEffect, useState } from "react"
import api from "../services/api"

export default function LancamentosContabeis() {
  const [cliente, setCliente] = useState("")
  const [data, setData] = useState("")
  const [competencia, setCompetencia] = useState("")
  const [tipo, setTipo] = useState("")
  const [planoConta, setPlanoConta] = useState("")
  const [descricao, setDescricao] = useState("")
  const [valor, setValor] = useState("")
  const [formaPagamento, setFormaPagamento] = useState("")
  const [observacao, setObservacao] = useState("")
  const [editandoId, setEditandoId] = useState(null)
  const [anexos, setAnexos] = useState([])

  const [clientes, setClientes] = useState([])
  const [contas, setContas] = useState([])
  const [lancamentos, setLancamentos] = useState([])

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    const clientesResposta = await api.get("/clientes")
    const contasResposta = await api.get("/plano-contas")
    const lancamentosResposta = await api.get("/lancamentos-contabeis")

    setClientes(clientesResposta.data)
    setContas(contasResposta.data)
    setLancamentos(lancamentosResposta.data)
  }

  function formatarCompetencia(valorDigitado) {
    let valor = valorDigitado.replace(/\D/g, "")

    if (valor.length > 6) {
      valor = valor.slice(0, 6)
    }

    if (valor.length >= 3) {
      valor = valor.slice(0, 2) + "/" + valor.slice(2)
    }

    return valor
  }

  function formatarValor(valorDigitado) {
    const somenteNumeros = valorDigitado.replace(/\D/g, "")
    const numero = Number(somenteNumeros) / 100

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
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
      "/lancamentos-contabeis/upload",
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
    alert("Erro ao anexar documento")
    console.error(error)
  }
}  

  async function salvarLancamento() {
    if (
      !cliente ||
      !data ||
      !competencia ||
      !tipo ||
      !planoConta ||
      !descricao ||
      !valor
    ) {
      alert("Preencha os campos obrigatórios")
      return
    }

    const dados = {
      cliente,
      data,
      competencia,
      tipo,
      planoConta,
      descricao,
      valor,
      formaPagamento,
      observacao,
      anexos,
    }

    if (editandoId) {
      await api.put(`/lancamentos-contabeis/${editandoId}`, dados)
    } else {
      await api.post("/lancamentos-contabeis", dados)
    }

    await carregarDados()
    limparCampos()
    setAnexos([])
  }

  function editarLancamento(item) {
    setCliente(item.cliente)
    setData(item.data)
    setCompetencia(item.competencia)
    setTipo(item.tipo)
    setPlanoConta(item.planoConta)
    setDescricao(item.descricao)
    setValor(item.valor)
    setFormaPagamento(item.formaPagamento || "")
    setObservacao(item.observacao || "")
    setEditandoId(item.id)
    setAnexos(item.anexos || [])
  }

  async function excluirLancamento(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este lançamento?"
    )

    if (!confirmar) {
      return
    }

    await api.delete(`/lancamentos-contabeis/${id}`)
    await carregarDados()
  }

  function limparCampos() {
    setCliente("")
    setData("")
    setCompetencia("")
    setTipo("")
    setPlanoConta("")
    setDescricao("")
    setValor("")
    setFormaPagamento("")
    setObservacao("")
    setEditandoId(null)
  }

  return (
    <div style={box}>
      <h2>Lançamentos Contábeis</h2>

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

        <input
          type="date"
          style={input}
          value={data}
          onChange={(e) => setData(e.target.value)}
        />

        <input
          style={input}
          placeholder="Competência 00/0000"
          value={competencia}
          onChange={(e) =>
            setCompetencia(formatarCompetencia(e.target.value))
          }
        />

        <select
          style={input}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Tipo</option>
          <option value="Receita">Receita</option>
          <option value="Despesa">Despesa</option>
        </select>

        <select
          style={input}
          value={planoConta}
          onChange={(e) => setPlanoConta(e.target.value)}
        >
          <option value="">Plano de Contas</option>

          {contas.map((item) => (
            <option key={item.id} value={`${item.codigo} - ${item.conta}`}>
              {item.codigo} - {item.conta}
            </option>
          ))}
        </select>

        <input
          style={input}
          placeholder="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        <input
          style={input}
          placeholder="R$ 0,00"
          value={valor}
          onChange={(e) => setValor(formatarValor(e.target.value))}
        />

        <select
          style={input}
          value={formaPagamento}
          onChange={(e) => setFormaPagamento(e.target.value)}
        >
          <option value="">Forma de Pagamento</option>
          <option value="Pix">Pix</option>
          <option value="Dinheiro">Dinheiro</option>
          <option value="Cartão">Cartão</option>
          <option value="Boleto">Boleto</option>
          <option value="Transferência">Transferência</option>
        </select>

        <textarea
          style={textarea}
          placeholder="Observação"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        
        <div style={anexosBox}>
          <label style={anexoButton}>
            Anexar NF / Documento

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

        <button style={button} onClick={salvarLancamento}>
          {editandoId ? "Salvar Correção" : "Salvar Lançamento"}
        </button>
      </div>

      <div style={tableWrapper}>
        <table style={table}>
        <thead>
          <tr>
            <th style={th}>Cliente</th>
            <th style={th}>Data</th>
            <th style={th}>Competência</th>
            <th style={th}>Tipo</th>
            <th style={th}>Plano</th>
            <th style={th}>Descrição</th>
            <th style={th}>Valor</th>
            <th style={th}>Anexos</th>
            <th style={th}>Ações</th>
          </tr>
        </thead>

        <tbody>
          {lancamentos.map((item) => (
            <tr key={item.id}>
              <td style={td}>{item.cliente}</td>
              <td style={td}>{item.data}</td>
              <td style={td}>{item.competencia}</td>
              <td style={td}>{item.tipo}</td>
              <td style={td}>{item.planoConta}</td>
              <td style={td}>{item.descricao}</td>
              <td style={td}>{item.valor}</td>
              
              <td style={td}>
                {item.anexos &&
                  item.anexos.length > 0 && (
                    <div style={listaArquivosTabela}>
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
                  )}
               </td>

              <td style={td}>
                <div style={actions}>
                  <button
                    style={editButton}
                    onClick={() => editarLancamento(item)}
                  >
                    Corrigir
                  </button>

                  <button
                    style={deleteButton}
                    onClick={() => excluirLancamento(item.id)}
                  >
                    Excluir
                  </button>
                </div>
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
  padding: "16px",
}

const actions = {
  display: "flex",
  gap: "10px",
}

const editButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#00a8ff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
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
const anexosBox = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  gridColumn: "1 / -1",
}

const anexoButton = {
  background: "#00a8ff",
  color: "white",
  padding: "14px",
  borderRadius: "12px",
  textAlign: "center",
  cursor: "pointer",
  fontWeight: "bold",
}

const listaArquivos = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
}

const arquivoItem = {
  background: "rgba(255,255,255,.05)",
  padding: "12px",
  borderRadius: "10px",
}
const listaArquivosTabela = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
}

const linkArquivo = {
  color: "#37ff74",
  textDecoration: "none",
  fontWeight: "bold",
}
const tableWrapper = {
  width: "100%",
  overflowX: "auto",
}