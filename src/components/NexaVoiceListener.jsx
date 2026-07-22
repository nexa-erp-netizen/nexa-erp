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
  registrarConversaVoz,
} from "../services/nexaVoiceService"

const VOICE_ENABLED_KEY = "nexaVoiceEnabled"
const MICROPHONE_DEVICE_KEY = "nexaVoiceMicrophoneDeviceId"
const WAKE_WORD_PATTERN = /^\s*(?:(?:ei|ola|olá)\s+)?(?:nexa|néxa|neksa|nexta|nessa)\b[\s,.:;-]*(.*)$/i
const GREETING_PATTERN = /^\s*(bom\s+dia|boa\s+tarde)\b[\s,.:;-]*(.*)$/i
const END_SESSION_PATTERN = /^\s*(?:muito\s+)?obrigad[oa](?:\s+por\s+.+)?[.!?]*\s*$/i
const CONFIRMACAO_SIM_PATTERN = /^\s*(?:sim|isso|correto|exatamente|essa mesma|esse mesmo|pode ser|é esse|e esse|é essa|e essa)[.!?]*\s*$/i
const CONFIRMACAO_NAO_PATTERN = /^\s*(?:não|nao|negativo|não é|nao e|outro|outra)[.!?]*\s*$/i
const TEMPO_MAXIMO_FALA_MS = 30000

const INTERVALO_GRAVACAO_MS = 200
const PRE_ROLL_MAXIMO = 5
const SILENCIO_PARA_FINALIZAR_MS = 950
const DURACAO_MINIMA_FALA_MS = 420
const DURACAO_MAXIMA_FALA_MS = 14000
const TAMANHO_MINIMO_AUDIO = 1200

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

