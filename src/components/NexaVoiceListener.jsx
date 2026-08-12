import { useCallback, useEffect, useRef, useState } from "react"
import { abrirConversaNexa, conversarComNexa } from "../services/conversaNexaService"
import {
  sintetizarVozNeural,
  transcreverVozGroq,
  verificarVozNeural,
} from "../services/nexaVoiceTtsService"
import {
  aprenderVocabularioVoz,
  executarAcaoDeVoz,
  listarVocabularioVoz,
  obterContextoVoz,
  precarregarClientesVoz,
  registrarClienteVoz,
  registrarConversaVoz,
  resolverEscolhaClientePendente,
} from "../services/nexaVoiceService"

const VOICE_ENABLED_KEY = "nexaVoiceEnabled"
const SPOKEN_RESPONSES_ENABLED_KEY = "nexaSpokenResponsesEnabled"
const MICROPHONE_DEVICE_KEY = "nexaVoiceMicrophoneDeviceId"
const FLOAT_POSITION_KEY = "nexaVoiceFloatPosition"
const PROTECTED_LISTENING_KEY = "nexaProtectedListeningEnabled"
const PROTECTED_SESSION_TIMEOUT_MS = 45000
const WAKE_WORD_PATTERN = /^\s*(?:(?:ei|ola|olá)\s+)?(?:nexa|néxa|neksa|nexta|nessa)\b[\s,.:;-]*(.*)$/i
const GREETING_PATTERN = /^\s*(bom\s+dia|boa\s+tarde)\b[\s,.:;-]*(.*)$/i
const END_SESSION_PATTERN = /^\s*(?:muito\s+)?obrigad[oa][.!?]*\s*$/i
const CONFIRMACAO_SIM_PATTERN = /^\s*(?:sim|isso|correto|exatamente|essa mesma|esse mesmo|pode ser|é esse|e esse|é essa|e essa)[.!?]*\s*$/i
const CONFIRMACAO_NAO_PATTERN = /^\s*(?:não|nao|negativo|não é|nao e|outro|outra)[.!?]*\s*$/i
const CANCELAR_SELECAO_CLIENTE_PATTERN = /^\s*(?:cancela|cancelar|cancele|deixa|deixe|deixa pra la|deixa para la|esquece|esqueca|não quero|nao quero)[.!?]*\s*$/i
const TEMPO_MAXIMO_FALA_MS = 30000

const SILENCIO_PARA_FINALIZAR_MS = 520
const DURACAO_MINIMA_FALA_MS = 420
const DURACAO_MAXIMA_FALA_MS = 8500
const TAMANHO_MINIMO_AUDIO = 900
const TEMPO_CALIBRACAO_RUIDO_MS = 320
const TEMPO_REARME_MICROFONE_MS = 380
const TEMPO_BLOQUEIO_ECO_MS = 1050
const TEMPO_REARME_COMANDO_DIRETO_MS = 180

const NAVEGACAO_LOCAL = [
  { tipo: "abrir-grupo", grupo: "Ferramentas", aliases: ["menu ferramentas", "grupo ferramentas", "ferramentas"] },
  { tipo: "abrir-grupo", grupo: "Configurações", aliases: ["menu configuracoes", "grupo configuracoes", "configuracoes"] },
  { tipo: "abrir-grupo", grupo: "Atendimento", aliases: ["menu atendimento", "grupo atendimento", "atendimento"] },
  { pagina: "Dashboard", aliases: ["dashboard", "painel inicial", "tela inicial", "inicio", "home"] },
  { pagina: "Clientes", aliases: ["cadastro de clientes", "carteira de clientes", "lista de clientes", "clientes"] },
  { pagina: "Fiscal", aliases: ["modulo fiscal", "tela fiscal", "area fiscal", "parte fiscal", "fiscal"] },
  { pagina: "Financeiro", aliases: ["financeiro do escritorio", "modulo financeiro", "tela financeira", "financeiro"] },
  { pagina: "Movimentos Clientes", aliases: ["movimentos dos clientes", "movimentacoes dos clientes", "movimentos clientes", "movimentacoes clientes", "movimentacao", "movimentacoes", "movimento", "movimentos"] },
  { pagina: "Lançamentos Contábeis", aliases: ["lancamentos contabeis", "lancamento contabil", "contabilidade", "contabil"] },
  { pagina: "Clientes", secao: "servicos", aliases: ["servicos e cobrancas", "servico e cobranca", "servicos avulsos", "servico avulso", "lancar servico avulso", "lancamento de servico avulso"] },
  { pagina: "DRE Gerencial", aliases: ["dre gerencial", "demonstracao do resultado", "dre"] },
  { pagina: "Documentos Digitais", aliases: ["documentos digitais", "documentos"] },
  { pagina: "Pendências Clientes", aliases: ["pendencias dos clientes", "pendencias clientes", "pendencias"] },
  { pagina: "Acesso Rápido Fiscal", aliases: ["acesso rapido fiscal", "atalhos fiscais"] },
  { pagina: "WhatsApp Inteligente", aliases: ["whatsapp inteligente", "whatsapp"] },
  { pagina: "Assistente do Dia", aliases: ["assistente do dia", "prioridades do dia", "iniciar meu dia", "comecar meu dia", "começar meu dia"] },
  { pagina: "Escritório Digital", aliases: ["escritorio digital"] },
  { pagina: "Certificados Digitais", aliases: ["certificados digitais", "certificado digital", "certificados"] },
  { pagina: "Procurações e-CAC", aliases: ["procuracoes e-cac", "procuracoes ecac", "procuracoes"] },
  { pagina: "Central e-CAC", aliases: ["central e-cac", "central ecac", "e-cac", "ecac"] },
  { pagina: "Memória da Nexa", aliases: ["memoria da nexa", "memoria nexa"] },
  { pagina: "Segundo Contador", aliases: ["segundo contador"] },
  { pagina: "Consultora Tributária", aliases: ["consultora tributaria", "consultora"] },
  { pagina: "Conversa com a Nexa", aliases: ["conversa com a nexa", "nexa assist"] },
  { pagina: "Radar Inteligente", aliases: ["radar inteligente", "radar"] },
  { pagina: "Relatórios", aliases: ["relatorios"] },
  { pagina: "Agenda", aliases: ["agenda"] },
  { pagina: "Backup Sistema", aliases: ["backup do sistema", "backup sistema", "backup"] },
  { pagina: "Sobre", aliases: ["sobre a nexa", "sobre"] },
]

function normalizarComandoLocal(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function transcricaoPareceEco(texto, ultimaResposta) {
  const ouvido = normalizarComandoLocal(texto)
  const falado = normalizarComandoLocal(ultimaResposta)
  if (!ouvido || !falado) return false
  return ouvido === falado || falado.includes(ouvido) || ouvido.includes(falado)
}


const TRANSCRICOES_RUIDO_PATTERN = /^\s*(?:e\s+a[ií]|ei|oi|ah|hã|ha|hum|hmm|é|eh|tá|ta|obrigad[oa]\s+por\s+assistir|legendas(?:\s+pela\s+comunidade)?.*)\s*[.!?]*\s*$/i

function falaTemQualidadeMinima(texto, metadados = {}) {
  const duracao = Number(metadados.duracao || 0)
  const pico = Number(metadados.pico || 0)
  const ruido = Math.max(Number(metadados.ruido || 0.006), 0.003)
  const palavras = normalizarComandoLocal(texto).split(" ").filter(Boolean)

  const picoMinimo = Math.max(0.014, ruido * 2.25)
  if (duracao < DURACAO_MINIMA_FALA_MS || pico < picoMinimo) return false

  const comandoDireto = Boolean(detectarAcaoLocalDeNavegacao(texto))
  if (comandoDireto) return true

  // Frases curtas e sem ação conhecida são as mais inventadas pelo Whisper
  // quando há ruído. Exige uma voz mais nítida antes de enviá-las à IA.
  if (palavras.length <= 2) {
    return duracao >= 620 && pico >= Math.max(0.019, ruido * 2.75)
  }

  return true
}

function falaPassaEscutaProtegida(texto, metadados = {}) {
  const duracao = Number(metadados.duracao || 0)
  const pico = Number(metadados.pico || 0)
  const ruido = Math.max(Number(metadados.ruido || 0.006), 0.003)
  const palavras = normalizarComandoLocal(texto).split(" ").filter(Boolean)

  // Música, televisão e conversas ao fundo costumam produzir trechos longos,
  // contínuos e com pouca separação entre a voz e o ruído ambiente.
  if (duracao > 6500 || palavras.length > 24) return false
  if (pico < Math.max(0.021, ruido * 3.15)) return false
  if (palavras.length <= 2 && duracao < 680) return false
  return true
}

function encerramentoTemVozConfiavel(metadados = {}) {
  const duracao = Number(metadados.duracao || 0)
  const pico = Number(metadados.pico || 0)
  const ruido = Number(metadados.ruido || 0.006)
  return duracao >= 720 && pico >= Math.max(0.022, ruido * 3.0)
}

function detectarAcaoLocalDeNavegacao(textoOriginal) {
  const texto = normalizarComandoLocal(textoOriginal)
  if (!texto) return null

  const temVerbo = /(^|\s)(abra|abre|abrir|acesse|acessar|entre|entrar|va|vai|ir|navegue|navegar|mostre|mostrar|exiba|ver|volte|voltar|retorne|retornar|me leve|me leva)(\s|$)/.test(texto)

  const candidatos = NAVEGACAO_LOCAL
    .flatMap((item) => item.aliases.map((alias) => ({ ...item, alias: normalizarComandoLocal(alias) })))
    .sort((a, b) => b.alias.length - a.alias.length)

  const encontrado = candidatos.find(({ alias }) =>
    texto === alias || (temVerbo && ` ${texto} `.includes(` ${alias} `))
  )
  if (!encontrado) return null

  if (encontrado.tipo === "abrir-grupo") {
    return {
      tipo: "abrir-grupo",
      grupo: encontrado.grupo,
      segura: true,
    }
  }

  return {
    tipo: "navegar",
    pagina: encontrado.pagina,
    alvo: "pagina",
    secao: encontrado.secao || "",
    segura: true,
    cliente: null,
  }
}

function respostaLocalDeNavegacao(pagina, grupo = "") {
  if (grupo) return [`Menu ${grupo} aberto.`, ""]

  const respostas = {
    Dashboard: ["Dashboard aberto.", "Pronto."],
    Clientes: ["Clientes abertos.", "Certo."],
    Fiscal: ["Fiscal aberto.", "Pronto."],
    Financeiro: ["Financeiro aberto.", "Pronto."],
    "Movimentos Clientes": ["Movimentações abertas.", "Aqui está."],
    "Lançamentos Contábeis": ["Lançamentos contábeis abertos.", "Certo."],
    "DRE Gerencial": ["DRE aberta.", "Aqui está."],
    "Documentos Digitais": ["Documentos abertos.", "Aqui está."],
    "Pendências Clientes": ["Pendências abertas.", "Certo."],
  }
  return respostas[pagina] || ["Tela aberta.", "Pronto."]
}

function limparRespostaDaNexa(valor, fallback = "Comando concluído.") {
  const texto = String(valor || "").trim()
  if (!texto) return fallback

  const inicioJson = texto.indexOf('{"resposta"')
  if (inicioJson === 0) {
    try {
      const objeto = JSON.parse(texto)
      return String(objeto?.resposta || "Comando concluído.").trim()
    } catch {
      return texto
    }
  }

  if (inicioJson > 0) return texto.slice(0, inicioJson).trim()
  return texto
}

function criarEstadoInicial() {
  const ativada = localStorage.getItem(VOICE_ENABLED_KEY) === "true"
  return {
    ativada,
    status: ativada ? "iniciando" : "pausada",
    detalhe: ativada
      ? "Preparando o microfone e a transcrição..."
      : "Ative uma vez para usar a Nexa sem tocar no microfone.",
  }
}

function nomeStatus(status) {
  if (status === "aguardando") return "Aguardando chamada"
  if (status === "conversando") return "Conversa ativa"
  if (status === "ouvindo") return "Ouvindo"
  if (status === "transcrevendo") return "Entendendo sua fala"
  if (status === "processando") return "Processando"
  if (status === "falando") return "Falando"
  if (status === "erro") return "Atenção necessária"
  if (status === "iniciando") return "Iniciando"
  return "Nexa Voice pausada"
}

function tocarSinal(frequencia = 720, duracao = 90) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const contexto = new AudioContext()
    const oscilador = contexto.createOscillator()
    const ganho = contexto.createGain()
    oscilador.frequency.value = frequencia
    ganho.gain.setValueAtTime(0.055, contexto.currentTime)
    ganho.gain.exponentialRampToValueAtTime(0.001, contexto.currentTime + duracao / 1000)
    oscilador.connect(ganho)
    ganho.connect(contexto.destination)
    oscilador.start()
    oscilador.stop(contexto.currentTime + duracao / 1000)
    setTimeout(() => contexto.close().catch(() => {}), duracao + 120)
  } catch {
    // O sinal sonoro é apenas um auxílio.
  }
}

