import { useEffect, useState } from "react"
import api from "../services/api"

export default function Financeiro() {
  const [descricao, setDescricao] = useState("")
  const [cliente, setCliente] = useState("")
  const [tipo, setTipo] = useState("")
  const [centroCusto, setCentroCusto] = useState("")
  const [formaPagamento, setFormaPagamento] = useState("")
  const [valor, setValor] = useState("")
  const [vencimento, setVencimento] = useState("")
  const [status, setStatus] = useState("")
  const [dataRecebimento, setDataRecebimento] = useState("")
  const [anexos, setAnexos] = useState([])
  const [editandoId, setEditandoId] = useState(null)
  const [recorrenteMensal, setRecorrenteMensal] = useState(false)
  const [diaVencimento, setDiaVencimento] = useState(10)
  const [quantidadeMeses, setQuantidadeMeses] = useState(12)
  const [lancamentos, setLancamentos] = useState([])
  const [clientesCadastrados, setClientesCadastrados] = useState([])
  const [servicos, setServicos] = useState([])

  const formasPagamento = [
    "PIX",
    "Boleto",
    "Cartão",
    "Dinheiro",
    "Transferência",
  ]

  useEffect(() => {
    carregarLancamentos()
    carregarClientes()
    carregarServicos()
  }, [])

  async function carregarLancamentos() {
    try {
      const resposta = await api.get("/financeiro")
      setLancamentos(resposta.data)
    } catch (error) {
      alert("Erro ao carregar financeiro")
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

  async function carregarServicos() {
    try {
      const resposta = await api.get("/servicos")
      setServicos(resposta.data)
    } catch (error) {
      alert("Erro ao carregar serviços")
      console.error(error)
    }
  }

  function valorNumerico(valorFormatado) {
    return Number(
      String(valorFormatado || 0)
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    )
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function statusAutomatico(item) {
    if (item.status === "Pago" || item.status === "Recebido") {
      return item.status
    }

    if (item.vencimento && new Date(item.vencimento) < new Date()) {
      return "Atrasado"
    }

    return item.status || "Pendente"
  }

  function selecionarServico(nomeServico) {
    const servicoSelecionado = servicos.find(
      (servico) => servico.nome === nomeServico
    )

    setDescricao(nomeServico)

    if (servicoSelecionado) {
      setValor(servicoSelecionado.valor || "")
      setCentroCusto(servicoSelecionado.categoria || "")
    }
  }

  async function uploadArquivos(files) {
    try {
      const formData = new FormData()

      for (let file of files) {
        formData.append("arquivos", file)
      }

      const resposta = await api.post("/financeiro/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      setAnexos(resposta.data)
    } catch (error) {
      alert("Erro ao enviar anexos")
      console.error(error)
    }
  }

  async function salvarLancamento() {
    if (
      !descricao ||
      !cliente ||
      !tipo ||
      !centroCusto ||
      !formaPagamento ||
      !valor ||
      !vencimento ||
      !status
    ) {
      alert("Preencha todos os campos")
      return
    }

    const novoLancamento = {
     descricao,
     cliente,
     tipo,
     centroCusto,
     formaPagamento,
     valor,
     vencimento,
     status,
     dataRecebimento,
     anexos,

     recorrenteMensal,
     diaVencimento,
     quantidadeMeses,
   }

    try {
      if (editandoId !== null) {
        await api.put(`/financeiro/${editandoId}`, novoLancamento)
      } else {
        await api.post("/financeiro", novoLancamento)
      }

      await carregarLancamentos()
      limparCampos()
    } catch (error) {
      alert("Erro ao salvar lançamento financeiro")
      console.error(error)
    }
  }

  function editarLancamento(item) {
    setDescricao(item.descricao)
    setCliente(item.cliente)
    setTipo(item.tipo)
    setCentroCusto(item.centroCusto || "")
    setFormaPagamento(item.formaPagamento || "")
    setValor(item.valor)
    setVencimento(item.vencimento)
    setStatus(item.status)
    setDataRecebimento(item.dataRecebimento || "")
    setAnexos(item.anexos || [])
    setEditandoId(item.id)
  }

  async function marcarComoRecebido(item) {
    try {
      await api.put(`/financeiro/${item.id}`, {
        ...item,
        status: item.tipo === "Pagar" ? "Pago" : "Recebido",
        dataRecebimento: new Date().toISOString().slice(0, 10),
      })

      await carregarLancamentos()
    } catch (error) {
      alert("Erro ao marcar como recebido")
      console.error(error)
    }
  }

  async function excluirLancamento(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este lançamento?"
    )

    if (!confirmar) return

    try {
      await api.delete(`/financeiro/${id}`)
      await carregarLancamentos()
    } catch (error) {
      alert("Erro ao excluir lançamento financeiro")
      console.error(error)
    }
  }

  function limparCampos() {
    setDescricao("")
    setCliente("")
    setTipo("")
    setCentroCusto("")
    setFormaPagamento("")
    setValor("")
    setVencimento("")
    setStatus("")
    setDataRecebimento("")
    setAnexos([])
    setEditandoId(null)
  }

  const lancamentosComStatus = lancamentos.map((item) => ({
    ...item,
    statusCalculado: statusAutomatico(item),
  }))

  const recebidos = lancamentosComStatus
    .filter(
      (item) =>
        item.tipo === "Receber" &&
        (item.statusCalculado === "Pago" ||
          item.statusCalculado === "Recebido")
    )
    .reduce((total, item) => total + valorNumerico(item.valor), 0)

  const aReceber = lancamentosComStatus
    .filter(
      (item) =>
        item.tipo === "Receber" &&
        item.statusCalculado !== "Pago" &&
        item.statusCalculado !== "Recebido"
    )
    .reduce((total, item) => total + valorNumerico(item.valor), 0)

  const aPagar = lancamentosComStatus
    .filter(
      (item) =>
        item.tipo === "Pagar" &&
        item.statusCalculado !== "Pago" &&
        item.statusCalculado !== "Recebido"
    )
    .reduce((total, item) => total + valorNumerico(item.valor), 0)

  const inadimplentes = lancamentosComStatus.filter(
    (item) => item.statusCalculado === "Atrasado"
  ).length

  const saldo = recebidos + aReceber - aPagar
  const totalMovimentado = recebidos + aReceber + aPagar

  const percentualRecebido =
    totalMovimentado > 0 ? (recebidos / totalMovimentado) * 100 : 0

  const percentualReceber =
    totalMovimentado > 0 ? (aReceber / totalMovimentado) * 100 : 0

  const percentualPagar =
    totalMovimentado > 0 ? (aPagar / totalMovimentado) * 100 : 0

  return (
    <div style={box}>
      <h2>Financeiro</h2>

      <div style={cards}>
        <Card title="A Receber" value={formatarMoeda(aReceber)} />
        <Card title="Recebido" value={formatarMoeda(recebidos)} />
        <Card title="A Pagar" value={formatarMoeda(aPagar)} />
        <Card title="Inadimplentes" value={inadimplentes} />
        <Card title="Saldo Previsto" value={formatarMoeda(saldo)} />
      </div>

      <div style={graficoBox}>
        <h3>Resumo Financeiro</h3>

        <Barra
          label="Recebido"
          valor={formatarMoeda(recebidos)}
          largura={percentualRecebido}
        />

        <Barra
          label="A Receber"
          valor={formatarMoeda(aReceber)}
          largura={percentualReceber}
        />

        <Barra
          label="A Pagar"
          valor={formatarMoeda(aPagar)}
          largura={percentualPagar}
        />
      </div>

      <div style={form}>
        <select
          style={input}
          value={descricao}
          onChange={(e) => selecionarServico(e.target.value)}
        >
          <option value="">Selecionar Serviço</option>

          {servicos.map((servico) => (
            <option key={servico.id} value={servico.nome}>
              {servico.nome}
            </option>
          ))}
        </select>

        <select
          style={input}
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
        >
          <option value="">Cliente / Fornecedor</option>

          {clientesCadastrados.map((item) => (
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
          <option value="">Tipo</option>
          <option value="Receber">Conta a Receber</option>
          <option value="Pagar">Conta a Pagar</option>
        </select>

        <input
          style={input}
          placeholder="Centro de Custo"
          value={centroCusto}
          readOnly
        />

        <select
          style={input}
          value={formaPagamento}
          onChange={(e) => setFormaPagamento(e.target.value)}
        >
          <option value="">Forma de Pagamento</option>

          {formasPagamento.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          style={input}
          placeholder="R$ 0,00"
          value={valor}
          readOnly
        />

        <input
          type="date"
          style={input}
          value={vencimento}
          onChange={(e) => setVencimento(e.target.value)}
        />

        <select
          style={input}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Status</option>
          <option value="Pendente">Pendente</option>
          <option value="Pago">Pago</option>
          <option value="Recebido">Recebido</option>
          <option value="Atrasado">Atrasado</option>
        </select>

        <label style={checkboxContainer}>
          <input
            type="checkbox"
            checked={recorrenteMensal}
            onChange={(e) =>
              setRecorrenteMensal(e.target.checked)
            }
          />
          Honorário Recorrente Mensal
        </label>

        {recorrenteMensal && (
          <>
            <div style={campoComLabel}>
              <span>Dia do vencimento mensal</span>

              <input
                style={input}
                type="number"
                min="1"
                max="31"
                value={diaVencimento}
                onChange={(e) =>
                  setDiaVencimento(e.target.value)
                }
             />
            </div>

            <div style={campoComLabel}>
              <span>Quantidade de meses</span>

              <input
                style={input}
                type="number"
                min="1"
                max="60"
                value={quantidadeMeses}
                onChange={(e) =>
                  setQuantidadeMeses(e.target.value)
               }
             />
            </div>
          </>
        )}

        <div style={campoComLabel}>
          <span>Data do recebimento</span>

          <input
            type="date"
            style={input}
            value={dataRecebimento}
            onChange={(e) =>
              setDataRecebimento(e.target.value)
            } 
          />
        </div>

        <input
          type="file"
          multiple
          style={input}
          onChange={(e) => uploadArquivos(e.target.files)}
        />

        {anexos.length > 0 && (
          <div style={anexosBox}>
            {anexos.map((item, index) => (
              <div key={index}>📎 {item.nome}</div>
            ))}
          </div>
        )}

        <button style={button} onClick={salvarLancamento}>
          {editandoId !== null ? "Salvar Correção" : "Salvar Lançamento"}
        </button>
      </div>

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Descrição</th>
            <th style={th}>Cliente</th>
            <th style={th}>Valor</th>
            <th style={th}>Status</th>
            <th style={th}>Ações</th>
          </tr>
        </thead>

        <tbody>
          {lancamentosComStatus.map((item) => (
            <tr key={item.id}>
              <td style={td}>{item.descricao}</td>
              <td style={td}>{item.cliente}</td>
              <td style={td}>{item.valor}</td>

              <td style={td}>
                <span style={badgeStatus(item.statusCalculado)}>
                  {item.statusCalculado}
                </span>
              </td>

              <td style={td}>
                <div style={actions}>
                  {item.statusCalculado !== "Recebido" &&
                    item.statusCalculado !== "Pago" && (
                      <button
                        style={receiveButton}
                        onClick={() => marcarComoRecebido(item)}
                      >
                        Receber
                      </button>
                    )}

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
  )
}

function Card({ title, value }) {
  return (
    <div style={card}>
      <span style={cardTitle}>{title}</span>
      <strong style={cardValue}>{value}</strong>
    </div>
  )
}

function Barra({ label, valor, largura }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={barraTopo}>
        <span>{label}</span>
        <strong>{valor}</strong>
      </div>

      <div style={barraFundo}>
        <div
          style={{
            ...barraPreenchida,
            width: largura + "%",
          }}
        />
      </div>
    </div>
  )
}

function badgeStatus(status) {
  const base = {
    padding: "7px 12px",
    borderRadius: "999px",
    fontWeight: "bold",
    fontSize: "13px",
    display: "inline-block",
  }

  if (status === "Recebido" || status === "Pago") {
    return {
      ...base,
      background: "rgba(55,255,116,.16)",
      color: "#37ff74",
    }
  }

  if (status === "Atrasado") {
    return {
      ...base,
      background: "rgba(255,77,79,.18)",
      color: "#ff7072",
    }
  }

  return {
    ...base,
    background: "rgba(0,168,255,.18)",
    color: "#00a8ff",
  }
}

const box = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "28px",
  overflowX: "auto",
}

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginBottom: "25px",
}

const card = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
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
  fontSize: "24px",
}

const graficoBox = {
  background: "#061f47",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "18px",
  padding: "22px",
  marginBottom: "28px",
}

const barraTopo = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "8px",
}

const barraFundo = {
  height: "14px",
  background: "rgba(255,255,255,.12)",
  borderRadius: "999px",
  overflow: "hidden",
}

const barraPreenchida = {
  height: "100%",
  background: "linear-gradient(90deg, #00a8ff, #37ff74)",
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

const anexosBox = {
  color: "#37ff74",
  fontWeight: "bold",
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
  minWidth: "1200px",
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
  flexWrap: "wrap",
}

const receiveButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#37ff74",
  color: "#00112b",
  fontWeight: "bold",
  cursor: "pointer",
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

const checkboxContainer = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "white",
  fontWeight: "bold",
}

const campoComLabel = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "#a9b8cc",
  fontSize: "13px",
  fontWeight: "bold",
}
