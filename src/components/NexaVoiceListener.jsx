import { useCallback, useEffect, useRef, useState } from "react"
import { conversarComNexa } from "../services/conversaNexaService"
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
  registrarConversaVoz,
} from "../services/nexaVoiceService"

const VOICE_ENABLED_KEY = "nexaVoiceEnabled"
const MICROPHONE_DEVICE_KEY = "nexaVoiceMicrophoneDeviceId"
const WAKE_WORD_PATTERN = /^\s*(?:(?:ei|ola|olá)\s+)?(?:nexa|néxa|neksa|nexta|nessa)\b[\s,.:;-]*(.*)$/i
const GREETING_PATTERN = /^\s*(bom\s+dia|boa\s+tarde)\b[\s,.:;-]*(.*)$/i
const END_SESSION_PATTERN = /^\s*(?:muito\s+)?obrigad[oa][.!?]*\s*$/i
const CONFIRMACAO_SIM_PATTERN = /^\s*(?:sim|isso|correto|exatamente|essa mesma|esse mesmo|pode ser|é esse|e esse|é essa|e essa)[.!?]*\s*$/i
const CONFIRMACAO_NAO_PATTERN = /^\s*(?:não|nao|negativo|não é|nao e|outro|outra)[.!?]*\s*$/i
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
  { pagina: "DRE Gerencial", aliases: ["dre gerencial", "demonstracao do resultado", "dre"] },
  { pagina: "Documentos Digitais", aliases: ["documentos digitais", "documentos"] },
  { pagina: "Pendências Clientes", aliases: ["pendencias dos clientes", "pendencias clientes", "pendencias"] },
  { pagina: "Acesso Rápido Fiscal", aliases: ["acesso rapido fiscal", "atalhos fiscais"] },
  { pagina: "WhatsApp Inteligente", aliases: ["whatsapp inteligente", "whatsapp"] },
  { pagina: "Assistente do Dia", aliases: ["assistente do dia", "prioridades do dia"] },
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

  const encontrado = candidatos.find(({ alias }) => texto === alias || (temVerbo && texto.includes(alias)))
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
  const [microfone, setMicrofone] = useState("Microfone padrão do Windows")
  const [microfonesDisponiveis, setMicrofonesDisponiveis] = useState([])
  const [microfoneSelecionado, setMicrofoneSelecionado] = useState(() => localStorage.getItem(MICROPHONE_DEVICE_KEY) || "")
  const [vozAtiva, setVozAtiva] = useState("Procurando voz feminina...")
  const [transcricaoAtiva, setTranscricaoAtiva] = useState("Groq Whisper")
  const [expandido, setExpandido] = useState(false)
  const [totalVocabulario, setTotalVocabulario] = useState(0)

  const ativadaRef = useRef(estado.ativada)
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
  const vozNeuralDisponivelRef = useRef(false)
  const vozNeuralNomeRef = useRef("pt-BR-FranciscaNeural")
  const transcricaoDisponivelRef = useRef(false)
  const audioVozRef = useRef(null)
  const ultimaRespostaFaladaRef = useRef("")
  const ignorarEcoAteRef = useRef(0)

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

  const montarPromptTranscricao = useCallback(() => {
    const termos = vocabularioRef.current
      .map((item) => item?.termoCorreto || item?.termo_correto || item?.termoOuvido || "")
      .filter(Boolean)
      .slice(0, 20)

    return [
      "Nexa, bom dia, boa tarde, Multicópias, Fiscal, Movimentações, Contábil, DRE, lançamentos contábeis, e-CAC, PGDAS-D, DCTFWeb, DAS.",
      termos.length ? `Vocabulário do escritório: ${termos.join(", ")}.` : "",
    ].filter(Boolean).join(" ")
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
      setVozAtiva(`Voz neural — ${vozNeuralNomeRef.current}`)
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
    processandoRef.current = false
    modoRef.current = "wake"
    atualizarEstado("aguardando", "Conversa encerrada. Diga “Bom dia”, “Boa tarde” ou “Nexa” quando precisar de mim.")
    agendarReinicio(650)
  }, [agendarReinicio, atualizarEstado, falarResposta, pausarReconhecimento])

  const iniciarSessao = useCallback(async (gatilho) => {
    if (processandoRef.current || falandoRef.current) return
    sessaoAtivaRef.current = true
    setSessaoAtiva(true)
    modoRef.current = "session"
    processandoRef.current = true

    const resposta = respostaDeAtivacao(gatilho)
    setUltimaFala(gatilho === "nexa" ? "Nexa" : gatilho.replace(/^./, (letra) => letra.toUpperCase()))
    setUltimaResposta(resposta)
    pausarReconhecimento()
    await falarResposta(resposta)
    voltarParaEscuta()
  }, [falarResposta, pausarReconhecimento, voltarParaEscuta])

  const processarComando = useCallback(async (texto) => {
    const comando = String(texto || "").trim()
    if (!comando || processandoRef.current) return

    processandoRef.current = true
    setUltimaFala(comando)
    atualizarEstado("processando", comando)
    pausarReconhecimento()

    // Toda fala é interpretada pelo roteador central da API. Ele conhece as
    // páginas, os grupos, os clientes e o contexto atual. Assim, a navegação
    // não depende de uma lista rígida de frases no navegador.

    const contexto = obterContextoVoz()

    try {
      const resposta = await conversarComNexa({
        mensagem: comando,
        clienteId: contexto.clienteId || null,
        conversaId: conversaIdRef.current || contexto.conversaId || null,
        tipoContexto: contexto.clienteId ? "cliente" : "geral",
        historico: historicoRef.current,
        origem: "voz",
        paginaAtual: page || "",
      })

      if (resposta.conversaId) {
        conversaIdRef.current = resposta.conversaId
        registrarConversaVoz(resposta.conversaId)
      }

      const textoResposta = limparRespostaDaNexa(resposta.resposta || "Comando concluído.")
      const temFalaEspecifica = Object.prototype.hasOwnProperty.call(resposta, "fala")
      const textoFalado = temFalaEspecifica ? limparRespostaDaNexa(resposta.fala, "") : textoResposta
      setUltimaResposta(textoResposta)

      if (resposta.vocabularioSugestao) {
        sugestaoVocabularioRef.current = resposta.vocabularioSugestao
        await falarResposta(textoResposta)
        voltarParaEscuta()
        return
      }

      if (resposta.vocabularioAprendido) await carregarVocabulario()

      historicoRef.current = [
        ...historicoRef.current,
        { autor: "Você", texto: comando },
        { autor: "Nexa", texto: textoResposta },
      ].slice(-12)

      const acaoExecutada = executarAcaoDeVoz({ acao: resposta.acao, setPage })
      if (acaoExecutada) tocarSinal(690, 55)
      if (textoFalado) await falarResposta(textoFalado)
      voltarParaEscuta(acaoExecutada ? TEMPO_REARME_COMANDO_DIRETO_MS : undefined)
    } catch (error) {
      console.error("[Nexa Voice] Falha ao processar comando:", error)
      const mensagem = error.response?.data?.message || error.message || "Não consegui processar o comando."
      setUltimaResposta(mensagem)
      processandoRef.current = false
      atualizarEstado("erro", mensagem)
      agendarReinicio(1800)
    }
  }, [agendarReinicio, atualizarEstado, carregarVocabulario, falarResposta, page, pausarReconhecimento, setPage, voltarParaEscuta])

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
      tocarSinal(720, 90)

      if (ativacao.comando) {
        processarComando(ativacao.comando)
        return
      }

      iniciarSessao(ativacao.gatilho)
    }
  }, [confirmarSugestaoVocabulario, encerrarSessao, iniciarSessao, processarComando, voltarParaEscuta])

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
        setVozAtiva(status.provedor === "microsoft-edge"
          ? "Microsoft Edge Neural — Francisca"
          : `Voz neural — ${vozNeuralNomeRef.current}`)
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
      precarregarClientesVoz()
    }
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", aoMudarDispositivo)
  }, [atualizarNomeMicrofone, carregarMicrofones, carregarVocabulario, estado.ativada])

  useEffect(() => () => {
    clearTimeout(reinicioRef.current)
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
      modoRef.current = "wake"
      setEstado({ ativada: true, status: "iniciando", detalhe: "Preparando microfone e Groq Whisper..." })
      await Promise.all([carregarVocabulario(), precarregarClientesVoz()])
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
    <aside style={{ ...styles.container, ...(expandido ? styles.containerExpanded : {}) }} aria-live="polite">
      <button type="button" style={styles.header} onClick={() => setExpandido((valor) => !valor)}>
        <span style={{ ...styles.dot, ...(estado.ativada ? styles.dotActive : styles.dotPaused) }} />
        <span style={styles.headerText}>
          <strong>Nexa Voice</strong>
          <small>{nomeStatus(estado.status)}</small>
        </span>
        <span style={styles.chevron}>{expandido ? "−" : "+"}</span>
      </button>

      {expandido && (
        <div style={styles.content}>
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
          <div style={styles.vocabulary}>Vocabulário adaptativo ativo · {totalVocabulario} termos aprendidos</div>
          {sessaoAtiva && <div style={styles.sessionBadge}>Conversa aberta — diga “Obrigado” para encerrar</div>}
          {ultimaFala && <div style={styles.last}><span>Você</span><p>{ultimaFala}</p></div>}
          {ultimaResposta && <div style={styles.last}><span>Nexa</span><p>{ultimaResposta}</p></div>}
          <button type="button" style={{ ...styles.control, ...(estado.ativada ? styles.controlPause : styles.controlStart) }} onClick={pausarOuRetomar}>
            {estado.ativada ? "Pausar escuta" : "Ativar uma vez"}
          </button>
          <small style={styles.help}>
            Abra a conversa dizendo “Bom dia”, “Boa tarde” ou “Nexa”. O áudio é enviado à Groq somente quando a fala é detectada. Diga “Obrigado” para encerrar.
          </small>
        </div>
      )}
    </aside>
  )
}