function pontuarVozLocal(voz) {
  const nome = String(voz?.name || "").toLowerCase()
  const idioma = String(voz?.lang || "").replace("_", "-").toLowerCase()
  if (!idioma.startsWith("pt")) return -1000

  let pontos = idioma === "pt-br" ? 100 : 40
  if (nome.includes("natural")) pontos += 1300
  if (nome.includes("online")) pontos += 280
  if (nome.includes("microsoft maria")) pontos += 900
  else if (nome.includes("maria")) pontos += 760
  if (/francisca|heloisa|heloísa|luciana|camila|fernanda|vitoria|vitória|female|feminina/.test(nome)) pontos += 140
  if (/daniel|ricardo|felipe|antonio|antônio|male|masculin/.test(nome)) pontos -= 400
  if (voz?.localService) pontos += 30
  return pontos
}

function escolherVozFeminina(vozes = []) {
  return [...vozes]
    .filter((voz) => /^pt(?:-|_)/i.test(voz?.lang || ""))
    .sort((a, b) => pontuarVozLocal(b) - pontuarVozLocal(a))[0] || null
}

function nomeAmigavelVoz(voz) {
  const nome = String(voz?.name || "").trim()
  if (/microsoft maria/i.test(nome)) return "Microsoft Maria — Windows"
  if (/maria/i.test(nome)) return `${nome} — Windows`
  return nome ? `${nome} — Windows` : "Voz feminina do Windows"
}

function extrairAtivacao(textoOriginal) {
  const texto = String(textoOriginal || "").trim()
  const wake = texto.match(WAKE_WORD_PATTERN)
  if (wake) {
    return { gatilho: "nexa", comando: String(wake[1] || "").trim() }
  }

  const saudacao = texto.match(GREETING_PATTERN)
  if (saudacao) {
    return {
      gatilho: saudacao[1].toLowerCase(),
      comando: String(saudacao[2] || "").trim(),
    }
  }

  return null
}

function respostaDeAtivacao(gatilho) {
  if (gatilho === "bom dia") return "Bom dia, pode falar."
  if (gatilho === "boa tarde") return "Boa tarde, pode falar."
  return "Oi, pode falar."
}

function mimeGravacaoDisponivel() {
  const opcoes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ]
  return opcoes.find((tipo) => window.MediaRecorder?.isTypeSupported?.(tipo)) || ""
}

function calcularRms(amostras) {
  let soma = 0
  for (let i = 0; i < amostras.length; i += 1) soma += amostras[i] * amostras[i]
  return Math.sqrt(soma / amostras.length)
}

