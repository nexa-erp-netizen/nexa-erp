import { useEffect, useMemo, useState } from "react"
import api from "../services/api"

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]
const DOCUMENTOS_ADMISSAO = ["CPF", "RG", "Comprovante de endereço", "CTPS Digital", "PIS/PASEP/NIT", "ASO admissional", "Título de eleitor", "Certificado de reservista", "Certidão dos dependentes", "Comprovante de escolaridade", "Dados bancários"]

const FORM_INICIAL = {
  clienteId: "", cliente: "", matricula: "", nome: "", nomeSocial: "", cpf: "", rg: "", orgaoEmissorRg: "", dataEmissaoRg: "", dataNascimento: "", sexo: "", estadoCivil: "", nacionalidade: "Brasileira", naturalidade: "", nomeMae: "", nomePai: "", escolaridade: "", email: "", telefone: "",
  cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "PR",
  ctpsNumero: "", ctpsSerie: "", ctpsUf: "PR", ctpsDigital: true, pisPasepNit: "", tituloEleitor: "", zonaEleitoral: "", secaoEleitoral: "", certificadoReservista: "", cnh: "", cnhCategoria: "", cnhValidade: "",
  dataAdmissao: "", tipoContrato: "Prazo indeterminado", dataFimContrato: "", dataFimExperiencia: "", cargo: "", cbo: "", departamento: "", localTrabalho: "", salarioBase: "", tipoSalario: "Mensal", jornadaSemanal: "44", horarioTrabalho: "", intervalo: "", sindicato: "", categoriaTrabalhador: "101 - Empregado geral", eSocialMatricula: "", regimePrevidenciario: "RGPS", optanteFgts: true, dataOpcaoFgts: "",
  banco: "", agencia: "", conta: "", tipoConta: "Conta corrente", chavePix: "", formaPagamento: "Transferência bancária",
  valeTransporte: false, valorValeTransporte: "", valeAlimentacao: false, valorValeAlimentacao: "", planoSaude: false, insalubridadePercentual: "", periculosidade: false,
  dependentes: [], beneficios: [], exameAdmissionalData: "", exameAdmissionalValidade: "", documentos: [], dataDesligamento: "", motivoDesligamento: "", status: "Ativo", observacoes: "",
}

