import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import ClienteAcessoResumo from "../components/ClienteAcessoResumo"

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState([])

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [perfil, setPerfil] = useState("Cliente")
  const [clienteVinculado, setClienteVinculado] = useState("")
  const [editandoId, setEditandoId] = useState(null)

  useEffect(() => {
    carregarUsuarios()
    carregarClientes()
  }, [])

  const clienteSelecionado = useMemo(() => {
    return clientes.find(
      (cliente) => cliente.nome === clienteVinculado
    )
  }, [clientes, clienteVinculado])

  async function carregarUsuarios() {
    try {
      const resposta = await api.get("/usuarios")
      setUsuarios(resposta.data || [])
    } catch (error) {
      alert("Erro ao carregar usuários")
      console.error(error)
    }
  }

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      setClientes(resposta.data || [])
    } catch (error) {
      alert("Erro ao carregar clientes")
      console.error(error)
    }
  }

  function obterEmailCliente(cliente) {
    return (
      cliente?.email ||
      cliente?.emailCliente ||
      cliente?.emailResponsavel ||
      cliente?.responsavelEmail ||
      ""
    )
  }

  function selecionarClienteVinculado(valor) {
    setClienteVinculado(valor)

    const cliente = clientes.find(
      (item) => item.nome === valor
    )

    if (!cliente || editandoId) return

    setNome(cliente.nome || "")

    const emailCliente = obterEmailCliente(cliente)

    if (emailCliente) {
      setEmail(emailCliente)
    }
  }

  async function salvarUsuario() {
    if (!nome || !email || (!editandoId && !senha) || !perfil) {
      alert("Preencha nome, e-mail, senha e perfil")
      return
    }

    if (perfil === "Cliente" && !clienteVinculado) {
      alert("Selecione o cliente vinculado")
      return
    }

    const dados = {
      nome,
      email,
      senha,
      perfil,
      clienteVinculado:
        perfil === "Cliente" ? clienteVinculado : null,
    }

    try {
      if (editandoId) {
        await api.put(`/usuarios/${editandoId}`, dados)
      } else {
        await api.post("/usuarios", dados)
      }

      limparCampos()
      await carregarUsuarios()
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Erro ao salvar usuário"
      )
      console.error(error)
    }
  }

  function editarUsuario(usuario) {
    setEditandoId(usuario.id)
    setNome(usuario.nome)
    setEmail(usuario.email)
    setSenha("")
    setPerfil(usuario.perfil)
    setClienteVinculado(usuario.clienteVinculado || "")
  }

  async function excluirUsuario(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este usuário?"
    )

    if (!confirmar) return

    try {
      await api.delete(`/usuarios/${id}`)
      await carregarUsuarios()
    } catch (error) {
      alert("Erro ao excluir usuário")
      console.error(error)
    }
  }

  function limparCampos() {
    setEditandoId(null)
    setNome("")
    setEmail("")
    setSenha("")
    setPerfil("Cliente")
    setClienteVinculado("")
  }

  return (
    <div style={box}>
      <h2>Usuários</h2>

      <p style={subtitle}>
        Crie acessos para administradores, funcionários e clientes.
      </p>

      <div style={form}>
        <input
          style={input}
          placeholder="Nome do usuário"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <input
          style={input}
          placeholder="E-mail de acesso"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          style={input}
          type="password"
          placeholder={
            editandoId
              ? "Nova senha opcional"
              : "Senha"
          }
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <select
          style={input}
          value={perfil}
          onChange={(e) => {
            setPerfil(e.target.value)

            if (e.target.value !== "Cliente") {
              setClienteVinculado("")
            }
          }}
        >
          <option value="Administrador">Administrador</option>
          <option value="Funcionário">Funcionário</option>
          <option value="Cliente">Cliente</option>
        </select>

        {perfil === "Cliente" && (
          <select
            style={input}
            value={clienteVinculado}
            onChange={(e) =>
              selecionarClienteVinculado(e.target.value)
            }
          >
            <option value="">Cliente vinculado</option>

            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.nome}>
                {cliente.nome}
              </option>
            ))}
          </select>
        )}

        <button style={button} onClick={salvarUsuario}>
          {editandoId ? "Salvar Alteração" : "Criar Usuário"}
        </button>

        {editandoId && (
          <button style={cancelButton} onClick={limparCampos}>
            Cancelar Edição
          </button>
        )}
      </div>

      {perfil === "Cliente" && clienteSelecionado && (
        <div style={clienteInfo}>
          <strong>Cliente selecionado:</strong>{" "}
          {clienteSelecionado.nome}
          <br />
          <span>
            E-mail cadastrado:{" "}
            {obterEmailCliente(clienteSelecionado) || "não informado"}
          </span>
        </div>
      )}

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Nome</th>
            <th style={th}>E-mail</th>
            <th style={th}>Perfil</th>
            <th style={th}>Cliente Vinculado</th>
            <th style={th}>Acesso ao Portal</th>
            <th style={th}>Ações</th>
          </tr>
        </thead>

        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id}>
              <td style={td}>{usuario.nome}</td>
              <td style={td}>{usuario.email}</td>
              <td style={td}>{usuario.perfil}</td>
              <td style={td}>
                {usuario.clienteVinculado || "-"}
              </td>
              <td style={td}>
                {usuario.perfil === "Cliente" ? (
                  <ClienteAcessoResumo compacto clienteId={clientes.find((cliente) => cliente.nome === usuario.clienteVinculado)?.id} />
                ) : "-"}
              </td>
              <td style={td}>
                <div style={actions}>
                  <button
                    style={editButton}
                    onClick={() => editarUsuario(usuario)}
                  >
                    Corrigir
                  </button>

                  <button
                    style={deleteButton}
                    onClick={() => excluirUsuario(usuario.id)}
                  >
                    Bloquear
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {usuarios.length === 0 && (
            <tr>
              <td style={td} colSpan="6">
                Nenhum usuário cadastrado.
              </td>
            </tr>
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

const subtitle = {
  color: "#a9b8cc",
  marginBottom: "24px",
}

const form = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "15px",
  marginBottom: "20px",
}

const input = {
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.15)",
  background: "#061f47",
  color: "white",
  fontSize: "15px",
}

const clienteInfo = {
  background: "rgba(0,168,255,.12)",
  border: "1px solid rgba(0,168,255,.28)",
  borderRadius: "14px",
  padding: "14px",
  marginBottom: "24px",
  color: "#d9e7ff",
  lineHeight: "24px",
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

const cancelButton = {
  padding: "15px",
  borderRadius: "12px",
  border: "none",
  background: "#64748b",
  color: "white",
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