const styles = {
  container: {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: 9999,
    width: "250px",
    color: "#f4fbff",
    background: "rgba(3,22,52,.96)",
    border: "1px solid rgba(0,190,255,.34)",
    borderRadius: "16px",
    boxShadow: "0 18px 45px rgba(0,0,0,.38)",
    overflow: "hidden",
    backdropFilter: "blur(12px)",
  },
  containerExpanded: { width: "320px" },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "linear-gradient(135deg,rgba(0,168,255,.16),rgba(46,255,120,.08))",
    color: "inherit",
    border: 0,
    padding: "12px 14px",
    cursor: "pointer",
    textAlign: "left",
  },
  dot: { width: "11px", height: "11px", borderRadius: "50%", flex: "0 0 auto" },
  dotActive: { background: "#37ff74", boxShadow: "0 0 12px rgba(55,255,116,.85)" },
  dotPaused: { background: "#ffbd59", boxShadow: "0 0 10px rgba(255,189,89,.55)" },
  headerText: { display: "flex", flexDirection: "column", gap: "2px", flex: 1 },
  chevron: { fontSize: "20px", color: "#8bd7ff" },
  content: { padding: "13px", display: "flex", flexDirection: "column", gap: "10px" },
  detail: { margin: 0, color: "#b9cbe0", fontSize: "12px", lineHeight: 1.45 },
  microphone: { display: "flex", flexDirection: "column", gap: "5px", padding: "9px", background: "rgba(255,255,255,.05)", borderRadius: "9px", fontSize: "11px" },
  microphoneSelect: { width: "100%", minWidth: 0, padding: "7px 8px", borderRadius: "7px", border: "1px solid rgba(139,215,255,.24)", background: "#0b284b", color: "#f4fbff", fontSize: "11px", outline: "none" },
  microphoneCurrent: { color: "#8fb0cf", lineHeight: 1.3 },
  vocabulary: { fontSize: "11px", color: "#9ee7c2", marginTop: "-3px" },
  sessionBadge: { padding: "8px 9px", borderRadius: "9px", background: "rgba(55,255,116,.09)", border: "1px solid rgba(55,255,116,.22)", color: "#aaffc5", fontSize: "11px", fontWeight: 700 },
  last: { padding: "9px", background: "rgba(0,168,255,.08)", border: "1px solid rgba(0,168,255,.17)", borderRadius: "9px" },
  control: { border: 0, borderRadius: "10px", padding: "10px 12px", fontWeight: "bold", cursor: "pointer" },
  controlStart: { background: "linear-gradient(135deg,#00a8ff,#2eff78)", color: "#001b34" },
  controlPause: { background: "rgba(255,184,77,.13)", color: "#ffd298", border: "1px solid rgba(255,184,77,.30)" },
  help: { color: "#849ab5", lineHeight: 1.4 },
}