function somenteDigitos(valor, limite = 30) { return String(valor || "").replace(/\D/g, "").slice(0, limite) }
function mascaraCpf(valor) { return somenteDigitos(valor, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2") }
function mascaraCep(valor) { return somenteDigitos(valor, 8).replace(/(\d{2})(\d{3})(\d{1,3})$/, "$1.$2-$3") }
function moeda(valor) { return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
function dataBr(valor) { if (!valor) return "-"; const [a,m,d] = String(valor).slice(0,10).split("-"); return a && m && d ? `${d}/${m}/${a}` : valor }

export default function Funcionarios({ setPage }) {
  const [clientes, setClientes] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [clienteId, setClienteId] = useState(localStorage.getItem("nexaFuncionariosClienteId") || "")
  const [form, setForm] = useState({ ...FORM_INICIAL, clienteId: localStorage.getItem("nexaFuncionariosClienteId") || "" })
  const [editandoId, setEditandoId] = useState(null)
  const [busca, setBusca] = useState("")
  const [abrirFormulario, setAbrirFormulario] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregarClientes() }, [])
  useEffect(() => { if (clienteId) carregarFuncionarios(clienteId); else setFuncionarios([]) }, [clienteId])

  async function carregarClientes() {
    try {
      const resposta = await api.get("/clientes")
      const lista = Array.isArray(resposta.data) ? resposta.data : []
      setClientes(lista)
      const salvo = localStorage.getItem("nexaFuncionariosClienteId")
      if (salvo && lista.some((item) => String(item.id) === String(salvo))) selecionarEmpresa(salvo, lista)
    } catch (error) { alert(error?.response?.data?.message || "Erro ao carregar empresas") }
  }

  async function carregarFuncionarios(id = clienteId) {
    try {
      const resposta = await api.get("/funcionarios", { params: { clienteId: id } })
      setFuncionarios((Array.isArray(resposta.data) ? resposta.data : []).filter((item) => item.status !== "Excluído"))
    } catch (error) { alert(error?.response?.data?.message || "Erro ao carregar funcionários") }
  }

  function selecionarEmpresa(id, lista = clientes) {
    const cliente = lista.find((item) => String(item.id) === String(id))
    setClienteId(String(id || ""))
    if (id) localStorage.setItem("nexaFuncionariosClienteId", String(id))
    else localStorage.removeItem("nexaFuncionariosClienteId")
    setForm((atual) => ({ ...atual, clienteId: String(id || ""), cliente: cliente?.nome || "" }))
  }

  function alterar(campo, valor) { setForm((atual) => ({ ...atual, [campo]: valor })) }
  function novo() {
    const cliente = clientes.find((item) => String(item.id) === String(clienteId))
    setForm({ ...FORM_INICIAL, clienteId, cliente: cliente?.nome || "" })
    setEditandoId(null)
    setAbrirFormulario(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function editar(item) {
    const preenchido = { ...FORM_INICIAL }
    Object.keys(preenchido).forEach((campo) => {
      if (item[campo] !== null && item[campo] !== undefined) preenchido[campo] = item[campo]
    })
    preenchido.clienteId = String(item.clienteId)
    preenchido.dependentes = Array.isArray(item.dependentes) ? item.dependentes : []
    preenchido.beneficios = Array.isArray(item.beneficios) ? item.beneficios : []
    preenchido.documentos = Array.isArray(item.documentos) ? item.documentos : []
    setForm(preenchido)
    setEditandoId(item.id)
    setAbrirFormulario(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function salvar() {
    if (!form.clienteId || !form.nome || somenteDigitos(form.cpf).length !== 11 || !form.dataNascimento || !form.dataAdmissao || !form.cargo || form.salarioBase === "") {
      alert("Preencha empresa, nome, CPF, nascimento, admissão, cargo e salário-base.")
      return
    }
    setSalvando(true)
    try {
      const payload = { ...form, cpf: somenteDigitos(form.cpf), cep: somenteDigitos(form.cep) }
      if (editandoId) await api.put(`/funcionarios/${editandoId}`, payload)
      else await api.post("/funcionarios", payload)
      await carregarFuncionarios(form.clienteId)
      setAbrirFormulario(false)
      setEditandoId(null)
    } catch (error) { alert(error?.response?.data?.message || "Erro ao salvar funcionário") }
    finally { setSalvando(false) }
  }

  async function excluir(item) {
    if (!confirm(`Remover ${item.nome} do cadastro?`)) return
    try { await api.delete(`/funcionarios/${item.id}`); await carregarFuncionarios() }
    catch (error) { alert(error?.response?.data?.message || "Erro ao remover funcionário") }
  }
  function abrirRescisao(item){localStorage.setItem("nexaRescisaoClienteId",String(item.clienteId));localStorage.setItem("nexaRescisaoFuncionarioId",String(item.id));if(typeof setPage==="function")setPage("Calculadora de Rescisão")}

  function adicionarDependente() {
    alterar("dependentes", [...form.dependentes, { nome: "", cpf: "", dataNascimento: "", parentesco: "Filho(a)", irrf: true, salarioFamilia: false }])
  }
  function alterarDependente(indice, campo, valor) {
    alterar("dependentes", form.dependentes.map((item, i) => i === indice ? { ...item, [campo]: valor } : item))
  }
  function removerDependente(indice) { alterar("dependentes", form.dependentes.filter((_, i) => i !== indice)) }
  function alternarDocumento(nome) {
    alterar("documentos", form.documentos.includes(nome) ? form.documentos.filter((item) => item !== nome) : [...form.documentos, nome])
  }

  async function buscarCep() {
    const cep = somenteDigitos(form.cep, 8)
    if (cep.length !== 8) return
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const dados = await resposta.json()
      if (dados.erro) return alert("CEP não encontrado")
      setForm((atual) => ({ ...atual, cep, endereco: dados.logradouro || atual.endereco, bairro: dados.bairro || atual.bairro, cidade: dados.localidade || atual.cidade, estado: dados.uf || atual.estado, complemento: dados.complemento || atual.complemento }))
    } catch { alert("Não foi possível consultar o CEP agora") }
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return funcionarios.filter((item) => !termo || [item.nome, item.cpf, item.cargo, item.departamento, item.matricula].some((valor) => String(valor || "").toLowerCase().includes(termo)))
  }, [funcionarios, busca])
  const ativos = funcionarios.filter((item) => item.status === "Ativo").length
  const empresa = clientes.find((item) => String(item.id) === String(clienteId))

  return <div style={s.pagina}>
    <div style={s.hero}>
      <div><span style={s.badge}>Pessoas e Folha</span><h2 style={s.titulo}>Funcionários da empresa</h2><p style={s.subtitulo}>Cadastro admissional vinculado à empresa. Base preparada para folha, holerite, férias e rescisão.</p></div>
      <button style={s.botaoPrimario} onClick={novo} disabled={!clienteId}>+ Novo funcionário</button>
    </div>

    <div style={s.filtroEmpresa}>
      <label style={s.label}>Empresa</label>
      <select style={s.input} value={clienteId} onChange={(e) => selecionarEmpresa(e.target.value)}><option value="">Selecione a empresa</option>{clientes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
      {empresa && <div style={s.resumoEmpresa}><strong>{empresa.nome}</strong><span>{ativos} ativo(s) • {funcionarios.length} cadastrado(s)</span></div>}
    </div>

    {abrirFormulario && <div style={s.formCard}>
      <div style={s.formTopo}><div><h3 style={s.cardTitulo}>{editandoId ? "Corrigir cadastro" : "Admissão de funcionário"}</h3><p style={s.ajuda}>Campos com * são necessários para formar o vínculo.</p></div><button style={s.botaoSecundario} onClick={() => setAbrirFormulario(false)}>Fechar</button></div>

      <Secao titulo="1. Dados pessoais">
        <Campo label="Nome completo *"><input style={s.input} value={form.nome} onChange={(e) => alterar("nome", e.target.value)} /></Campo>
        <Campo label="Nome social"><input style={s.input} value={form.nomeSocial} onChange={(e) => alterar("nomeSocial", e.target.value)} /></Campo>
        <Campo label="CPF *"><input style={s.input} value={mascaraCpf(form.cpf)} onChange={(e) => alterar("cpf", somenteDigitos(e.target.value, 11))} /></Campo>
        <Campo label="Nascimento *"><input type="date" style={s.input} value={form.dataNascimento} onChange={(e) => alterar("dataNascimento", e.target.value)} /></Campo>
        <Campo label="Sexo"><select style={s.input} value={form.sexo} onChange={(e) => alterar("sexo", e.target.value)}><option value="">Selecione</option><option>Feminino</option><option>Masculino</option><option>Não informado</option></select></Campo>
        <Campo label="Estado civil"><select style={s.input} value={form.estadoCivil} onChange={(e) => alterar("estadoCivil", e.target.value)}><option value="">Selecione</option>{["Solteiro(a)","Casado(a)","União estável","Divorciado(a)","Viúvo(a)"].map(x=><option key={x}>{x}</option>)}</select></Campo>
        <Campo label="RG"><input style={s.input} value={form.rg} onChange={(e) => alterar("rg", e.target.value)} /></Campo>
        <Campo label="Órgão/UF do RG"><input style={s.input} value={form.orgaoEmissorRg} onChange={(e) => alterar("orgaoEmissorRg", e.target.value)} placeholder="SSP/PR" /></Campo>
        <Campo label="Emissão do RG"><input type="date" style={s.input} value={form.dataEmissaoRg} onChange={(e) => alterar("dataEmissaoRg", e.target.value)} /></Campo>
        <Campo label="Nacionalidade"><input style={s.input} value={form.nacionalidade} onChange={(e) => alterar("nacionalidade", e.target.value)} /></Campo>
        <Campo label="Naturalidade"><input style={s.input} value={form.naturalidade} onChange={(e) => alterar("naturalidade", e.target.value)} /></Campo>
        <Campo label="Escolaridade"><input style={s.input} value={form.escolaridade} onChange={(e) => alterar("escolaridade", e.target.value)} /></Campo>
        <Campo label="Nome da mãe"><input style={s.input} value={form.nomeMae} onChange={(e) => alterar("nomeMae", e.target.value)} /></Campo>
        <Campo label="Nome do pai"><input style={s.input} value={form.nomePai} onChange={(e) => alterar("nomePai", e.target.value)} /></Campo>
        <Campo label="Telefone"><input style={s.input} value={form.telefone} onChange={(e) => alterar("telefone", e.target.value)} /></Campo>
        <Campo label="E-mail"><input type="email" style={s.input} value={form.email} onChange={(e) => alterar("email", e.target.value)} /></Campo>
      </Secao>

      <Secao titulo="2. Endereço">
        <Campo label="CEP"><div style={s.linhaInput}><input style={s.input} value={mascaraCep(form.cep)} onChange={(e) => alterar("cep", somenteDigitos(e.target.value,8))} onBlur={buscarCep} /><button style={s.botaoMini} onClick={buscarCep}>Buscar</button></div></Campo>
        <Campo label="Endereço"><input style={s.input} value={form.endereco} onChange={(e) => alterar("endereco", e.target.value)} /></Campo>
        <Campo label="Número"><input style={s.input} value={form.numero} onChange={(e) => alterar("numero", e.target.value)} /></Campo>
        <Campo label="Complemento"><input style={s.input} value={form.complemento} onChange={(e) => alterar("complemento", e.target.value)} /></Campo>
        <Campo label="Bairro"><input style={s.input} value={form.bairro} onChange={(e) => alterar("bairro", e.target.value)} /></Campo>
        <Campo label="Cidade"><input style={s.input} value={form.cidade} onChange={(e) => alterar("cidade", e.target.value)} /></Campo>
        <Campo label="Estado"><select style={s.input} value={form.estado} onChange={(e) => alterar("estado", e.target.value)}>{ESTADOS.map(x=><option key={x}>{x}</option>)}</select></Campo>
      </Secao>

      <Secao titulo="3. Documentação trabalhista">
        <Campo label="CTPS Digital"><Check checked={form.ctpsDigital} onChange={(v) => alterar("ctpsDigital", v)} texto="Cadastro digital ativo" /></Campo>
        <Campo label="Número CTPS"><input style={s.input} value={form.ctpsNumero} onChange={(e) => alterar("ctpsNumero", e.target.value)} /></Campo>
        <Campo label="Série/UF CTPS"><div style={s.linhaInput}><input style={s.input} value={form.ctpsSerie} onChange={(e) => alterar("ctpsSerie", e.target.value)} /><select style={s.inputCurto} value={form.ctpsUf} onChange={(e) => alterar("ctpsUf", e.target.value)}>{ESTADOS.map(x=><option key={x}>{x}</option>)}</select></div></Campo>
        <Campo label="PIS/PASEP/NIT"><input style={s.input} value={form.pisPasepNit} onChange={(e) => alterar("pisPasepNit", e.target.value)} /></Campo>
        <Campo label="Título de eleitor"><input style={s.input} value={form.tituloEleitor} onChange={(e) => alterar("tituloEleitor", e.target.value)} /></Campo>
        <Campo label="Zona/Seção"><div style={s.linhaInput}><input style={s.input} value={form.zonaEleitoral} onChange={(e) => alterar("zonaEleitoral", e.target.value)} /><input style={s.input} value={form.secaoEleitoral} onChange={(e) => alterar("secaoEleitoral", e.target.value)} /></div></Campo>
        <Campo label="Reservista"><input style={s.input} value={form.certificadoReservista} onChange={(e) => alterar("certificadoReservista", e.target.value)} /></Campo>
        <Campo label="CNH"><input style={s.input} value={form.cnh} onChange={(e) => alterar("cnh", e.target.value)} /></Campo>
        <Campo label="Categoria/Validade CNH"><div style={s.linhaInput}><input style={s.inputCurto} value={form.cnhCategoria} onChange={(e) => alterar("cnhCategoria", e.target.value)} /><input type="date" style={s.input} value={form.cnhValidade} onChange={(e) => alterar("cnhValidade", e.target.value)} /></div></Campo>
      </Secao>

      <Secao titulo="4. Vínculo, cargo e jornada">
        <Campo label="Matrícula"><input style={s.input} value={form.matricula} onChange={(e) => alterar("matricula", e.target.value)} /></Campo>
        <Campo label="Admissão *"><input type="date" style={s.input} value={form.dataAdmissao} onChange={(e) => alterar("dataAdmissao", e.target.value)} /></Campo>
        <Campo label="Tipo de contrato"><select style={s.input} value={form.tipoContrato} onChange={(e) => alterar("tipoContrato", e.target.value)}>{["Prazo indeterminado","Experiência","Prazo determinado","Intermitente","Aprendiz","Estágio"].map(x=><option key={x}>{x}</option>)}</select></Campo>
        <Campo label="Fim do contrato"><input type="date" style={s.input} value={form.dataFimContrato} onChange={(e) => alterar("dataFimContrato", e.target.value)} /></Campo>
        <Campo label="Fim da experiência"><input type="date" style={s.input} value={form.dataFimExperiencia} onChange={(e) => alterar("dataFimExperiencia", e.target.value)} /></Campo>
        <Campo label="Cargo *"><input style={s.input} value={form.cargo} onChange={(e) => alterar("cargo", e.target.value)} /></Campo>
        <Campo label="CBO"><input style={s.input} value={form.cbo} onChange={(e) => alterar("cbo", e.target.value)} /></Campo>
        <Campo label="Departamento"><input style={s.input} value={form.departamento} onChange={(e) => alterar("departamento", e.target.value)} /></Campo>
        <Campo label="Local de trabalho"><input style={s.input} value={form.localTrabalho} onChange={(e) => alterar("localTrabalho", e.target.value)} /></Campo>
        <Campo label="Salário-base *"><input type="number" min="0" step="0.01" style={s.input} value={form.salarioBase} onChange={(e) => alterar("salarioBase", e.target.value)} /></Campo>
        <Campo label="Tipo de salário"><select style={s.input} value={form.tipoSalario} onChange={(e) => alterar("tipoSalario", e.target.value)}>{["Mensal","Horista","Diarista","Comissionista","Tarefa"].map(x=><option key={x}>{x}</option>)}</select></Campo>
        <Campo label="Jornada semanal"><input type="number" style={s.input} value={form.jornadaSemanal} onChange={(e) => alterar("jornadaSemanal", e.target.value)} /></Campo>
        <Campo label="Horário de trabalho"><input style={s.input} value={form.horarioTrabalho} onChange={(e) => alterar("horarioTrabalho", e.target.value)} placeholder="Seg–Sex 08:00–18:00" /></Campo>
        <Campo label="Intervalo"><input style={s.input} value={form.intervalo} onChange={(e) => alterar("intervalo", e.target.value)} placeholder="12:00–13:00" /></Campo>
        <Campo label="Sindicato"><input style={s.input} value={form.sindicato} onChange={(e) => alterar("sindicato", e.target.value)} /></Campo>
        <Campo label="Categoria eSocial"><input style={s.input} value={form.categoriaTrabalhador} onChange={(e) => alterar("categoriaTrabalhador", e.target.value)} /></Campo>
        <Campo label="Matrícula eSocial"><input style={s.input} value={form.eSocialMatricula} onChange={(e) => alterar("eSocialMatricula", e.target.value)} /></Campo>
        <Campo label="Regime previdenciário"><select style={s.input} value={form.regimePrevidenciario} onChange={(e) => alterar("regimePrevidenciario", e.target.value)}><option>RGPS</option><option>RPPS</option></select></Campo>
        <Campo label="FGTS"><Check checked={form.optanteFgts} onChange={(v) => alterar("optanteFgts", v)} texto="Optante pelo FGTS" /></Campo>
        <Campo label="Data de opção FGTS"><input type="date" style={s.input} value={form.dataOpcaoFgts} onChange={(e) => alterar("dataOpcaoFgts", e.target.value)} /></Campo>
      </Secao>

      <Secao titulo="5. Pagamento e benefícios">
        <Campo label="Banco"><input style={s.input} value={form.banco} onChange={(e) => alterar("banco", e.target.value)} /></Campo>
        <Campo label="Agência"><input style={s.input} value={form.agencia} onChange={(e) => alterar("agencia", e.target.value)} /></Campo>
        <Campo label="Conta"><input style={s.input} value={form.conta} onChange={(e) => alterar("conta", e.target.value)} /></Campo>
        <Campo label="Tipo de conta"><select style={s.input} value={form.tipoConta} onChange={(e) => alterar("tipoConta", e.target.value)}><option>Conta corrente</option><option>Conta salário</option><option>Conta poupança</option></select></Campo>
        <Campo label="Chave PIX"><input style={s.input} value={form.chavePix} onChange={(e) => alterar("chavePix", e.target.value)} /></Campo>
        <Campo label="Forma de pagamento"><select style={s.input} value={form.formaPagamento} onChange={(e) => alterar("formaPagamento", e.target.value)}><option>Transferência bancária</option><option>PIX</option><option>Dinheiro</option><option>Cheque</option></select></Campo>
        <Campo label="Vale-transporte"><Check checked={form.valeTransporte} onChange={(v) => alterar("valeTransporte", v)} texto="Conceder vale-transporte" /></Campo>
        <Campo label="Valor vale-transporte"><input type="number" step="0.01" style={s.input} value={form.valorValeTransporte} onChange={(e) => alterar("valorValeTransporte", e.target.value)} /></Campo>
        <Campo label="Vale-alimentação"><Check checked={form.valeAlimentacao} onChange={(v) => alterar("valeAlimentacao", v)} texto="Conceder vale-alimentação" /></Campo>
        <Campo label="Valor vale-alimentação"><input type="number" step="0.01" style={s.input} value={form.valorValeAlimentacao} onChange={(e) => alterar("valorValeAlimentacao", e.target.value)} /></Campo>
        <Campo label="Plano de saúde"><Check checked={form.planoSaude} onChange={(v) => alterar("planoSaude", v)} texto="Possui plano de saúde" /></Campo>
        <Campo label="Insalubridade %"><input type="number" style={s.input} value={form.insalubridadePercentual} onChange={(e) => alterar("insalubridadePercentual", e.target.value)} /></Campo>
        <Campo label="Periculosidade"><Check checked={form.periculosidade} onChange={(v) => alterar("periculosidade", v)} texto="Recebe adicional de periculosidade" /></Campo>
      </Secao>

      <div style={s.secao}><div style={s.secaoTopo}><h4 style={s.secaoTitulo}>6. Dependentes</h4><button style={s.botaoMini} onClick={adicionarDependente}>+ Dependente</button></div>{form.dependentes.length === 0 ? <p style={s.ajuda}>Nenhum dependente informado.</p> : form.dependentes.map((dep,i)=><div style={s.dependente} key={i}><input style={s.input} placeholder="Nome" value={dep.nome} onChange={(e)=>alterarDependente(i,"nome",e.target.value)} /><input style={s.input} placeholder="CPF" value={mascaraCpf(dep.cpf)} onChange={(e)=>alterarDependente(i,"cpf",somenteDigitos(e.target.value,11))} /><input type="date" style={s.input} value={dep.dataNascimento} onChange={(e)=>alterarDependente(i,"dataNascimento",e.target.value)} /><select style={s.input} value={dep.parentesco} onChange={(e)=>alterarDependente(i,"parentesco",e.target.value)}><option>Filho(a)</option><option>Cônjuge</option><option>Enteado(a)</option><option>Pai/Mãe</option><option>Outro</option></select><Check checked={dep.irrf} onChange={(v)=>alterarDependente(i,"irrf",v)} texto="IRRF" /><Check checked={dep.salarioFamilia} onChange={(v)=>alterarDependente(i,"salarioFamilia",v)} texto="Salário-família" /><button style={s.botaoPerigo} onClick={()=>removerDependente(i)}>Remover</button></div>)}</div>

      <Secao titulo="7. Saúde ocupacional, documentos e situação">
        <Campo label="ASO admissional"><input type="date" style={s.input} value={form.exameAdmissionalData} onChange={(e) => alterar("exameAdmissionalData", e.target.value)} /></Campo>
        <Campo label="Validade do ASO"><input type="date" style={s.input} value={form.exameAdmissionalValidade} onChange={(e) => alterar("exameAdmissionalValidade", e.target.value)} /></Campo>
        <Campo label="Situação"><select style={s.input} value={form.status} onChange={(e) => alterar("status", e.target.value)}><option>Ativo</option><option>Afastado</option><option>Férias</option><option>Desligado</option></select></Campo>
        <Campo label="Data de desligamento"><input type="date" style={s.input} value={form.dataDesligamento} onChange={(e) => alterar("dataDesligamento", e.target.value)} /></Campo>
        <Campo label="Motivo do desligamento"><input style={s.input} value={form.motivoDesligamento} onChange={(e) => alterar("motivoDesligamento", e.target.value)} /></Campo>
        <Campo label="Observações"><textarea style={{...s.input,minHeight:90}} value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} /></Campo>
      </Secao>
      <div style={s.documentos}><strong>Checklist admissional</strong><div style={s.checkGrid}>{DOCUMENTOS_ADMISSAO.map((nome)=><Check key={nome} checked={form.documentos.includes(nome)} onChange={()=>alternarDocumento(nome)} texto={nome} />)}</div></div>
      <div style={s.acoes}><button style={s.botaoSecundario} onClick={() => setAbrirFormulario(false)}>Cancelar</button><button style={s.botaoPrimario} disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : editandoId ? "Salvar correção" : "Cadastrar funcionário"}</button></div>
    </div>}

    <div style={s.listaCard}>
      <div style={s.listaTopo}><div><h3 style={s.cardTitulo}>Quadro de funcionários</h3><span style={s.ajuda}>{empresa ? empresa.nome : "Selecione uma empresa"}</span></div><input style={s.pesquisa} placeholder="Pesquisar nome, CPF, cargo ou matrícula" value={busca} onChange={(e)=>setBusca(e.target.value)} /></div>
      {!clienteId ? <div style={s.vazio}>Selecione uma empresa para consultar os funcionários.</div> : filtrados.length === 0 ? <div style={s.vazio}>Nenhum funcionário cadastrado nessa empresa.</div> : <div style={s.tabelaWrap}><table style={s.tabela}><thead><tr><th>Funcionário</th><th>Cargo</th><th>Admissão</th><th>Salário-base</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{filtrados.map((item)=><tr key={item.id}><td><strong>{item.nome}</strong><small style={s.small}>CPF {mascaraCpf(item.cpf)} • {item.matricula || "Sem matrícula"}</small></td><td>{item.cargo}<small style={s.small}>{item.departamento || "Sem departamento"}</small></td><td>{dataBr(item.dataAdmissao)}</td><td>{moeda(item.salarioBase)}</td><td><span style={{...s.status,color:item.status==="Ativo"?"#35f58a":"#ffd166"}}>{item.status}</span></td><td><div style={s.linhaInput}><button style={s.botaoMini} onClick={()=>editar(item)}>Abrir</button>{item.status==="Ativo"&&<button style={s.botaoMini} onClick={()=>abrirRescisao(item)}>Rescisão</button>}<button style={s.botaoPerigo} onClick={()=>excluir(item)}>Remover</button></div></td></tr>)}</tbody></table></div>}
    </div>
  </div>
}

function Secao({ titulo, children }) { return <div style={s.secao}><h4 style={s.secaoTitulo}>{titulo}</h4><div style={s.grid}>{children}</div></div> }
function Campo({ label, children }) { return <label style={s.campo}><span style={s.label}>{label}</span>{children}</label> }
function Check({ checked, onChange, texto }) { return <label style={s.check}><input type="checkbox" checked={Boolean(checked)} onChange={(e)=>onChange(e.target.checked)} /><span>{texto}</span></label> }

const s = {
  pagina:{padding:24,color:"#eef7ff",background:"#071d3d",minHeight:"100vh"},hero:{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",padding:24,border:"1px solid #147c9c",borderRadius:18,background:"linear-gradient(135deg,#0b3463,#075b67)",marginBottom:18},badge:{color:"#49f2c2",fontWeight:800,fontSize:12,textTransform:"uppercase"},titulo:{margin:"6px 0",fontSize:28},subtitulo:{margin:0,color:"#b9cee1"},filtroEmpresa:{display:"grid",gridTemplateColumns:"100px minmax(260px,1fr) minmax(260px,1fr)",gap:12,alignItems:"center",padding:18,background:"#092750",borderRadius:15,marginBottom:18},resumoEmpresa:{display:"flex",justifyContent:"space-between",gap:12,padding:"11px 14px",background:"#061d3e",borderRadius:10,color:"#bdeadd"},formCard:{padding:20,background:"#092750",border:"1px solid #185985",borderRadius:16,marginBottom:20},formTopo:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16},cardTitulo:{margin:"0 0 5px",fontSize:20},ajuda:{color:"#9db6ce",fontSize:13,margin:"4px 0"},secao:{padding:16,background:"#061e40",borderRadius:13,marginTop:14,border:"1px solid #123e69"},secaoTopo:{display:"flex",justifyContent:"space-between",alignItems:"center"},secaoTitulo:{margin:"0 0 13px",color:"#55e6c1"},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:13},campo:{display:"flex",flexDirection:"column",gap:6},label:{fontSize:12,color:"#b8cee2",fontWeight:700},input:{width:"100%",boxSizing:"border-box",background:"#0b315d",border:"1px solid #26648b",color:"white",padding:"10px 11px",borderRadius:8},inputCurto:{width:90,background:"#0b315d",border:"1px solid #26648b",color:"white",padding:"10px",borderRadius:8},linhaInput:{display:"flex",gap:8,alignItems:"center"},check:{display:"flex",gap:8,alignItems:"center",fontSize:13,color:"#d9e8f5",minHeight:38},checkGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:6,marginTop:10},documentos:{padding:16,background:"#061e40",borderRadius:13,marginTop:14},dependente:{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr auto auto auto",gap:8,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #17486e"},acoes:{display:"flex",justifyContent:"flex-end",gap:10,marginTop:18},botaoPrimario:{border:0,borderRadius:9,padding:"11px 18px",background:"linear-gradient(90deg,#00a8ff,#19e6a6)",color:"#032443",fontWeight:900,cursor:"pointer"},botaoSecundario:{border:"1px solid #34729d",borderRadius:9,padding:"10px 16px",background:"#11375f",color:"white",fontWeight:700,cursor:"pointer"},botaoMini:{border:0,borderRadius:7,padding:"8px 11px",background:"#0aa7c2",color:"white",fontWeight:800,cursor:"pointer"},botaoPerigo:{border:"1px solid #8d3e58",borderRadius:7,padding:"8px 10px",background:"#4a2033",color:"#ffbdca",cursor:"pointer"},listaCard:{padding:20,background:"#092750",borderRadius:16},listaTopo:{display:"flex",justifyContent:"space-between",gap:15,alignItems:"center",marginBottom:14},pesquisa:{minWidth:300,background:"#061e40",border:"1px solid #26648b",color:"white",padding:"10px 12px",borderRadius:9},vazio:{padding:25,textAlign:"center",color:"#9db6ce",background:"#061e40",borderRadius:10},tabelaWrap:{overflowX:"auto"},tabela:{width:"100%",borderCollapse:"collapse"},small:{display:"block",color:"#8da8c1",fontSize:11,marginTop:4},status:{fontWeight:800},
}
