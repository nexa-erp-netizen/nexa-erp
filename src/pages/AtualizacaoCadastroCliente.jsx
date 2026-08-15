import { useEffect, useState } from "react"
import { FaHome, FaSave, FaUserEdit } from "react-icons/fa"
import api from "../services/api"

const CAMPOS_INICIAIS = {
  nome: "",
  cpf: "",
  cnpj: "",
  telefone: "",
  email: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
}

export default function AtualizacaoCadastroCliente({ setPage }) {
  const [form, setForm] = useState(CAMPOS_INICIAIS)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")

  useEffect(() => {
    carregarCadastro()
  }, [])

  async function carregarCadastro() {
    try {
      setCarregando(true)
      setErro("")
      const resposta = await api.get("/clientes/meu-cadastro")
      setForm({ ...CAMPOS_INICIAIS, ...(resposta.data || {}) })
    } catch (error) {
      setErro(error.response?.data?.message || "Não foi possível carregar seu cadastro.")
    } finally {
      setCarregando(false)
    }
  }

  function atualizar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setMensagem("")
    setErro("")
  }

  function formatarCep(valor) {
    const numeros = String(valor || "").replace(/\D/g, "").slice(0, 8)
    return numeros.replace(/^(\d{5})(\d)/, "$1-$2")
  }

  async function salvar(evento) {
    evento.preventDefault()

    try {
      setSalvando(true)
      setErro("")
      setMensagem("")
      const resposta = await api.put("/clientes/meu-cadastro", form)
      setForm({ ...CAMPOS_INICIAIS, ...(resposta.data || {}) })
      setMensagem("Dados cadastrais atualizados com sucesso.")
    } catch (error) {
      setErro(error.response?.data?.message || "Não foi possível atualizar o cadastro.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="ac-page">
      <style>{`
        .ac-page { padding: 30px; color: white; box-sizing: border-box; }
        .ac-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
        .ac-title { display: flex; align-items: center; gap: 13px; font-size: 30px; font-weight: 900; }
        .ac-title svg { color: #32f06d; }
        .ac-subtitle { color: #b9cce4; margin-top: 7px; }
        .ac-home { border: 1px solid rgba(255,255,255,.15); border-radius: 12px; background: #061f47; color: white; width: 46px; height: 42px; cursor: pointer; font-size: 18px; }
        .ac-card { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.09); border-radius: 22px; padding: 24px; }
        .ac-note { background: rgba(60,188,255,.10); border: 1px solid rgba(60,188,255,.28); border-radius: 13px; padding: 13px 15px; color: #b9eaff; margin-bottom: 22px; line-height: 1.45; }
        .ac-section { font-size: 18px; font-weight: 900; margin: 8px 0 14px; }
        .ac-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 15px; margin-bottom: 22px; }
        .ac-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
        .ac-field-2 { grid-column: span 2; }
        .ac-field label { color: #9edfff; font-size: 13px; font-weight: 800; }
        .ac-input { width: 100%; height: 44px; box-sizing: border-box; background: #082754; border: 1px solid rgba(255,255,255,.13); border-radius: 10px; color: white; padding: 0 12px; outline: none; }
        .ac-input:focus { border-color: #32f06d; box-shadow: 0 0 0 3px rgba(50,240,109,.09); }
        .ac-input:disabled { opacity: .62; cursor: not-allowed; }
        .ac-actions { display: flex; justify-content: flex-end; }
        .ac-save { border: 0; border-radius: 12px; padding: 14px 22px; background: linear-gradient(90deg,#17b8ff,#32f06d); color: #00112b; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; }
        .ac-save:disabled { opacity: .6; cursor: wait; }
        .ac-message, .ac-error { border-radius: 12px; padding: 13px 15px; margin-bottom: 18px; font-weight: 700; }
        .ac-message { background: rgba(50,240,109,.13); border: 1px solid rgba(50,240,109,.35); color: #8bffae; }
        .ac-error { background: rgba(255,92,112,.13); border: 1px solid rgba(255,92,112,.35); color: #ff9daa; }
        @media (max-width: 900px) { .ac-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .ac-page { padding: 16px; } .ac-header { align-items: flex-start; } .ac-title { font-size: 24px; } .ac-card { padding: 17px; } .ac-grid { grid-template-columns: 1fr; } .ac-field-2 { grid-column: span 1; } .ac-save { width: 100%; justify-content: center; } }
      `}</style>

      <div className="ac-header">
        <div>
          <div className="ac-title"><FaUserEdit /> Atualização cadastral</div>
          <div className="ac-subtitle">Mantenha seus dados de contato e endereço sempre atualizados.</div>
        </div>
        <button className="ac-home" type="button" title="Voltar ao Portal Cliente" onClick={() => setPage("Portal Cliente")}><FaHome /></button>
      </div>

      <form className="ac-card" onSubmit={salvar}>
        <div className="ac-note">Por segurança, razão social, CPF/CNPJ e dados fiscais são somente para consulta. Para corrigi-los, solicite a alteração ao escritório.</div>
        {mensagem && <div className="ac-message">{mensagem}</div>}
        {erro && <div className="ac-error">{erro}</div>}

        {carregando ? <div>Carregando cadastro...</div> : <>
          <div className="ac-section">Identificação</div>
          <div className="ac-grid">
            <Campo classe="ac-field-2" label="Nome / Razão social" value={form.nome} disabled />
            <Campo label="CPF" value={form.cpf} disabled />
            <Campo label="CNPJ" value={form.cnpj} disabled />
          </div>

          <div className="ac-section">Contato</div>
          <div className="ac-grid">
            <Campo classe="ac-field-2" label="Telefone *" value={form.telefone} onChange={(v) => atualizar("telefone", v)} required />
            <Campo classe="ac-field-2" label="E-mail" type="email" value={form.email} onChange={(v) => atualizar("email", v)} />
          </div>

          <div className="ac-section">Endereço</div>
          <div className="ac-grid">
            <Campo label="CEP" value={form.cep} onChange={(v) => atualizar("cep", formatarCep(v))} inputMode="numeric" />
            <Campo classe="ac-field-2" label="Endereço" value={form.endereco} onChange={(v) => atualizar("endereco", v)} />
            <Campo label="Número" value={form.numero} onChange={(v) => atualizar("numero", v)} />
            <Campo label="Complemento" value={form.complemento} onChange={(v) => atualizar("complemento", v)} />
            <Campo label="Bairro" value={form.bairro} onChange={(v) => atualizar("bairro", v)} />
            <Campo label="Cidade" value={form.cidade} onChange={(v) => atualizar("cidade", v)} />
            <Campo label="UF" value={form.estado} maxLength={2} onChange={(v) => atualizar("estado", v.toUpperCase())} />
          </div>

          <div className="ac-actions"><button className="ac-save" type="submit" disabled={salvando}><FaSave /> {salvando ? "Salvando..." : "Salvar atualização"}</button></div>
        </>}
      </form>
    </div>
  )
}

function Campo({ label, value, onChange, classe = "", type = "text", ...props }) {
  return <div className={`ac-field ${classe}`}><label>{label}</label><input className="ac-input" type={type} value={value || ""} onChange={onChange ? (e) => onChange(e.target.value) : undefined} {...props} /></div>
}
