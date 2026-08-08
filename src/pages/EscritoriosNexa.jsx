import { useEffect, useState } from "react"
import api from "../services/api"

const vazio = { nome: "", codigo: "", cnpj: "", email: "", telefone: "", plano: "Profissional", adminNome: "", adminEmail: "", adminSenha: "" }

export default function EscritoriosNexa() {
  const [escritorios, setEscritorios] = useState([])
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const resposta = await api.get("/escritorios")
    setEscritorios(resposta.data || [])
  }

  useEffect(() => { carregar().catch(() => alert("Erro ao carregar escritórios")) }, [])

  function alterar(campo, valor) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }))
  }

  async function criar() {
    if (!form.nome || !form.codigo || !form.adminNome || !form.adminEmail || !form.adminSenha) {
      alert("Preencha escritório, código e administrador")
      return
    }
    setSalvando(true)
    try {
      await api.post("/escritorios", form)
      setForm(vazio)
      await carregar()
      alert("Escritório criado com ambiente vazio e isolado")
    } catch (error) {
      alert(error.response?.data?.message || "Erro ao criar escritório")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={styles.box}>
      <h2>Escritórios Nexa</h2>
      <p style={styles.subtitulo}>Cada escritório possui clientes, documentos, fiscal, financeiro e usuários totalmente separados.</p>

      <div style={styles.form}>
        <input style={styles.input} placeholder="Nome do escritório" value={form.nome} onChange={(e) => alterar("nome", e.target.value)} />
        <input style={styles.input} placeholder="Código de acesso (ex.: contabil-silva)" value={form.codigo} onChange={(e) => alterar("codigo", e.target.value.toLowerCase())} />
        <input style={styles.input} placeholder="CNPJ" value={form.cnpj} onChange={(e) => alterar("cnpj", e.target.value)} />
        <input style={styles.input} placeholder="E-mail do escritório" value={form.email} onChange={(e) => alterar("email", e.target.value)} />
        <input style={styles.input} placeholder="Telefone" value={form.telefone} onChange={(e) => alterar("telefone", e.target.value)} />
        <select style={styles.input} value={form.plano} onChange={(e) => alterar("plano", e.target.value)}>
          <option>Profissional</option><option>Essencial</option><option>Premium</option>
        </select>
        <input style={styles.input} placeholder="Nome do administrador" value={form.adminNome} onChange={(e) => alterar("adminNome", e.target.value)} />
        <input style={styles.input} placeholder="E-mail do administrador" value={form.adminEmail} onChange={(e) => alterar("adminEmail", e.target.value)} />
        <input style={styles.input} type="password" placeholder="Senha inicial" value={form.adminSenha} onChange={(e) => alterar("adminSenha", e.target.value)} />
        <button style={styles.botao} disabled={salvando} onClick={criar}>{salvando ? "Criando..." : "Criar escritório"}</button>
      </div>

      <div style={styles.lista}>
        {escritorios.map((item) => (
          <div key={item.id} style={styles.card}>
            <div><strong>{item.nome}</strong><span style={styles.codigo}>Código: {item.codigo}</span></div>
            <div style={styles.direita}><span>{item.plano}</span><b style={styles.status}>{item.status}</b></div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  box: { background: "#06234d", padding: 24, borderRadius: 18 },
  subtitulo: { color: "#a9b8cc", marginBottom: 22 },
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 },
  input: { padding: 12, borderRadius: 10, border: "1px solid #315784", background: "#001a3d", color: "white" },
  botao: { padding: 12, border: 0, borderRadius: 10, background: "#37ff74", color: "#00142f", fontWeight: 800, cursor: "pointer" },
  lista: { display: "grid", gap: 10, marginTop: 24 },
  card: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderRadius: 12, background: "#001a3d" },
  codigo: { display: "block", color: "#a9b8cc", marginTop: 5 },
  direita: { display: "flex", alignItems: "center", gap: 12 },
  status: { color: "#37ff74" },
}
