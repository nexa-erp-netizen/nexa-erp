import { useEffect, useMemo, useState } from "react"
import api from "../services/api"
import ClienteAcessoResumo from "../components/ClienteAcessoResumo"

function gerarCodigo(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function Usuarios({ usuarioLogado }) {
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState([])

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [perfil, setPerfil] = useState("Cliente")
  const [clienteVinculado, setClienteVinculado] = useState("")
  const [escritorioNome, setEscritorioNome] = useState("")
  const [codigoAcesso, setCodigoAcesso] = useState("")
  const [acessoCriado, setAcessoCriado] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false)

  useEffect(() => {
    carregarUsuarios()
    carregarClientes()
  }, [mostrarExcluidos])

  const clienteSelecionado = useMemo(() => {
    return clientes.find(
      (cliente) => cliente.nome === clienteVinculado
    )
  }, [clientes, clienteVinculado])

  async function carregarUsuarios() {
    try {
      const resposta = await api.get("/usuarios", { params: { arquivados: mostrarExcluidos } })
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

    if (perfil === "Empresa" && !editandoId) {
      if (!usuarioLogado?.plataformaAdmin) {
        alert("Somente a administração da plataforma pode criar um escritório para outra empresa")
        return
      }

      if (!escritorioNome || !codigoAcesso) {
        alert("Preencha o nome do escritório e o código de acesso")
        return
      }

      try {
        const resposta = await api.post("/escritorios", {
          nome: escritorioNome,
          codigo: codigoAcesso,
          adminNome: nome,
          adminEmail: email,
          adminSenha: senha,
          adminPerfil: "Empresa",
          plano: "Profissional",
        })
        setAcessoCriado({
          escritorio: resposta.data?.escritorio?.nome || escritorioNome,
          codigo: resposta.data?.escritorio?.codigo || codigoAcesso,
          email,
        })
        limparCampos({ preservarAcesso: true })
        return
      } catch (error) {
        alert(error.response?.data?.message || "Erro ao criar o escritório da empresa")
        console.error(error)
        return
      }
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

  async function alterarAcessoUsuario(usuario) {
    const novoEstado = usuario.ativo === false
    const confirmar = window.confirm(
      novoEstado
        ? `Deseja desbloquear o acesso de ${usuario.nome}?`
        : `Deseja bloquear o acesso de ${usuario.nome}? O cadastro e o histórico serão preservados.`
    )

    if (!confirmar) return

    try {
      await api.patch(`/usuarios/${usuario.id}/acesso`, { ativo: novoEstado })
      await carregarUsuarios()
    } catch (error) {
      alert(error.response?.data?.message || "Erro ao alterar o acesso do usuário")
      console.error(error)
    }
  }

  async function excluirUsuario(usuario) {
    const confirmar = window.confirm(`Excluir ${usuario.nome} com segurança? O acesso será bloqueado, o usuário sairá da lista ativa e o histórico será preservado.`)
    if (!confirmar) return
    try {
      await api.delete(`/usuarios/${usuario.id}`)
      await carregarUsuarios()
      alert("Usuário excluído com segurança")
    } catch (error) {
      alert(error.response?.data?.message || "Erro ao excluir usuário")
    }
  }

  async function restaurarUsuario(usuario) {
    if (!window.confirm(`Restaurar o usuário ${usuario.nome}?`)) return
    try {
      const resposta = await api.patch(`/usuarios/${usuario.id}/restaurar`)
      await carregarUsuarios()
      alert(resposta.data?.message || "Usuário restaurado")
    } catch (error) {
      alert(error.response?.data?.message || "Erro ao restaurar usuário")
    }
  }

  function limparCampos(opcoes = {}) {
    setEditandoId(null)
    setNome("")
    setEmail("")
    setSenha("")
    setPerfil("Cliente")
    setClienteVinculado("")
    setEscritorioNome("")
    setCodigoAcesso("")
    if (!opcoes.preservarAcesso) setAcessoCriado(null)
  }

  async function copiarCodigo() {
    if (!acessoCriado?.codigo) return
    try {
      await navigator.clipboard.writeText(acessoCriado.codigo)
      alert("Código de acesso copiado")
    } catch {
      alert(`Código de acesso: ${acessoCriado.codigo}`)
    }
  }

  return (
    <div style={box}>
      <h2>Usuários</h2>

      <p style={subtitle}>
        Crie acessos para administradores, funcionários e clientes. Empresas externas recebem um escritório próprio e isolado.
      </p>

      <button style={archiveToggleButton} onClick={() => setMostrarExcluidos((valor) => !valor)}>
        {mostrarExcluidos ? "Voltar aos usuários ativos" : "Ver usuários excluídos"}
      </button>

      {acessoCriado && (
        <div style={acessoInfo}>
          <div>
            <strong>Escritório criado com ambiente vazio e isolado</strong>
            <span>{acessoCriado.escritorio} · {acessoCriado.email}</span>
          </div>
          <div style={codigoBox}>
            <span>Código de acesso</span>
            <b>{acessoCriado.codigo}</b>
            <button style={copyButton} onClick={copiarCodigo}>Copiar código</button>
          </div>
        </div>
      )}

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
          {usuarioLogado?.plataformaAdmin && <option value="Empresa">Empresa (novo escritório)</option>}
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

        {perfil === "Empresa" && !editandoId && (
          <>
            <input
              style={input}
              placeholder="Nome do escritório/empresa"
              value={escritorioNome}
              onChange={(e) => {
                const valor = e.target.value
                setEscritorioNome(valor)
                setCodigoAcesso(gerarCodigo(valor))
              }}
            />
            <input
              style={input}
              placeholder="Código de acesso"
              value={codigoAcesso}
              onChange={(e) => setCodigoAcesso(gerarCodigo(e.target.value))}
            />
          </>
        )}

        <button style={button} onClick={salvarUsuario}>
          {editandoId ? "Salvar Alteração" : perfil === "Empresa" ? "Criar Empresa e Escritório" : "Criar Usuário"}
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
                  {mostrarExcluidos ? (
                    <button style={unlockButton} onClick={() => restaurarUsuario(usuario)}>Restaurar</button>
                  ) : (
                    <>
                      <button style={editButton} onClick={() => editarUsuario(usuario)}>Corrigir</button>
                      <button style={usuario.ativo === false ? unlockButton : blockButton} onClick={() => alterarAcessoUsuario(usuario)}>
                        {usuario.ativo === false ? "Desbloquear" : "Bloquear"}
                      </button>
                      {!usuario.plataformaAdmin && Number(usuario.id) !== Number(usuarioLogado?.id) && (
                        <button style={deleteButton} onClick={() => excluirUsuario(usuario)}>Excluir</button>
                      )}
                    </>
                  )}
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

const acessoInfo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "18px",
  flexWrap: "wrap",
  background: "rgba(55,255,116,.10)",
  border: "1px solid rgba(55,255,116,.35)",
  borderRadius: "14px",
  padding: "16px",
  marginBottom: "22px",
  color: "#eafff0",
}

const codigoBox = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
}

const copyButton = {
  padding: "9px 12px",
  borderRadius: "9px",
  border: "1px solid rgba(55,255,116,.5)",
  background: "#06335a",
  color: "white",
  cursor: "pointer",
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

const blockButton = {
  ...deleteButton,
  background: "#f59e0b",
  color: "#291800",
}

const unlockButton = {
  ...deleteButton,
  background: "#22c55e",
  color: "#052e16",
}


const archiveToggleButton = {
  padding: "10px 14px",
  marginBottom: "18px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,.2)",
  background: "#0b3265",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
}