export default function NexaVoiceListener({ usuario, setPage }) {
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

  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const animacaoRef = useRef(null)
  const preRollRef = useRef([])
  const falaChunksRef = useRef([])
  const falaAtivaRef = useRef(false)
  const inicioFalaRef = useRef(0)
  const ultimaVozRef = useRef(0)
  const framesVozRef = useRef(0)
  const ruidoBaseRef = useRef(0.006)
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
    falaChunksRef.current = []
    preRollRef.current = []
    inicioFalaRef.current = 0
    ultimaVozRef.current = 0
    framesVozRef.current = 0
  }, [])

  const pausarReconhecimento = useCallback(() => {
    // Mantém o microfone aberto, mas ignora os blocos enquanto a Nexa fala
    // ou processa. O MediaRecorder será recriado antes da próxima fala para
    // que cada áudio enviado ao Whisper comece com um cabeçalho WebM válido.
    capturaPausadaRef.current = true
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
        const gravadorAtivo = mediaRecorderRef.current?.state === "recording"
        const capturaSaudavel = Boolean(
          faixaAtiva
          && gravadorAtivo
          && analyserRef.current
          && audioContextRef.current?.state !== "closed",
        )

        if (!capturaSaudavel) {
          await reiniciarCapturaCompleta()
          return
        }

        limparTrechoAtual()
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
      "Nexa, bom dia, boa tarde, obrigado, Multicópias, Fiscal, Movimentações, Contábil, DRE, lançamentos contábeis, e-CAC, PGDAS-D, DCTFWeb, DAS.",
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
    atualizarEstado("falando", texto)

    try {
      const neuralFalou = await falarComVozNeural(texto)
      if (neuralFalou) return true
      return await falarComVozLocal(texto)
    } finally {
      falandoRef.current = false
    }
  }, [atualizarEstado, falarComVozLocal, falarComVozNeural, pausarReconhecimento])

  const agendarReinicio = useCallback((atraso = 450) => {
    clearTimeout(reinicioRef.current)
    reinicioRef.current = setTimeout(() => iniciarReconhecimento(), atraso)
  }, [iniciarReconhecimento])

  const voltarParaEscuta = useCallback(() => {
    processandoRef.current = false

    if (sessaoAtivaRef.current) {
      modoRef.current = "session"
      atualizarEstado("conversando", "Pode falar normalmente. Diga “Obrigado” para encerrar.")
    } else {
      modoRef.current = "wake"
      atualizarEstado("aguardando", `Escutando pelo ${microfone}. Diga “Bom dia”, “Boa tarde” ou “Nexa”.`)
    }

    // Cada frase precisa começar em um novo MediaRecorder. Reaproveitar o
    // gravador anterior faz o segundo arquivo WebM ficar sem cabeçalho e o
    // Whisper deixa de reconhecer os comandos depois da saudação.
    clearTimeout(reinicioRef.current)
    reinicioRef.current = setTimeout(() => {
      reiniciarCapturaCompleta()
    }, 220)
  }, [atualizarEstado, microfone, reiniciarCapturaCompleta])

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
    const contexto = obterContextoVoz()

    try {
      const resposta = await conversarComNexa({
        mensagem: comando,
        clienteId: contexto.clienteId || null,
        conversaId: conversaIdRef.current || contexto.conversaId || null,
        tipoContexto: contexto.clienteId ? "cliente" : "geral",
        historico: historicoRef.current,
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

      executarAcaoDeVoz({ acao: resposta.acao, setPage })
      if (textoFalado) await falarResposta(textoFalado)
      voltarParaEscuta()
    } catch (error) {
      console.error("[Nexa Voice] Falha ao processar comando:", error)
      const mensagem = error.response?.data?.message || error.message || "Não consegui processar o comando."
      setUltimaResposta(mensagem)
      processandoRef.current = false
      atualizarEstado("erro", mensagem)
      agendarReinicio(1800)
    }
  }, [agendarReinicio, atualizarEstado, carregarVocabulario, falarResposta, pausarReconhecimento, setPage, voltarParaEscuta])

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
    tratarTranscricaoRef.current = (transcricao) => {
      const texto = String(transcricao || "").trim()
      if (!texto || processandoRef.current || falandoRef.current) return

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
          encerrarSessao()
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
  }, [confirmarSugestaoVocabulario, encerrarSessao, iniciarSessao, processarComando])

  const transcreverTrecho = useCallback(async (blob) => {
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
      if (texto) tratarTranscricaoRef.current?.(texto)
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
      }, 120)
    }
  }, [atualizarEstado, montarPromptTranscricao, pausarReconhecimento, voltarParaEscuta])

  const finalizarTrechoDeFala = useCallback(() => {
    if (!falaAtivaRef.current) return
    const duracao = performance.now() - inicioFalaRef.current
    const partes = [...falaChunksRef.current]
    const tipo = mediaRecorderRef.current?.mimeType || "audio/webm"
    limparTrechoAtual()

    if (duracao < DURACAO_MINIMA_FALA_MS || !partes.length) {
      voltarParaEscuta()
      return
    }
    const blob = new Blob(partes, { type: tipo })
    transcreverTrecho(blob)
  }, [limparTrechoAtual, transcreverTrecho, voltarParaEscuta])

  const pararCapturaAudio = useCallback(() => {
    clearTimeout(reinicioRef.current)
    if (animacaoRef.current) cancelAnimationFrame(animacaoRef.current)
    animacaoRef.current = null

    try {
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current.stop()
    } catch {
      // Sem ação.
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
    analisador.smoothingTimeConstant = 0.35
    const fonte = contexto.createMediaStreamSource(stream)
    fonte.connect(analisador)
    audioContextRef.current = contexto
    analyserRef.current = analisador

    const tipo = mimeGravacaoDisponivel()
    const gravador = tipo ? new MediaRecorder(stream, { mimeType: tipo }) : new MediaRecorder(stream)
    mediaRecorderRef.current = gravador

    gravador.ondataavailable = (evento) => {
      if (!evento.data?.size || capturaPausadaRef.current) return
      if (falaAtivaRef.current) {
        falaChunksRef.current.push(evento.data)
        return
      }
      preRollRef.current.push(evento.data)
      if (preRollRef.current.length > PRE_ROLL_MAXIMO) preRollRef.current.shift()
    }

    gravador.onerror = (evento) => {
      console.error("[Nexa Voice] Falha no gravador:", evento?.error || evento)
      atualizarEstado("erro", "O gravador do microfone apresentou uma falha.")
    }

    gravador.start(INTERVALO_GRAVACAO_MS)
    capturaPausadaRef.current = false
    ruidoBaseRef.current = 0.006

    const amostras = new Float32Array(analisador.fftSize)
    const analisar = () => {
      if (!streamRef.current || !analyserRef.current) return
      analisador.getFloatTimeDomainData(amostras)
      const rms = calcularRms(amostras)
      const agora = performance.now()

      if (!capturaPausadaRef.current && !processandoRef.current && !transcrevendoRef.current && !falandoRef.current) {
        if (!falaAtivaRef.current && rms < 0.035) {
          ruidoBaseRef.current = (ruidoBaseRef.current * 0.96) + (rms * 0.04)
        }

        const limite = Math.max(0.014, ruidoBaseRef.current * 2.8)
        const temVoz = rms > limite

        if (temVoz) {
          framesVozRef.current += 1
          ultimaVozRef.current = agora
        } else {
          framesVozRef.current = 0
        }

        if (!falaAtivaRef.current && framesVozRef.current >= 3) {
          falaAtivaRef.current = true
          inicioFalaRef.current = agora
          ultimaVozRef.current = agora
          falaChunksRef.current = [...preRollRef.current]
          preRollRef.current = []
          atualizarEstado("ouvindo", "Pode falar...")
        }

        if (falaAtivaRef.current) {
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
    capturaPausadaRef.current = false

    if (sessaoAtivaRef.current) {
      modoRef.current = "session"
      atualizarEstado("conversando", "Pode falar normalmente. Diga “Obrigado” para encerrar.")
    } else {
      modoRef.current = "wake"
      atualizarEstado("aguardando", `Escutando pelo ${microfone}. Diga “Bom dia”, “Boa tarde” ou “Nexa”.`)
    }
  }, [atualizarEstado, atualizarNomeMicrofone, carregarMicrofones, finalizarTrechoDeFala, microfone])

  useEffect(() => {
    iniciarCapturaRef.current = iniciarCapturaAudio
    pararCapturaRef.current = pararCapturaAudio
  }, [iniciarCapturaAudio, pararCapturaAudio])

  useEffect(() => {
    if (!estado.ativada) return undefined

    const vigilante = setInterval(() => {
      if (!ativadaRef.current || processandoRef.current || transcrevendoRef.current || falandoRef.current) return

      const gravadorParado = !mediaRecorderRef.current
        || mediaRecorderRef.current.state === "inactive"
        || mediaRecorderRef.current.state === "paused"
      const contextoSuspenso = audioContextRef.current?.state === "suspended"
      const faixaInativa = !streamRef.current?.getAudioTracks?.().some(
        (faixa) => faixa.readyState === "live" && faixa.enabled,
      )

      if (capturaPausadaRef.current || gravadorParado || contextoSuspenso || faixaInativa) {
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
    if (estado.ativada) carregarVocabulario()
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
      await carregarVocabulario()
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