export default function NexaVoiceListener({ usuario, setPage, page }) {
  const [estado, setEstado] = useState(criarEstadoInicial)
  const [sessaoAtiva, setSessaoAtiva] = useState(false)
  const [ultimaFala, setUltimaFala] = useState("")
  const [ultimaResposta, setUltimaResposta] = useState("")
  const [mensagemDigitada, setMensagemDigitada] = useState("")
  const [mensagensPainel, setMensagensPainel] = useState([])
  const [enviandoTexto, setEnviandoTexto] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640)
  const [microfone, setMicrofone] = useState("Microfone padrão do Windows")
  const [microfonesDisponiveis, setMicrofonesDisponiveis] = useState([])
  const [microfoneSelecionado, setMicrofoneSelecionado] = useState(() => localStorage.getItem(MICROPHONE_DEVICE_KEY) || "")
  const [respostasFaladasAtivas, setRespostasFaladasAtivas] = useState(
    () => localStorage.getItem(SPOKEN_RESPONSES_ENABLED_KEY) === "true",
  )
  const [vozAtiva, setVozAtiva] = useState("Preparando voz da Nexa...")
  const [transcricaoAtiva, setTranscricaoAtiva] = useState("Groq Whisper")
  const [expandido, setExpandido] = useState(false)
  const [totalVocabulario, setTotalVocabulario] = useState(0)
  const [historicoSalvo, setHistoricoSalvo] = useState(() => Boolean(obterContextoVoz().conversaId))
  const [escutaProtegida, setEscutaProtegida] = useState(
    () => localStorage.getItem(PROTECTED_LISTENING_KEY) !== "false",
  )
  const [posicaoFlutuante, setPosicaoFlutuante] = useState(() => {
    try {
      const salva = JSON.parse(localStorage.getItem(FLOAT_POSITION_KEY) || "null")
      return Number.isFinite(salva?.x) && Number.isFinite(salva?.y) ? salva : null
    } catch {
      return null
    }
  })

  const ativadaRef = useRef(estado.ativada)
  const respostasFaladasAtivasRef = useRef(respostasFaladasAtivas)
  const sessaoAtivaRef = useRef(false)
  const modoRef = useRef("wake")
  const processandoRef = useRef(false)
  const transcrevendoRef = useRef(false)
  const falandoRef = useRef(false)
  const capturaPausadaRef = useRef(false)
  const reinicioRef = useRef(null)
  const conversaIdRef = useRef(obterContextoVoz().conversaId || null)
  const historicoRef = useRef([])
  const tratarTranscricaoRef = useRef(null)
  const sugestaoVocabularioRef = useRef(null)
  const vocabularioRef = useRef([])
  const clientesConhecidosRef = useRef([])
  const selecaoClientePendenteRef = useRef(null)
  const vozNeuralDisponivelRef = useRef(false)
  const vozNeuralNomeRef = useRef("pt-BR-FranciscaNeural")
  const transcricaoDisponivelRef = useRef(false)
  const audioVozRef = useRef(null)
  const ultimaRespostaFaladaRef = useRef("")
  const ignorarEcoAteRef = useRef(0)
  const fimPainelRef = useRef(null)
  const campoMensagemRef = useRef(null)
  const containerFlutuanteRef = useRef(null)
  const arrasteFlutuanteRef = useRef(null)
  const timeoutSessaoProtegidaRef = useRef(null)
  const escutaProtegidaRef = useRef(escutaProtegida)

  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const animacaoRef = useRef(null)
  const falaChunksRef = useRef([])
  const falaAtivaRef = useRef(false)
  const finalizandoTrechoRef = useRef(false)
  const descartarTrechoRef = useRef(false)
  const duracaoTrechoRef = useRef(0)
  const inicioFalaRef = useRef(0)
  const ultimaVozRef = useRef(0)
  const framesVozRef = useRef(0)
  const picoFalaRef = useRef(0)
  const ruidoBaseRef = useRef(0.006)
  const calibrandoAteRef = useRef(0)
  const iniciarCapturaRef = useRef(null)
  const pararCapturaRef = useRef(null)
  const reiniciandoCapturaRef = useRef(false)
  const microfoneSelecionadoRef = useRef(localStorage.getItem(MICROPHONE_DEVICE_KEY) || "")
  const contextoClienteRef = useRef(obterContextoVoz())

  useEffect(() => {
    respostasFaladasAtivasRef.current = respostasFaladasAtivas
    localStorage.setItem(SPOKEN_RESPONSES_ENABLED_KEY, String(respostasFaladasAtivas))

    if (!respostasFaladasAtivas) {
      audioVozRef.current?.pause?.()
      window.speechSynthesis?.cancel?.()
    }
  }, [respostasFaladasAtivas])

  useEffect(() => {
    escutaProtegidaRef.current = escutaProtegida
    localStorage.setItem(PROTECTED_LISTENING_KEY, String(escutaProtegida))
    if (!escutaProtegida) clearTimeout(timeoutSessaoProtegidaRef.current)
  }, [escutaProtegida])

  const limitarPosicaoFlutuante = useCallback((x, y) => {
    const elemento = containerFlutuanteRef.current
    const largura = elemento?.offsetWidth || 250
    const altura = elemento?.offsetHeight || 54
    const margem = 8

    return {
      x: Math.min(Math.max(margem, x), Math.max(margem, window.innerWidth - largura - margem)),
      y: Math.min(Math.max(margem, y), Math.max(margem, window.innerHeight - altura - margem)),
    }
  }, [])

  const iniciarArrasteFlutuante = useCallback((evento) => {
    if (evento.button !== undefined && evento.button !== 0) return

    const retangulo = containerFlutuanteRef.current?.getBoundingClientRect()
    if (!retangulo) return

    arrasteFlutuanteRef.current = {
      pointerId: evento.pointerId,
      inicioX: evento.clientX,
      inicioY: evento.clientY,
      origemX: retangulo.left,
      origemY: retangulo.top,
      moveu: false,
    }
    evento.currentTarget.setPointerCapture?.(evento.pointerId)
  }, [])

  const moverFlutuante = useCallback((evento) => {
    const arraste = arrasteFlutuanteRef.current
    if (!arraste || arraste.pointerId !== evento.pointerId) return

    const deltaX = evento.clientX - arraste.inicioX
    const deltaY = evento.clientY - arraste.inicioY
    if (!arraste.moveu && Math.hypot(deltaX, deltaY) < 5) return

    arraste.moveu = true
    evento.preventDefault()
    setPosicaoFlutuante(limitarPosicaoFlutuante(arraste.origemX + deltaX, arraste.origemY + deltaY))
  }, [limitarPosicaoFlutuante])

  const finalizarArrasteFlutuante = useCallback((evento) => {
    const arraste = arrasteFlutuanteRef.current
    if (!arraste || arraste.pointerId !== evento.pointerId) return

    evento.currentTarget.releasePointerCapture?.(evento.pointerId)
    arrasteFlutuanteRef.current = null

    if (arraste.moveu) {
      setPosicaoFlutuante((atual) => {
        if (atual) localStorage.setItem(FLOAT_POSITION_KEY, JSON.stringify(atual))
        return atual
      })
      return
    }

    setExpandido((valor) => !valor)
  }, [])

  useEffect(() => {
    const reposicionar = () => {
      setPosicaoFlutuante((atual) => {
        if (!atual) return atual
        const ajustada = limitarPosicaoFlutuante(atual.x, atual.y)
        localStorage.setItem(FLOAT_POSITION_KEY, JSON.stringify(ajustada))
        return ajustada
      })
    }

    window.addEventListener("resize", reposicionar)
    return () => window.removeEventListener("resize", reposicionar)
  }, [limitarPosicaoFlutuante])

  useEffect(() => {
    if (!posicaoFlutuante) return
    const ajustada = limitarPosicaoFlutuante(posicaoFlutuante.x, posicaoFlutuante.y)
    setPosicaoFlutuante(ajustada)
    localStorage.setItem(FLOAT_POSITION_KEY, JSON.stringify(ajustada))
  }, [expandido])

  useEffect(() => {
    const sincronizarContextoCliente = (evento) => {
      const idEvento = evento?.detail?.id
      const nomeEvento = evento?.detail?.nome
      contextoClienteRef.current = idEvento
        ? {
            ...obterContextoVoz(),
            clienteId: String(idEvento),
            clienteNome: String(nomeEvento || ""),
          }
        : obterContextoVoz()
    }

    sincronizarContextoCliente()
    window.addEventListener("nexa:contexto-cliente-atualizado", sincronizarContextoCliente)
    return () => window.removeEventListener("nexa:contexto-cliente-atualizado", sincronizarContextoCliente)
  }, [])

  const carregarHistoricoPainel = useCallback(async (idInformado = null) => {
    const conversaId = idInformado || conversaIdRef.current || obterContextoVoz().conversaId
    if (!conversaId) return

    try {
      const dados = await abrirConversaNexa(conversaId)
      const mensagens = Array.isArray(dados?.mensagens) ? dados.mensagens : []
      const mapeadas = mensagens.slice(-30).map((item) => ({
        id: `db-${item.id}`,
        autor: item.autor === "usuario" ? "Você" : "Nexa",
        texto: item.texto,
        data: item.createdAt || new Date().toISOString(),
        acaoExecutada: Boolean(item?.dados?.acao),
      }))

      conversaIdRef.current = String(conversaId)
      setHistoricoSalvo(true)
      setMensagensPainel(mapeadas)
      historicoRef.current = mapeadas.slice(-12).map((item) => ({
        autor: item.autor,
        texto: item.texto,
      }))
    } catch (error) {
      console.warn("[Nexa] Não foi possível carregar o histórico da conversa:", error)
    }
  }, [])

  useEffect(() => {
    const atualizarMobile = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener("resize", atualizarMobile)
    return () => window.removeEventListener("resize", atualizarMobile)
  }, [])

  useEffect(() => {
    const contextoSalvo = obterContextoVoz()
    const contexto = contextoClienteRef.current?.clienteId
      ? { ...contextoSalvo, ...contextoClienteRef.current }
      : contextoSalvo
    if (contexto.conversaId) carregarHistoricoPainel(contexto.conversaId)

    const sincronizarConversa = (evento) => {
      const conversaId = evento?.detail?.conversaId || obterContextoVoz().conversaId
      conversaIdRef.current = conversaId || null
      setHistoricoSalvo(Boolean(conversaId))
      if (conversaId && !processandoRef.current) carregarHistoricoPainel(conversaId)
      if (!conversaId) {
        setMensagensPainel([])
        historicoRef.current = []
      }
    }

    window.addEventListener("nexa:conversa-atualizada", sincronizarConversa)
    return () => window.removeEventListener("nexa:conversa-atualizada", sincronizarConversa)
  }, [carregarHistoricoPainel])

  useEffect(() => {
    if (expandido && !mensagensPainel.length) carregarHistoricoPainel()
  }, [carregarHistoricoPainel, expandido, mensagensPainel.length])

  useEffect(() => {
    fimPainelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" })
  }, [mensagensPainel, enviandoTexto, expandido])

  const focarCampoMensagem = useCallback(() => {
    if (!expandido) return
    window.requestAnimationFrame(() => {
      campoMensagemRef.current?.focus?.({ preventScroll: true })
    })
  }, [expandido])

  useEffect(() => {
    if (expandido && !enviandoTexto) focarCampoMensagem()
  }, [enviandoTexto, expandido, focarCampoMensagem])

  const atualizarEstado = useCallback((status, detalhe = "") => {
    setEstado((atual) => ({ ...atual, status, detalhe }))
  }, [])

  const atualizarNomeMicrofone = useCallback(async (stream = null) => {
    try {
      const faixa = stream?.getAudioTracks?.()[0]
      if (faixa?.label) {
        setMicrofone(faixa.label.replace(/^Default\s*-\s*/i, ""))
        return
      }

      const dispositivos = await navigator.mediaDevices?.enumerateDevices?.()
      const entradas = Array.isArray(dispositivos)
        ? dispositivos.filter((item) => item.kind === "audioinput")
        : []
      const selecionado = entradas.find((item) => item.deviceId === microfoneSelecionadoRef.current)
      const padrao = selecionado || entradas.find((item) => item.deviceId === "default") || entradas[0]
      if (padrao?.label) setMicrofone(padrao.label.replace(/^Default\s*-\s*/i, ""))
    } catch {
      setMicrofone("Microfone padrão do Windows")
    }
  }, [])

  const escolherMicrofonePreferido = useCallback((entradas = []) => {
    const salvo = microfoneSelecionadoRef.current
    if (salvo && entradas.some((item) => item.deviceId === salvo)) return salvo

    const preferido = entradas.find((item) => /lifecam|microfone de mesa|webcam|camera|câmera/i.test(item.label || ""))
    if (preferido?.deviceId) return preferido.deviceId

    const padraoReal = entradas.find((item) => item.deviceId !== "default" && /padr[aã]o/i.test(item.label || ""))
    if (padraoReal?.deviceId) return padraoReal.deviceId

    return entradas.find((item) => item.deviceId === "default")?.deviceId || entradas[0]?.deviceId || ""
  }, [])

  const carregarMicrofones = useCallback(async ({ selecionarAutomaticamente = false } = {}) => {
    try {
      const dispositivos = await navigator.mediaDevices?.enumerateDevices?.()
      const entradas = Array.isArray(dispositivos)
        ? dispositivos.filter((item) => item.kind === "audioinput" && item.deviceId)
        : []

      setMicrofonesDisponiveis(entradas)

      if (selecionarAutomaticamente || !microfoneSelecionadoRef.current
        || !entradas.some((item) => item.deviceId === microfoneSelecionadoRef.current)) {
        const escolhido = escolherMicrofonePreferido(entradas)
        if (escolhido) {
          microfoneSelecionadoRef.current = escolhido
          setMicrofoneSelecionado(escolhido)
          localStorage.setItem(MICROPHONE_DEVICE_KEY, escolhido)
        }
        return escolhido
      }

      setMicrofoneSelecionado(microfoneSelecionadoRef.current)
      return microfoneSelecionadoRef.current
    } catch (error) {
      console.warn("[Nexa Voice] Não foi possível listar os microfones:", error)
      return microfoneSelecionadoRef.current || ""
    }
  }, [escolherMicrofonePreferido])

  const limparTrechoAtual = useCallback(() => {
    falaAtivaRef.current = false
    finalizandoTrechoRef.current = false
    duracaoTrechoRef.current = 0
    falaChunksRef.current = []
    inicioFalaRef.current = 0
    ultimaVozRef.current = 0
    framesVozRef.current = 0
    picoFalaRef.current = 0
  }, [])

  const pausarReconhecimento = useCallback(() => {
    capturaPausadaRef.current = true

    const gravador = mediaRecorderRef.current
    if (gravador?.state === "recording") {
      descartarTrechoRef.current = true
      try {
        gravador.stop()
      } catch {
        mediaRecorderRef.current = null
      }
    }

    limparTrechoAtual()
  }, [limparTrechoAtual])

  const reiniciarCapturaCompleta = useCallback(async () => {
    if (!ativadaRef.current || processandoRef.current || transcrevendoRef.current || falandoRef.current) return
    if (reiniciandoCapturaRef.current) return

    reiniciandoCapturaRef.current = true
    capturaPausadaRef.current = true

    try {
      pararCapturaRef.current?.()
      await new Promise((resolve) => setTimeout(resolve, 180))

      if (!ativadaRef.current || processandoRef.current || transcrevendoRef.current || falandoRef.current) return
      await iniciarCapturaRef.current?.(microfoneSelecionadoRef.current || null)
    } catch (error) {
      console.error("[Nexa Voice] Falha ao recriar a captura de áudio:", error)
      capturaPausadaRef.current = true
      atualizarEstado("erro", "A escuta travou e não conseguiu reiniciar o microfone.")
    } finally {
      reiniciandoCapturaRef.current = false
    }
  }, [atualizarEstado])

  const iniciarReconhecimento = useCallback(() => {
    if (!ativadaRef.current || processandoRef.current || transcrevendoRef.current || falandoRef.current) return
    if (reiniciandoCapturaRef.current) return

    const retomar = async () => {
      try {
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume()
        }

        const faixaAtiva = streamRef.current?.getAudioTracks?.().some(
          (faixa) => faixa.readyState === "live" && faixa.enabled,
        )
        const capturaSaudavel = Boolean(
          faixaAtiva
          && analyserRef.current
          && audioContextRef.current?.state !== "closed",
        )

        if (!capturaSaudavel) {
          await reiniciarCapturaCompleta()
          return
        }

        limparTrechoAtual()
        ruidoBaseRef.current = Math.max(0.004, ruidoBaseRef.current)
        calibrandoAteRef.current = performance.now() + TEMPO_CALIBRACAO_RUIDO_MS
        capturaPausadaRef.current = false
      } catch (error) {
        console.error("[Nexa Voice] Falha ao retomar a escuta:", error)
        capturaPausadaRef.current = true
        atualizarEstado("erro", "A escuta travou e não conseguiu reiniciar o microfone.")
      }
    }

    retomar()
  }, [atualizarEstado, limparTrechoAtual, reiniciarCapturaCompleta])

  const carregarVocabulario = useCallback(async () => {
    try {
      const contexto = obterContextoVoz()
      const itens = await listarVocabularioVoz(contexto.clienteId || null)
      vocabularioRef.current = itens
      setTotalVocabulario(itens.length)
      return itens
    } catch (error) {
      console.warn("[Nexa Voice] Não foi possível carregar o vocabulário:", error)
      vocabularioRef.current = []
      return []
    }
  }, [])

  const carregarClientesParaVoz = useCallback(async () => {
    const clientes = await precarregarClientesVoz()
    clientesConhecidosRef.current = Array.isArray(clientes) ? clientes : []
    return clientesConhecidosRef.current
  }, [])

  const montarPromptTranscricao = useCallback(() => {
    const termos = vocabularioRef.current
      .map((item) => item?.termoCorreto || item?.termo_correto || item?.termoOuvido || "")
      .filter(Boolean)
      .slice(0, 20)

    const nomesClientes = clientesConhecidosRef.current
      .map((cliente) => String(cliente?.nome || cliente?.razaoSocial || cliente?.nomeFantasia || "").trim())
      .filter(Boolean)
      .slice(0, 35)

    const falasRecentes = historicoRef.current
      .map((item) => {
        const autor = item?.autor === "Você" ? "Você" : "Nexa"
        const texto = String(item?.texto || "").trim()
        return texto ? `${autor}: ${texto}` : ""
      })
      .filter(Boolean)
      .slice(-4)

    const contexto = obterContextoVoz()

    return [
      "Nexa, bom dia, boa tarde, contador, contadora, contabilidade, MEI, empresário individual, sociedade limitada unipessoal, SLU, Fiscal, Financeiro, Movimentações, Pendências, Contábil, DRE, lançamentos contábeis, documentos, certificados, e-CAC, PGDAS-D, DCTFWeb, DAS, prioridades de hoje, relatório do dia, relatório para hoje, resumo de hoje, o que tenho para fazer hoje, iniciar meu dia, todas as pendências, mensagens de clientes, pedidos de ajuda, documentos aguardando análise, quem pagou hoje, pagamentos recebidos, pendências resolvidas.",
      nomesClientes.length ? `Nomes de clientes do escritório: ${nomesClientes.join(", ")}.` : "",
      contexto.clienteNome ? `Cliente atual: ${contexto.clienteNome}.` : "",
      termos.length ? `Vocabulário aprendido: ${termos.join(", ")}.` : "",
      falasRecentes.length ? `Contexto recente: ${falasRecentes.join("; ")}.` : "",
    ].filter(Boolean).join(" ").slice(0, 700)
  }, [])

  const falarComVozNeural = useCallback((texto) => new Promise(async (resolve) => {
    if (!vozNeuralDisponivelRef.current || !texto) {
      resolve(false)
      return
    }

    let url = null
    let audio = null
    let concluida = false

    const finalizar = (resultado) => {
      if (concluida) return
      concluida = true
      if (url) URL.revokeObjectURL(url)
      if (audioVozRef.current === audio) audioVozRef.current = null
      resolve(resultado)
    }

    try {
      const blob = await sintetizarVozNeural(texto)
      url = URL.createObjectURL(blob)
      audio = new Audio(url)
      audio.preload = "auto"
      audioVozRef.current = audio
      audio.onended = () => finalizar(true)
      audio.onerror = () => finalizar(false)
      setVozAtiva("Nexa — voz neural")
      await audio.play()
      setTimeout(() => finalizar(false), TEMPO_MAXIMO_FALA_MS)
    } catch (error) {
      console.warn("[Nexa Voice] Voz neural indisponível. Usando voz do Windows.", error)
      finalizar(false)
    }
  }), [])

  const falarComVozLocal = useCallback((texto) => new Promise((resolve) => {
    const sintetizador = window.speechSynthesis
    const CriadorDeFala = window.SpeechSynthesisUtterance

    if (!sintetizador || !CriadorDeFala || !texto) {
      resolve(false)
      return
    }

    const vozes = sintetizador.getVoices?.() || []
    const voz = escolherVozFeminina(vozes)
    const fala = new CriadorDeFala(texto)
    fala.lang = "pt-BR"
    fala.rate = 0.98
    fala.pitch = 1.02
    fala.volume = 1
    if (voz) fala.voice = voz
    setVozAtiva(nomeAmigavelVoz(voz))

    let concluida = false
    const finalizar = (falou = true) => {
      if (concluida) return
      concluida = true
      resolve(falou)
    }

    fala.onend = () => finalizar(true)
    fala.onerror = () => finalizar(false)
    sintetizador.cancel()
    setTimeout(() => {
      try {
        sintetizador.speak(fala)
      } catch {
        finalizar(false)
      }
    }, 90)
    setTimeout(() => finalizar(false), TEMPO_MAXIMO_FALA_MS)
  }), [])

  const falarResposta = useCallback(async (textoOriginal) => {
    const texto = limparRespostaDaNexa(textoOriginal)
    if (!texto) return false

    pausarReconhecimento()
    falandoRef.current = true
    ultimaRespostaFaladaRef.current = texto
    atualizarEstado("falando", texto)

    try {
      const neuralFalou = await falarComVozNeural(texto)
      if (neuralFalou) return true
      return await falarComVozLocal(texto)
    } finally {
      falandoRef.current = false
      // Evita que a LifeCam capture o final da própria voz da Nexa e envie
      // esse eco ao Whisper como se fosse um novo comando do usuário.
      ignorarEcoAteRef.current = performance.now() + TEMPO_BLOQUEIO_ECO_MS
    }
  }, [atualizarEstado, falarComVozLocal, falarComVozNeural, pausarReconhecimento])

  const agendarReinicio = useCallback((atraso = 450) => {
    clearTimeout(reinicioRef.current)
    reinicioRef.current = setTimeout(() => iniciarReconhecimento(), atraso)
  }, [iniciarReconhecimento])

  const voltarParaEscuta = useCallback((atraso = TEMPO_REARME_MICROFONE_MS) => {
    processandoRef.current = false

    if (sessaoAtivaRef.current) {
      modoRef.current = "session"
      atualizarEstado("conversando", "Pode falar normalmente. Diga “Obrigado” para encerrar.")
    } else {
      modoRef.current = "wake"
      atualizarEstado("aguardando", `Escutando pelo ${microfone}. Diga “Bom dia”, “Boa tarde” ou “Nexa”.`)
    }

    // O microfone permanece aberto, mas cada fala cria um MediaRecorder novo.
    // Isso garante um arquivo WebM completo, com cabeçalho válido, em todos os comandos.
    clearTimeout(reinicioRef.current)
    reinicioRef.current = setTimeout(() => iniciarReconhecimento(), atraso)
  }, [atualizarEstado, iniciarReconhecimento, microfone])

  const encerrarSessao = useCallback(async () => {
    if (processandoRef.current || falandoRef.current) return
    processandoRef.current = true
    setUltimaFala("Obrigado")
    setUltimaResposta("Por nada.")
    pausarReconhecimento()
    await falarResposta("Por nada.")
    sessaoAtivaRef.current = false
    setSessaoAtiva(false)
    selecaoClientePendenteRef.current = null
    processandoRef.current = false
    modoRef.current = "wake"
    atualizarEstado("aguardando", "Conversa encerrada. Diga “Bom dia”, “Boa tarde” ou “Nexa” quando precisar de mim.")
    agendarReinicio(650)
  }, [agendarReinicio, atualizarEstado, falarResposta, pausarReconhecimento])

  const renovarJanelaProtegida = useCallback(() => {
    clearTimeout(timeoutSessaoProtegidaRef.current)
    if (!escutaProtegidaRef.current || !sessaoAtivaRef.current) return

    timeoutSessaoProtegidaRef.current = setTimeout(() => {
      if (processandoRef.current || falandoRef.current) {
        renovarJanelaProtegida()
        return
      }
      sessaoAtivaRef.current = false
      setSessaoAtiva(false)
      modoRef.current = "wake"
      selecaoClientePendenteRef.current = null
      atualizarEstado("aguardando", "Sessão protegida encerrada. Diga “Nexa” para conversar novamente.")
    }, PROTECTED_SESSION_TIMEOUT_MS)
  }, [atualizarEstado])

  const iniciarSessao = useCallback(async (gatilho) => {
    if (processandoRef.current || falandoRef.current) return
    sessaoAtivaRef.current = true
    setSessaoAtiva(true)
    modoRef.current = "session"
    renovarJanelaProtegida()
    processandoRef.current = true

    const resposta = respostaDeAtivacao(gatilho)
    setUltimaFala(gatilho === "nexa" ? "Nexa" : gatilho.replace(/^./, (letra) => letra.toUpperCase()))
    setUltimaResposta(resposta)
    pausarReconhecimento()
    await falarResposta(resposta)
    voltarParaEscuta()
  }, [falarResposta, pausarReconhecimento, renovarJanelaProtegida, voltarParaEscuta])

  const processarComando = useCallback(async (texto, opcoes = {}) => {
    const comando = String(texto || "").trim()
    if (!comando || processandoRef.current) return
    if (opcoes.origem !== "texto") renovarJanelaProtegida()

    const origem = opcoes.origem === "texto" ? "texto" : "voz"
    const deveFalar = opcoes.falar !== false
    const idBase = Date.now()
    const pedidoDeAbrirDocumento = origem === "texto"
      && /\b(abra|abre|abrir|visualize|visualizar|veja|ver|exiba|exibir|mostre|mostrar)\b/i.test(comando)
      && /\b(document\w*|arquivo\w*|anexo\w*|pdf|imagem|foto\w*|contrato\w*|declara\w*|recibo\w*|comprovante\w*|per[ií]cia|rg|cpf|cnh|identidade|link|site|portal|carteira de trabalho|ctps|e-?cac|simples nacional|pgmei|nfs-?e|receita federal|gov\.br)\b/i.test(comando)
    const janelaDocumentoPendente = pedidoDeAbrirDocumento
      ? window.open("", "_blank")
      : null

    processandoRef.current = true
    if (origem === "texto") setEnviandoTexto(true)
    setUltimaFala(comando)
    setMensagensPainel((atual) => [
      ...atual,
      { id: `usuario-${idBase}`, autor: "Você", texto: comando, data: new Date().toISOString() },
    ].slice(-30))
    atualizarEstado("processando", comando)
    pausarReconhecimento()

    // Toda fala é interpretada pelo roteador central da API. Ele conhece as
    // páginas, os grupos, os clientes e o contexto atual. Assim, a navegação
    // não depende de uma lista rígida de frases no navegador.

    const contextoSalvoAtual = obterContextoVoz()
    const contexto = contextoClienteRef.current?.clienteId
      ? { ...contextoSalvoAtual, ...contextoClienteRef.current }
      : contextoSalvoAtual
    const selecaoClientePendente = selecaoClientePendenteRef.current
    const cancelarSelecaoCliente = Boolean(
      selecaoClientePendente && CANCELAR_SELECAO_CLIENTE_PATTERN.test(comando),
    )
    const clienteEscolhido = selecaoClientePendente && !cancelarSelecaoCliente
      ? resolverEscolhaClientePendente(comando, selecaoClientePendente)
      : null

    try {
      const resposta = await conversarComNexa({
        mensagem: comando,
        clienteId: contexto.clienteId || null,
        conversaId: conversaIdRef.current || contexto.conversaId || null,
        tipoContexto: contexto.clienteId ? "cliente" : "geral",
        historico: historicoRef.current,
        origem,
        paginaAtual: page || "",
        selecaoClientePendente,
        selecaoClienteId: clienteEscolhido?.id || null,
        cancelarSelecaoCliente,
      })

      if (resposta.conversaId) {
        conversaIdRef.current = resposta.conversaId
        registrarConversaVoz(resposta.conversaId)
        setHistoricoSalvo(Boolean(resposta.historicoSalvo ?? true))
      }

      if (resposta.clienteIdConfirmado) {
        registrarClienteVoz({
          id: resposta.clienteIdConfirmado,
          nome: resposta.clienteNomeConfirmado
            || resposta.consulta?.itens?.find(
              (item) => String(item?.clienteId) === String(resposta.clienteIdConfirmado),
            )?.cliente
            || "",
        })
      }

      const textoResposta = limparRespostaDaNexa(resposta.resposta || "Comando concluído.")
      const temFalaEspecifica = Object.prototype.hasOwnProperty.call(resposta, "fala")
      const textoFalado = temFalaEspecifica
        ? limparRespostaDaNexa(resposta.fala, resposta.acao ? "Pronto." : textoResposta)
        : textoResposta
      setUltimaResposta(textoResposta)
      setMensagensPainel((atual) => [
        ...atual,
        {
          id: `nexa-${idBase}`,
          autor: "Nexa",
          texto: textoResposta,
          data: resposta.respondidoEm || new Date().toISOString(),
          acaoExecutada: false,
          acaoDocumento: resposta.acao?.tipo === "abrir-url"
            ? {
                tipo: "abrir-url",
                url: resposta.acao.url,
                titulo: resposta.acao.titulo || "Abrir link",
                segura: true,
              }
            : null,
          documentosDrive: resposta.consulta?.tipo === "lista-documentos-drive"
            ? (resposta.consulta.itens || []).filter((arquivo) => arquivo?.url)
            : [],
        },
      ].slice(-30))

      if (resposta.selecaoClientePendente) {
        selecaoClientePendenteRef.current = resposta.selecaoClientePendente
      } else if (
        resposta.selecaoClienteConcluida
        || resposta.selecaoClienteCancelada
        || (selecaoClientePendente && resposta.acao)
      ) {
        selecaoClientePendenteRef.current = null
      }

      if (resposta.vocabularioSugestao) {
        sugestaoVocabularioRef.current = resposta.vocabularioSugestao
        if (deveFalar) await falarResposta(textoResposta)
        setEnviandoTexto(false)
        if (ativadaRef.current) voltarParaEscuta()
        else {
          processandoRef.current = false
          atualizarEstado("pausada", "Escuta contínua pausada.")
        }
        return
      }

      if (resposta.vocabularioAprendido) await carregarVocabulario()

      historicoRef.current = [
        ...historicoRef.current,
        { autor: "Você", texto: comando },
        { autor: "Nexa", texto: textoResposta },
      ].slice(-12)

      const acaoConfirmacaoCliente = !resposta.acao && resposta.clienteIdConfirmado
        ? {
            tipo: "navegar",
            pagina: "Clientes",
            alvo: "central-cliente",
            secao: "",
            segura: true,
            cliente: {
              id: resposta.clienteIdConfirmado,
              nome: resposta.clienteNomeConfirmado || "",
            },
          }
        : null
      if (resposta.acao?.tipo === "abrir-url" && janelaDocumentoPendente) {
        resposta.acao.janelaPendente = janelaDocumentoPendente
      } else if (janelaDocumentoPendente && !janelaDocumentoPendente.closed) {
        janelaDocumentoPendente.close()
      }
      const acaoExecutada = executarAcaoDeVoz({ acao: resposta.acao || acaoConfirmacaoCliente, setPage })
      if (resposta.acao) {
        setMensagensPainel((atual) => atual.map((item) => (
          item.id === `nexa-${idBase}`
            ? { ...item, acaoExecutada, aberturaBloqueada: resposta.acao.tipo === "abrir-url" && !acaoExecutada }
            : item
        )))
      }
      if (acaoExecutada && origem === "voz") tocarSinal(690, 55)
      if (deveFalar && textoFalado) await falarResposta(textoFalado)

      setEnviandoTexto(false)
      if (ativadaRef.current) {
        voltarParaEscuta(acaoExecutada ? TEMPO_REARME_COMANDO_DIRETO_MS : undefined)
      } else {
        processandoRef.current = false
        atualizarEstado("pausada", "Escuta contínua pausada.")
      }
    } catch (error) {
      if (janelaDocumentoPendente && !janelaDocumentoPendente.closed) janelaDocumentoPendente.close()
      console.error("[Nexa Voice] Falha ao processar comando:", error)
      const detalheErro = error.response?.data?.message || error.message || "Não consegui processar o comando."
      const mensagem = /(groq|ollama|rate limit|tokens?|localhost:11434|service tier|console\.groq|api[_ -]?key)/i.test(detalheErro)
        ? "A conversa geral está temporariamente indisponível. As consultas e navegações da Nexa continuam funcionando normalmente."
        : detalheErro
      setUltimaResposta(mensagem)
      setMensagensPainel((atual) => [
        ...atual,
        { id: `erro-${idBase}`, autor: "Nexa", texto: mensagem, data: new Date().toISOString(), erro: true },
      ].slice(-30))
      setEnviandoTexto(false)
      processandoRef.current = false
      atualizarEstado("erro", mensagem)
      if (ativadaRef.current) agendarReinicio(1800)
    }
  }, [agendarReinicio, atualizarEstado, carregarVocabulario, falarResposta, page, pausarReconhecimento, renovarJanelaProtegida, setPage, voltarParaEscuta])

  const enviarMensagemDigitada = useCallback(async () => {
    const texto = String(mensagemDigitada || "").trim()
    if (!texto || enviandoTexto || processandoRef.current) return

    setMensagemDigitada("")
    await processarComando(texto, {
      origem: "texto",
      falar: respostasFaladasAtivasRef.current,
    })
    focarCampoMensagem()
  }, [enviandoTexto, focarCampoMensagem, mensagemDigitada, processarComando])

  const confirmarSugestaoVocabulario = useCallback(async (texto) => {
    const sugestao = sugestaoVocabularioRef.current
    if (!sugestao) return false

    if (CONFIRMACAO_NAO_PATTERN.test(texto)) {
      sugestaoVocabularioRef.current = null
      processandoRef.current = true
      setUltimaFala(texto)
      setUltimaResposta("Certo. Diga o nome correto.")
      await falarResposta("Certo. Diga o nome correto.")
      voltarParaEscuta()
      return true
    }

    if (!CONFIRMACAO_SIM_PATTERN.test(texto)) return false

    processandoRef.current = true
    setUltimaFala(texto)
    atualizarEstado("processando", "Aprendendo a nova palavra...")

    try {
      await aprenderVocabularioVoz({
        termoOuvido: sugestao.termoOuvido,
        termoCorreto: sugestao.termoCorreto,
        clienteId: null,
        origem: "confirmacao_voz",
      })
      sugestaoVocabularioRef.current = null
      setUltimaResposta(`Entendido. Vou reconhecer ${sugestao.termoOuvido} como ${sugestao.termoCorreto}.`)
      await carregarVocabulario()
      await falarResposta("Entendido.")
      processandoRef.current = false
      await processarComando(sugestao.comandoCorrigido)
    } catch (error) {
      console.error("[Nexa Voice] Falha ao aprender termo:", error)
      sugestaoVocabularioRef.current = null
      setUltimaResposta("Não consegui salvar essa palavra agora.")
      processandoRef.current = false
      await falarResposta("Não consegui salvar essa palavra agora.")
      voltarParaEscuta()
    }

    return true
  }, [atualizarEstado, carregarVocabulario, falarResposta, processarComando, voltarParaEscuta])

  useEffect(() => {
    tratarTranscricaoRef.current = (transcricao, metadados = {}) => {
      const texto = String(transcricao || "").trim()
      if (!texto || processandoRef.current || falandoRef.current) return

      if (!falaTemQualidadeMinima(texto, metadados)) {
        console.info("[Nexa Voice] Transcrição descartada por áudio fraco:", texto, metadados)
        voltarParaEscuta()
        return
      }

      if (escutaProtegidaRef.current && !falaPassaEscutaProtegida(texto, metadados)) {
        console.info("[Nexa Voice] Áudio ambiente descartado pela escuta protegida:", texto, metadados)
        voltarParaEscuta()
        return
      }

      if (TRANSCRICOES_RUIDO_PATTERN.test(texto)) {
        console.info("[Nexa Voice] Frase curta sem comando descartada:", texto)
        voltarParaEscuta()
        return
      }

      const dentroDaJanelaDeEco = performance.now() < ignorarEcoAteRef.current
      if (dentroDaJanelaDeEco && transcricaoPareceEco(texto, ultimaRespostaFaladaRef.current)) {
        console.info("[Nexa Voice] Eco da própria resposta ignorado:", texto)
        voltarParaEscuta()
        return
      }

      if (sessaoAtivaRef.current || modoRef.current === "session") {
        if (sugestaoVocabularioRef.current) {
          confirmarSugestaoVocabulario(texto).then((tratada) => {
            if (!tratada) {
              sugestaoVocabularioRef.current = null
              processarComando(texto)
            }
          })
          return
        }

        if (END_SESSION_PATTERN.test(texto)) {
          if (encerramentoTemVozConfiavel(metadados)) {
            encerrarSessao()
          } else {
            console.info("[Nexa Voice] Encerramento descartado por falta de voz confiável.", metadados)
            voltarParaEscuta()
          }
          return
        }

        const semWakeWord = texto.match(WAKE_WORD_PATTERN)?.[1]?.trim() || texto
        processarComando(semWakeWord)
        return
      }

      const ativacao = extrairAtivacao(texto)
      if (!ativacao) return

      sessaoAtivaRef.current = true
      setSessaoAtiva(true)
      modoRef.current = "session"
      renovarJanelaProtegida()
      tocarSinal(720, 90)

      if (ativacao.comando) {
        processarComando(ativacao.comando)
        return
      }

      iniciarSessao(ativacao.gatilho)
    }
  }, [confirmarSugestaoVocabulario, encerrarSessao, iniciarSessao, processarComando, renovarJanelaProtegida, voltarParaEscuta])

  const transcreverTrecho = useCallback(async (blob, metadados = {}) => {
    if (!blob?.size || blob.size < TAMANHO_MINIMO_AUDIO || transcrevendoRef.current) {
      voltarParaEscuta()
      return
    }

    transcrevendoRef.current = true
    pausarReconhecimento()
    atualizarEstado("transcrevendo", "Entendendo sua fala...")

    try {
      const resultado = await transcreverVozGroq(blob, { prompt: montarPromptTranscricao() })
      const texto = String(resultado.texto || "").trim()
      if (texto) {
        console.info("[Nexa Voice] Transcrição recebida:", texto)
        tratarTranscricaoRef.current?.(texto, metadados)
      }
    } catch (error) {
      console.error("[Nexa Voice] Falha na transcrição:", error)
      const mensagem = error.response?.data?.message || error.message || "Não consegui entender a fala."
      atualizarEstado("erro", mensagem)
    } finally {
      transcrevendoRef.current = false
      setTimeout(() => {
        if (!processandoRef.current && !falandoRef.current) {
          voltarParaEscuta()
        }
      }, 60)
    }
  }, [atualizarEstado, montarPromptTranscricao, pausarReconhecimento, voltarParaEscuta])

  const finalizarTrechoDeFala = useCallback(() => {
    if (!falaAtivaRef.current || finalizandoTrechoRef.current) return

    const gravador = mediaRecorderRef.current
    const duracao = performance.now() - inicioFalaRef.current
    duracaoTrechoRef.current = duracao
    finalizandoTrechoRef.current = true
    capturaPausadaRef.current = true

    if (!gravador || gravador.state !== "recording") {
      limparTrechoAtual()
      voltarParaEscuta()
      return
    }

    try {
      gravador.stop()
    } catch (error) {
      console.error("[Nexa Voice] Não foi possível finalizar o trecho:", error)
      mediaRecorderRef.current = null
      limparTrechoAtual()
      voltarParaEscuta()
    }
  }, [limparTrechoAtual, voltarParaEscuta])

  const pararCapturaAudio = useCallback(() => {
    clearTimeout(reinicioRef.current)
    if (animacaoRef.current) cancelAnimationFrame(animacaoRef.current)
    animacaoRef.current = null

    const gravador = mediaRecorderRef.current
    if (gravador?.state === "recording") {
      descartarTrechoRef.current = true
      try {
        gravador.stop()
      } catch {
        // Sem ação.
      }
    }
    mediaRecorderRef.current = null

    streamRef.current?.getTracks?.().forEach((faixa) => faixa.stop())
    streamRef.current = null

    try {
      audioContextRef.current?.close?.()
    } catch {
      // Sem ação.
    }
    audioContextRef.current = null
    analyserRef.current = null
    limparTrechoAtual()
  }, [limparTrechoAtual])

  const iniciarCapturaAudio = useCallback(async (deviceIdForcado = null) => {
    if (streamRef.current || !ativadaRef.current) return
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error("Este dispositivo não oferece gravação de áudio compatível.")
    }
    if (!transcricaoDisponivelRef.current) {
      throw new Error("A transcrição Groq Whisper não está disponível na API.")
    }

    window.nexaDesktop?.nativeVoice?.stop?.().catch?.(() => {})

    let deviceId = deviceIdForcado || microfoneSelecionadoRef.current
    if (!deviceId) deviceId = await carregarMicrofones({ selecionarAutomaticamente: true })

    const criarRestricoes = (id) => ({
      audio: {
        ...(id && id !== "default" ? { deviceId: { exact: id } } : {}),
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    })

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia(criarRestricoes(deviceId))
    } catch (error) {
      if (!deviceId || error?.name !== "OverconstrainedError") throw error
      localStorage.removeItem(MICROPHONE_DEVICE_KEY)
      microfoneSelecionadoRef.current = ""
      setMicrofoneSelecionado("")
      stream = await navigator.mediaDevices.getUserMedia(criarRestricoes(null))
    }

    streamRef.current = stream
    await atualizarNomeMicrofone(stream)
    await carregarMicrofones()

    const AudioContext = window.AudioContext || window.webkitAudioContext
    const contexto = new AudioContext()
    if (contexto.state === "suspended") await contexto.resume()
    const analisador = contexto.createAnalyser()
    analisador.fftSize = 1024
    analisador.smoothingTimeConstant = 0.28
    const fonte = contexto.createMediaStreamSource(stream)
    fonte.connect(analisador)
    audioContextRef.current = contexto
    analyserRef.current = analisador

    const iniciarGravadorDaFala = () => {
      if (mediaRecorderRef.current?.state === "recording") return true

      const tipo = mimeGravacaoDisponivel()
      const gravador = tipo ? new MediaRecorder(stream, { mimeType: tipo }) : new MediaRecorder(stream)
      mediaRecorderRef.current = gravador
      falaChunksRef.current = []
      descartarTrechoRef.current = false
      finalizandoTrechoRef.current = false
      duracaoTrechoRef.current = 0

      gravador.ondataavailable = (evento) => {
        if (evento.data?.size) falaChunksRef.current.push(evento.data)
      }

      gravador.onerror = (evento) => {
        console.error("[Nexa Voice] Falha no gravador:", evento?.error || evento)
        mediaRecorderRef.current = null
        limparTrechoAtual()
        atualizarEstado("erro", "O gravador do microfone apresentou uma falha.")
        agendarReinicio(900)
      }

      gravador.onstop = () => {
        const descartar = descartarTrechoRef.current
        const partes = [...falaChunksRef.current]
        const duracao = duracaoTrechoRef.current || (performance.now() - inicioFalaRef.current)
        const mime = gravador.mimeType || tipo || "audio/webm"
        const metadados = {
          duracao,
          pico: picoFalaRef.current,
          ruido: ruidoBaseRef.current,
        }

        mediaRecorderRef.current = null
        descartarTrechoRef.current = false
        limparTrechoAtual()

        if (descartar) return
        if (duracao < DURACAO_MINIMA_FALA_MS || !partes.length) {
          voltarParaEscuta()
          return
        }

        const blob = new Blob(partes, { type: mime })
        transcreverTrecho(blob, metadados)
      }

      try {
        // Um gravador novo por fala garante que todo arquivo tenha cabeçalho WebM válido.
        gravador.start()
        return true
      } catch (error) {
        console.error("[Nexa Voice] Não foi possível iniciar a gravação da fala:", error)
        mediaRecorderRef.current = null
        limparTrechoAtual()
        atualizarEstado("erro", "Não consegui iniciar a gravação do comando.")
        agendarReinicio(900)
        return false
      }
    }

    capturaPausadaRef.current = false
    ruidoBaseRef.current = 0.006
    calibrandoAteRef.current = performance.now() + TEMPO_CALIBRACAO_RUIDO_MS

    const amostras = new Float32Array(analisador.fftSize)
    const analisar = () => {
      if (!streamRef.current || !analyserRef.current) return
      analisador.getFloatTimeDomainData(amostras)
      const rms = calcularRms(amostras)
      const agora = performance.now()

      if (!capturaPausadaRef.current && !processandoRef.current && !transcrevendoRef.current && !falandoRef.current
        && agora >= ignorarEcoAteRef.current) {
        if (!falaAtivaRef.current && agora < calibrandoAteRef.current) {
          ruidoBaseRef.current = (ruidoBaseRef.current * 0.82) + (rms * 0.18)
          framesVozRef.current = 0
        } else if (!falaAtivaRef.current) {
          const limiteInicio = Math.max(0.011, ruidoBaseRef.current * 2.55)

          if (rms < limiteInicio * 0.88) {
            ruidoBaseRef.current = (ruidoBaseRef.current * 0.97) + (rms * 0.03)
          }

          if (rms > limiteInicio) framesVozRef.current += 1
          else framesVozRef.current = 0

          if (framesVozRef.current >= 2 && iniciarGravadorDaFala()) {
            falaAtivaRef.current = true
            inicioFalaRef.current = agora
            ultimaVozRef.current = agora
            picoFalaRef.current = rms
            atualizarEstado("ouvindo", "Fala detectada. Finalizando ao perceber o silêncio...")
          }
        } else {
          picoFalaRef.current = Math.max(rms, picoFalaRef.current * 0.997)
          const limiteContinuidade = Math.max(
            0.009,
            ruidoBaseRef.current * 1.7,
            picoFalaRef.current * 0.20,
          )

          if (rms > limiteContinuidade) ultimaVozRef.current = agora

          const duracao = agora - inicioFalaRef.current
          const silencio = agora - ultimaVozRef.current
          if ((silencio >= SILENCIO_PARA_FINALIZAR_MS && duracao >= DURACAO_MINIMA_FALA_MS)
            || duracao >= DURACAO_MAXIMA_FALA_MS) {
            finalizarTrechoDeFala()
          }
        }
      }

      animacaoRef.current = requestAnimationFrame(analisar)
    }

    animacaoRef.current = requestAnimationFrame(analisar)

    if (sessaoAtivaRef.current) {
      modoRef.current = "session"
      atualizarEstado("conversando", "Pode falar normalmente. Diga “Obrigado” para encerrar.")
    } else {
      modoRef.current = "wake"
      atualizarEstado("aguardando", `Escutando pelo ${microfone}. Diga “Bom dia”, “Boa tarde” ou “Nexa”.`)
    }
  }, [
    agendarReinicio,
    atualizarEstado,
    atualizarNomeMicrofone,
    carregarMicrofones,
    finalizarTrechoDeFala,
    limparTrechoAtual,
    microfone,
    transcreverTrecho,
    voltarParaEscuta,
  ])

  useEffect(() => {
    iniciarCapturaRef.current = iniciarCapturaAudio
    pararCapturaRef.current = pararCapturaAudio
  }, [iniciarCapturaAudio, pararCapturaAudio])

  useEffect(() => {
    if (!estado.ativada) return undefined

    const vigilante = setInterval(() => {
      if (!ativadaRef.current || processandoRef.current || transcrevendoRef.current || falandoRef.current) return

      const gravadorFalhouDuranteFala = falaAtivaRef.current
        && mediaRecorderRef.current?.state !== "recording"
      const contextoSuspenso = audioContextRef.current?.state === "suspended"
      const faixaInativa = !streamRef.current?.getAudioTracks?.().some(
        (faixa) => faixa.readyState === "live" && faixa.enabled,
      )

      if (capturaPausadaRef.current || gravadorFalhouDuranteFala || contextoSuspenso || faixaInativa) {
        iniciarReconhecimento()
      }
    }, 1200)

    return () => clearInterval(vigilante)
  }, [estado.ativada, iniciarReconhecimento])

  useEffect(() => {
    let ativo = true
    verificarVozNeural().then((status) => {
      if (!ativo) return
      vozNeuralDisponivelRef.current = Boolean(status.neuralDisponivel)
      vozNeuralNomeRef.current = status.vozNeural || "pt-BR-FranciscaNeural"
      transcricaoDisponivelRef.current = Boolean(status.transcricaoDisponivel)
      setTranscricaoAtiva(status.transcricaoDisponivel
        ? `Groq Whisper — ${status.transcricaoModelo || "whisper-large-v3-turbo"}`
        : "Groq Whisper indisponível")

      if (status.neuralDisponivel) {
        setVozAtiva("Nexa — voz neural")
      } else {
        const voz = escolherVozFeminina(window.speechSynthesis?.getVoices?.() || [])
        setVozAtiva(nomeAmigavelVoz(voz))
      }

      if (ativadaRef.current) {
        iniciarCapturaAudio().catch((error) => {
          atualizarEstado("erro", error?.message || "Não consegui iniciar o microfone.")
        })
      }
    })

    return () => { ativo = false }
  }, [atualizarEstado, iniciarCapturaAudio])

  useEffect(() => {
    const sintetizador = window.speechSynthesis
    if (!sintetizador) return undefined
    const carregarVozes = () => {
      const voz = escolherVozFeminina(sintetizador.getVoices?.() || [])
      if (!vozNeuralDisponivelRef.current) setVozAtiva(nomeAmigavelVoz(voz))
    }
    carregarVozes()
    sintetizador.addEventListener?.("voiceschanged", carregarVozes)
    return () => sintetizador.removeEventListener?.("voiceschanged", carregarVozes)
  }, [])

  useEffect(() => {
    ativadaRef.current = estado.ativada
    localStorage.setItem(VOICE_ENABLED_KEY, String(estado.ativada))

    if (estado.ativada) {
      if (transcricaoDisponivelRef.current) {
        iniciarCapturaAudio().catch((error) => {
          console.error("[Nexa Voice] Falha ao iniciar captura:", error)
          atualizarEstado("erro", error?.message || "Não consegui acessar o microfone.")
        })
      }
      return
    }

    processandoRef.current = false
    transcrevendoRef.current = false
    falandoRef.current = false
    capturaPausadaRef.current = true
    sessaoAtivaRef.current = false
    setSessaoAtiva(false)
    selecaoClientePendenteRef.current = null
    window.speechSynthesis?.cancel?.()
    modoRef.current = "wake"
    pararCapturaAudio()
  }, [atualizarEstado, estado.ativada, iniciarCapturaAudio, pararCapturaAudio])

  useEffect(() => {
    const aoMudarDispositivo = () => {
      carregarMicrofones().then(() => atualizarNomeMicrofone())
    }
    navigator.mediaDevices?.addEventListener?.("devicechange", aoMudarDispositivo)
    carregarMicrofones()
    if (estado.ativada) {
      carregarVocabulario()
      carregarClientesParaVoz()
    }
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", aoMudarDispositivo)
  }, [atualizarNomeMicrofone, carregarClientesParaVoz, carregarMicrofones, carregarVocabulario, estado.ativada])

  useEffect(() => () => {
    clearTimeout(reinicioRef.current)
    clearTimeout(timeoutSessaoProtegidaRef.current)
    pararCapturaAudio()
    window.speechSynthesis?.cancel?.()
    try {
      audioVozRef.current?.pause?.()
    } catch {
      // Sem ação.
    }
  }, [pararCapturaAudio])

  async function ativarVoz() {
    try {
      if (!transcricaoDisponivelRef.current) {
        const status = await verificarVozNeural()
        transcricaoDisponivelRef.current = Boolean(status.transcricaoDisponivel)
        if (!transcricaoDisponivelRef.current) throw new Error("A transcrição Groq Whisper não está disponível na API.")
      }

      ativadaRef.current = true
      sessaoAtivaRef.current = false
      setSessaoAtiva(false)
      selecaoClientePendenteRef.current = null
      modoRef.current = "wake"
      setEstado({ ativada: true, status: "iniciando", detalhe: "Preparando microfone e Groq Whisper..." })
      await Promise.all([carregarVocabulario(), carregarClientesParaVoz()])
      await iniciarCapturaAudio()
    } catch (error) {
      console.error("[Nexa Voice] Não foi possível ativar:", error)
      ativadaRef.current = false
      setEstado({
        ativada: false,
        status: "erro",
        detalhe: error?.message || "Não consegui acessar o microfone. Libere a permissão e tente novamente.",
      })
    }
  }

  async function trocarMicrofone(evento) {
    const novoDeviceId = evento.target.value
    if (!novoDeviceId || novoDeviceId === microfoneSelecionadoRef.current) return

    microfoneSelecionadoRef.current = novoDeviceId
    setMicrofoneSelecionado(novoDeviceId)
    localStorage.setItem(MICROPHONE_DEVICE_KEY, novoDeviceId)

    const item = microfonesDisponiveis.find((entrada) => entrada.deviceId === novoDeviceId)
    if (item?.label) setMicrofone(item.label.replace(/^Default\s*-\s*/i, ""))

    if (!estado.ativada) return

    atualizarEstado("iniciando", "Trocando o microfone...")
    pararCapturaAudio()
    await new Promise((resolve) => setTimeout(resolve, 180))

    try {
      await iniciarCapturaAudio(novoDeviceId)
    } catch (error) {
      console.error("[Nexa Voice] Não foi possível trocar o microfone:", error)
      atualizarEstado("erro", error?.message || "Não consegui usar o microfone selecionado.")
    }
  }

  function pausarOuRetomar() {
    if (estado.ativada) {
      setEstado({ ativada: false, status: "pausada", detalhe: "Escuta contínua pausada." })
      return
    }
    ativarVoz()
  }

  if (!usuario || usuario.perfil === "Cliente") return null

  return (
    <aside
      ref={containerFlutuanteRef}
      style={{
        ...styles.container,
        ...(expandido ? styles.containerExpanded : {}),
        ...(isMobile ? styles.containerMobile : {}),
        ...(posicaoFlutuante ? {
          left: `${posicaoFlutuante.x}px`,
          top: `${posicaoFlutuante.y}px`,
          right: "auto",
          bottom: "auto",
        } : {}),
      }}
      aria-live="polite"
    >
      <button
        type="button"
        style={styles.header}
        onPointerDown={iniciarArrasteFlutuante}
        onPointerMove={moverFlutuante}
        onPointerUp={finalizarArrasteFlutuante}
        onPointerCancel={finalizarArrasteFlutuante}
        title="Clique para abrir ou arraste para reposicionar"
      >
        <span style={{ ...styles.dot, ...(estado.ativada ? styles.dotActive : styles.dotPaused) }} />
        <span style={styles.headerText}>
          <strong>Nexa</strong>
          <small>{nomeStatus(estado.status)}</small>
        </span>
        <span style={styles.chevron}>{expandido ? "−" : "+"}</span>
      </button>

      {expandido && (
        <div style={{ ...styles.content, ...(isMobile ? styles.contentMobile : {}) }}>
          <div style={styles.quickActions}>
            <button
              type="button"
              style={styles.openFull}
              onClick={() => setPage?.("Conversa com a Nexa")}
            >
              Abrir conversa completa
            </button>
            <button
              type="button"
              style={{ ...styles.voiceToggle, ...(estado.ativada ? styles.voiceToggleActive : {}) }}
              onClick={pausarOuRetomar}
              title={estado.ativada ? "Pausar a escuta da Nexa" : "Ativar a escuta da Nexa"}
            >
              {estado.ativada ? "Microfone ativo" : "Ativar microfone"}
            </button>
            <button
              type="button"
              style={{
                ...styles.spokenResponsesToggle,
                ...(respostasFaladasAtivas ? styles.spokenResponsesToggleActive : {}),
              }}
              onClick={() => setRespostasFaladasAtivas((ativa) => !ativa)}
              title={respostasFaladasAtivas
                ? "Desligar a voz nas respostas digitadas"
                : "Fazer a Nexa falar as respostas digitadas"}
              aria-pressed={respostasFaladasAtivas}
            >
              {respostasFaladasAtivas ? "🔊 Voz ligada" : "🔇 Voz desligada"}
            </button>
          </div>

          <button
            type="button"
            style={{ ...styles.protectedToggle, ...(escutaProtegida ? styles.protectedToggleActive : {}) }}
            onClick={() => setEscutaProtegida((ativa) => !ativa)}
            aria-pressed={escutaProtegida}
            title="Reduz comandos captados de música, televisão e conversas ao fundo"
          >
            {escutaProtegida ? "🛡️ Escuta protegida ativa" : "🛡️ Ativar escuta protegida"}
          </button>

          <section style={styles.chatPanel} aria-label="Conversa rápida com a Nexa">
            {!mensagensPainel.length && (
              <div style={styles.welcomeMessage}>
                <strong>Nexa</strong>
                <p>Digite uma pergunta ou um comando. Posso consultar prioridades e abrir telas sem sair de onde você está.</p>
              </div>
            )}

            {mensagensPainel.map((item) => (
              <article
                key={item.id}
                style={{
                  ...styles.chatMessage,
                  ...(item.autor === "Você" ? styles.chatMessageUser : styles.chatMessageNexa),
                  ...(item.erro ? styles.chatMessageError : {}),
                }}
              >
                <div style={styles.chatMessageHeader}>
                  <strong>{item.autor}</strong>
                  <span>{formatarHorarioPainel(item.data)}</span>
                </div>
                <p style={styles.chatMessageText}>{item.texto}</p>
                {!!item.documentosDrive?.length && (
                  <div style={styles.driveFileList}>
                    {item.documentosDrive.map((arquivo) => (
                      <a
                        key={arquivo.id || arquivo.url}
                        href={arquivo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.driveFileLink}
                        title={`Abrir ${arquivo.titulo || "documento"} no Google Drive`}
                      >
                        <span aria-hidden="true">📄</span>
                        <span>{arquivo.titulo || "Documento"}</span>
                      </a>
                    ))}
                  </div>
                )}
                {item.acaoExecutada && <small style={styles.actionDone}>Pronto.</small>}
                {item.acaoDocumento && !item.acaoExecutada && (
                  <div style={styles.documentFallback}>
                    {item.aberturaBloqueada && (
                      <small style={styles.documentFallbackText}>
                        O navegador bloqueou a nova guia.
                      </small>
                    )}
                    <a
                      href={item.acaoDocumento.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.openDocumentButton}
                    >
                      Abrir {item.acaoDocumento.titulo || "link"}
                    </a>
                  </div>
                )}
              </article>
            ))}

            {enviandoTexto && <div style={styles.typingText}>A Nexa está pensando...</div>}
            <div ref={fimPainelRef} />
          </section>

          <div style={styles.composer}>
            <textarea
              ref={campoMensagemRef}
              value={mensagemDigitada}
              onChange={(evento) => setMensagemDigitada(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" && !evento.shiftKey) {
                  evento.preventDefault()
                  enviarMensagemDigitada()
                }
              }}
              placeholder="Digite para a Nexa..."
              rows={2}
              style={styles.composerInput}
              readOnly={enviandoTexto}
              aria-busy={enviandoTexto}
            />
            <button
              type="button"
              style={{ ...styles.sendButton, ...(!mensagemDigitada.trim() || enviandoTexto ? styles.sendButtonDisabled : {}) }}
              onClick={enviarMensagemDigitada}
              disabled={!mensagemDigitada.trim() || enviandoTexto}
            >
              {enviandoTexto ? "..." : "Enviar"}
            </button>
          </div>

          <div style={styles.statusRow}>
            <span>{historicoSalvo ? "Histórico salvo" : "Nova conversa"}</span>
            <span>{respostasFaladasAtivas ? "Respostas faladas" : "Respostas em texto"}</span>
            <span>{escutaProtegida ? "Ambiente filtrado" : "Escuta padrão"}</span>
            <span>{sessaoAtiva ? "Conversa por voz aberta" : estado.ativada ? "Aguardando chamada" : "Microfone pausado"}</span>
          </div>

          <details style={styles.voiceDetails}>
            <summary style={styles.voiceSummary}>Configurações de voz</summary>
            <div style={styles.voiceDetailsContent}>
              <p style={styles.detail}>{estado.detalhe}</p>
              <label style={styles.microphone}>
                <span>Entrada</span>
                <select
                  value={microfoneSelecionado}
                  onChange={trocarMicrofone}
                  style={styles.microphoneSelect}
                  aria-label="Selecionar microfone da Nexa Voice"
                >
                  {!microfonesDisponiveis.length && <option value="">{microfone}</option>}
                  {microfonesDisponiveis.map((entrada, indice) => (
                    <option key={entrada.deviceId} value={entrada.deviceId}>
                      {entrada.label || `Microfone ${indice + 1}`}
                    </option>
                  ))}
                </select>
                <small style={styles.microphoneCurrent}>Em uso: {microfone}</small>
              </label>
              <div style={styles.microphone}><span>Transcrição</span><strong>{transcricaoAtiva}</strong></div>
              <div style={styles.microphone}><span>Voz</span><strong>{vozAtiva}</strong></div>
              <div style={styles.vocabulary}>Memória de conversa ativa · vocabulário: {totalVocabulario} termos aprendidos</div>
              {historicoSalvo && <div style={styles.memoryBadge}>Histórico desta conversa salvo na Nexa</div>}
              {sessaoAtiva && <div style={styles.sessionBadge}>Conversa aberta — diga “Obrigado” para encerrar</div>}
              {ultimaFala && <div style={styles.last}><span>Você</span><p>{ultimaFala}</p></div>}
              {ultimaResposta && <div style={styles.last}><span>Nexa</span><p>{ultimaResposta}</p></div>}
              <small style={styles.help}>
                Abra a conversa dizendo “Bom dia”, “Boa tarde” ou “Nexa”. Diga “Obrigado” para encerrar.
              </small>
            </div>
          </details>
        </div>
      )}
    </aside>
  )

}

function formatarHorarioPainel(data) {
  if (!data) return ""
  return new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const styles = {
  container: {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: 9999,
    width: "250px",
    color: "#f4fbff",
    background: "rgba(3,22,52,.97)",
    border: "1px solid rgba(0,190,255,.34)",
    borderRadius: "16px",
    boxShadow: "0 18px 45px rgba(0,0,0,.42)",
    overflow: "hidden",
    backdropFilter: "blur(12px)",
  },
  containerExpanded: { width: "410px", maxWidth: "calc(100vw - 36px)" },
  containerMobile: { right: "10px", bottom: "10px", width: "calc(100vw - 20px)", maxWidth: "calc(100vw - 20px)" },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "linear-gradient(135deg,rgba(0,168,255,.17),rgba(46,255,120,.09))",
    color: "inherit",
    border: 0,
    padding: "12px 14px",
    cursor: "grab",
    touchAction: "none",
    userSelect: "none",
    textAlign: "left",
  },
  dot: { width: "11px", height: "11px", borderRadius: "50%", flex: "0 0 auto" },
  dotActive: { background: "#37ff74", boxShadow: "0 0 12px rgba(55,255,116,.85)" },
  dotPaused: { background: "#ffbd59", boxShadow: "0 0 10px rgba(255,189,89,.55)" },
  headerText: { display: "flex", flexDirection: "column", gap: "2px", flex: 1 },
  chevron: { fontSize: "20px", color: "#8bd7ff" },
  content: { padding: "12px", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "78vh", overflowY: "auto" },
  contentMobile: { maxHeight: "76vh" },
  quickActions: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: "8px" },
  openFull: { background: "rgba(0,168,255,.11)", color: "#a9ddff", border: "1px solid rgba(0,168,255,.28)", borderRadius: "9px", padding: "9px 10px", cursor: "pointer", fontWeight: 700, fontSize: "11px" },
  voiceToggle: { background: "rgba(255,184,77,.10)", color: "#ffd298", border: "1px solid rgba(255,184,77,.28)", borderRadius: "9px", padding: "9px 10px", cursor: "pointer", fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap" },
  voiceToggleActive: { background: "rgba(55,255,116,.10)", color: "#aaffc5", borderColor: "rgba(55,255,116,.28)" },
  spokenResponsesToggle: { background: "rgba(255,255,255,.055)", color: "#b9cbe0", border: "1px solid rgba(255,255,255,.13)", borderRadius: "9px", padding: "9px 10px", cursor: "pointer", fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap" },
  spokenResponsesToggleActive: { background: "rgba(0,168,255,.14)", color: "#bfe8ff", borderColor: "rgba(0,168,255,.38)" },
  protectedToggle: { width: "100%", background: "rgba(255,255,255,.045)", color: "#a9b8cc", border: "1px solid rgba(255,255,255,.12)", borderRadius: "9px", padding: "9px 11px", cursor: "pointer", fontWeight: 750, fontSize: "11px", textAlign: "left" },
  protectedToggleActive: { background: "rgba(55,255,116,.09)", color: "#aaffc5", borderColor: "rgba(55,255,116,.28)" },
  chatPanel: { minHeight: "190px", maxHeight: "290px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", padding: "10px", background: "rgba(1,13,34,.66)", border: "1px solid rgba(255,255,255,.09)", borderRadius: "13px" },
  welcomeMessage: { alignSelf: "flex-start", maxWidth: "90%", background: "rgba(0,168,255,.09)", border: "1px solid rgba(0,168,255,.20)", borderRadius: "12px", padding: "11px", color: "#d9edff" },
  chatMessage: { maxWidth: "88%", padding: "9px 10px", borderRadius: "12px", border: "1px solid rgba(255,255,255,.09)", overflowWrap: "anywhere" },
  chatMessageUser: { alignSelf: "flex-end", background: "#07539a" },
  chatMessageNexa: { alignSelf: "flex-start", background: "#082b5d" },
  chatMessageError: { borderColor: "rgba(255,95,101,.46)", background: "rgba(104,23,35,.72)" },
  chatMessageHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", color: "#a9bdd3", fontSize: "10px" },
  chatMessageText: { margin: "6px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: "12px" },
  driveFileList: { display: "flex", flexDirection: "column", gap: "5px", marginTop: "9px", maxHeight: "260px", overflowY: "auto", paddingRight: "3px" },
  driveFileLink: { display: "flex", alignItems: "flex-start", gap: "7px", border: "1px solid rgba(139,215,255,.22)", borderRadius: "8px", padding: "7px 9px", background: "rgba(0,168,255,.08)", color: "#d9edff", fontSize: "11px", lineHeight: 1.35, textDecoration: "none", overflowWrap: "anywhere" },
  actionDone: { display: "block", marginTop: "7px", color: "#9effbc", fontWeight: 700 },
  documentFallback: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px", marginTop: "8px" },
  documentFallbackText: { color: "#ffd298", lineHeight: 1.35 },
  openDocumentButton: { display: "inline-block", border: "1px solid rgba(139,215,255,.36)", borderRadius: "8px", padding: "7px 10px", background: "rgba(0,168,255,.16)", color: "#d9edff", fontWeight: 800, cursor: "pointer", fontSize: "11px", textDecoration: "none" },
  typingText: { color: "#8bd7ff", fontSize: "11px", fontStyle: "italic" },
  composer: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "8px", alignItems: "stretch" },
  composerInput: { width: "100%", boxSizing: "border-box", resize: "none", minHeight: "58px", maxHeight: "110px", background: "#071f43", color: "#f4fbff", border: "1px solid rgba(139,215,255,.22)", borderRadius: "11px", padding: "10px 11px", outline: "none", fontFamily: "inherit", fontSize: "12px", lineHeight: 1.4 },
  sendButton: { border: 0, borderRadius: "11px", padding: "0 15px", background: "linear-gradient(135deg,#00a8ff,#2eff78)", color: "#001b34", fontWeight: 800, cursor: "pointer" },
  sendButtonDisabled: { opacity: .48, cursor: "not-allowed" },
  statusRow: { display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", color: "#8fa9c3", fontSize: "10px" },
  voiceDetails: { background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", padding: "8px 10px" },
  voiceSummary: { cursor: "pointer", color: "#a9ddff", fontSize: "11px", fontWeight: 700 },
  voiceDetailsContent: { paddingTop: "10px", display: "flex", flexDirection: "column", gap: "9px" },
  detail: { margin: 0, color: "#b9cbe0", fontSize: "11px", lineHeight: 1.45 },
  microphone: { display: "flex", flexDirection: "column", gap: "5px", padding: "9px", background: "rgba(255,255,255,.05)", borderRadius: "9px", fontSize: "11px" },
  microphoneSelect: { width: "100%", minWidth: 0, padding: "7px 8px", borderRadius: "7px", border: "1px solid rgba(139,215,255,.24)", background: "#0b284b", color: "#f4fbff", fontSize: "11px", outline: "none" },
  microphoneCurrent: { color: "#8fb0cf", lineHeight: 1.3 },
  vocabulary: { fontSize: "11px", color: "#9ee7c2", marginTop: "-3px" },
  memoryBadge: { padding: "7px 9px", borderRadius: "9px", background: "rgba(0,168,255,.08)", border: "1px solid rgba(0,168,255,.20)", color: "#a9ddff", fontSize: "11px", fontWeight: 700 },
  sessionBadge: { padding: "8px 9px", borderRadius: "9px", background: "rgba(55,255,116,.09)", border: "1px solid rgba(55,255,116,.22)", color: "#aaffc5", fontSize: "11px", fontWeight: 700 },
  last: { padding: "9px", background: "rgba(0,168,255,.08)", border: "1px solid rgba(0,168,255,.17)", borderRadius: "9px" },
  help: { color: "#849ab5", lineHeight: 1.4 },
}
