import { useCallback, useEffect, useRef, useState } from "react"
import { conversarComNexa } from "../services/conversaNexaService"
import { sintetizarVozNeural, verificarVozNeural } from "../services/nexaVoiceTtsService"
import {
  aprenderVocabularioVoz,
  executarAcaoDeVoz,
  listarVocabularioVoz,
  obterContextoVoz,
  registrarConversaVoz,
} from "../services/nexaVoiceService"

const VOICE_ENABLED_KEY = "nexaVoiceEnabled"
const WAKE_WORD_PATTERN = /^\s*(?:(?:ei|ola|olá)\s+)?(?:nexa|néxa|neksa|nexta)\b[\s,.:;-]*(.*)$/i
const GREETING_PATTERN = /^\s*(bom\s+dia|boa\s+tarde)\b[\s,.:;-]*(.*)$/i
const END_SESSION_PATTERN = /^\s*(?:muito\s+)?obrigad[oa](?:\s+por\s+.+)?[.!?]*\s*$/i
const CONFIRMACAO_SIM_PATTERN = /^\s*(?:sim|isso|correto|exatamente|essa mesma|esse mesmo|pode ser|é esse|e esse|é essa|e essa)[.!?]*\s*$/i
const CONFIRMACAO_NAO_PATTERN = /^\s*(?:não|nao|negativo|não é|nao e|outro|outra)[.!?]*\s*$/i
const TEMPO_MAXIMO_FALA_MS = 30000

function limparRespostaDaNexa(valor) {
  const texto = String(valor || "").trim()
  if (!texto) return "Comando concluído."

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
      ? "Preparando o microfone..."
      : "Ative uma vez para usar a Nexa sem tocar no microfone.",
  }
}

function nomeStatus(status) {
  if (status === "aguardando") return "Aguardando chamada"
  if (status === "conversando") return "Conversa ativa"
  if (status === "ouvindo") return "Ouvindo"
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
    // O sinal sonoro é apenas um auxílio. A voz continua funcionando sem ele.
  }
}

function obterReconhecimento() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function pontuarVozLocal(voz) {
  const nome = String(voz?.name || "").toLowerCase()
  const idioma = String(voz?.lang || "").replace("_", "-").toLowerCase()
  if (!idioma.startsWith("pt")) return -1000

  let pontos = idioma === "pt-br" ? 100 : 40
  if (nome.includes("microsoft maria")) pontos += 1000
  else if (nome.includes("maria")) pontos += 850
  if (nome.includes("natural")) pontos += 220
  if (nome.includes("online")) pontos += 80
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
    return {
      gatilho: "nexa",
      comando: String(wake[1] || "").trim(),
    }
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
  if (gatilho === "bom dia") return "Bom dia. Estou ouvindo."
  if (gatilho === "boa tarde") return "Boa tarde. Estou ouvindo."
  return "Estou ouvindo."
}

export default function NexaVoiceListener({ usuario, setPage }) {
  const [estado, setEstado] = useState(criarEstadoInicial)
  const [sessaoAtiva, setSessaoAtiva] = useState(false)
  const [ultimaFala, setUltimaFala] = useState("")
  const [ultimaResposta, setUltimaResposta] = useState("")
  const [microfone, setMicrofone] = useState("Microfone padrão do Windows")
  const [vozAtiva, setVozAtiva] = useState("Procurando Microsoft Maria...")
  const [expandido, setExpandido] = useState(false)
  const [totalVocabulario, setTotalVocabulario] = useState(0)

  const reconhecimentoRef = useRef(null)
  const ativadaRef = useRef(estado.ativada)
  const sessaoAtivaRef = useRef(false)
  const modoRef = useRef("wake")
  const processandoRef = useRef(false)
  const falandoRef = useRef(false)
  const reinicioRef = useRef(null)
  const conversaIdRef = useRef(obterContextoVoz().conversaId || null)
  const historicoRef = useRef([])
  const tratarTranscricaoRef = useRef(null)
  const sugestaoVocabularioRef = useRef(null)
  const vozNeuralDisponivelRef = useRef(false)
  const vozNeuralNomeRef = useRef("pt-BR-FranciscaNeural")
  const audioVozRef = useRef(null)

  const atualizarEstado = useCallback((status, detalhe = "") => {
    setEstado((atual) => ({ ...atual, status, detalhe }))
  }, [])

  const atualizarNomeMicrofone = useCallback(async () => {
    try {
      const dispositivos = await navigator.mediaDevices?.enumerateDevices?.()
      const entradas = Array.isArray(dispositivos)
        ? dispositivos.filter((item) => item.kind === "audioinput")
        : []
      const padrao = entradas.find((item) => item.deviceId === "default") || entradas[0]
      if (padrao?.label) setMicrofone(padrao.label.replace(/^Default\s*-\s*/i, ""))
    } catch {
      setMicrofone("Microfone padrão do Windows")
    }
  }, [])

  const carregarVocabulario = useCallback(async () => {
    try {
      const contexto = obterContextoVoz()
      const itens = await listarVocabularioVoz(contexto.clienteId || null)
      setTotalVocabulario(itens.length)
      return itens
    } catch (error) {
      console.warn("[Nexa Voice] Não foi possível carregar o vocabulário:", error)
      return []
    }
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
      console.warn("[Nexa Voice] Voz neural indisponível. Usando Microsoft Maria.", error)
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
    fala.rate = 0.94
    fala.pitch = 1
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

    try {
      reconhecimentoRef.current?.abort()
    } catch {
      // O reconhecimento pode já estar encerrado.
    }

    falandoRef.current = true
    atualizarEstado("falando", texto)

    try {
      const neuralFalou = await falarComVozNeural(texto)
      if (neuralFalou) return true
      return await falarComVozLocal(texto)
    } finally {
      falandoRef.current = false
    }
  }, [atualizarEstado, falarComVozLocal, falarComVozNeural])

  const agendarReinicio = useCallback((atraso = 450) => {
    clearTimeout(reinicioRef.current)
    reinicioRef.current = setTimeout(() => {
      if (!ativadaRef.current || processandoRef.current || falandoRef.current) return
      try {
        reconhecimentoRef.current?.start()
      } catch {
        // start() lança erro quando o reconhecimento já está ativo.
      }
    }, atraso)
  }, [])

  const voltarParaEscuta = useCallback(() => {
    processandoRef.current = false

    if (sessaoAtivaRef.current) {
      modoRef.current = "session"
      atualizarEstado(
        "conversando",
        `Conversa aberta pelo ${microfone}. Pode falar normalmente; diga “Obrigado” para encerrar.`,
      )
    } else {
      modoRef.current = "wake"
      atualizarEstado(
        "aguardando",
        `Escutando pelo ${microfone}. Diga “Bom dia”, “Boa tarde” ou “Nexa”.`,
      )
    }

    agendarReinicio(500)
  }, [agendarReinicio, atualizarEstado, microfone])

  const encerrarSessao = useCallback(async () => {
    if (processandoRef.current || falandoRef.current) return

    processandoRef.current = true
    setUltimaFala("Obrigado")
    setUltimaResposta("Por nada.")

    try {
      reconhecimentoRef.current?.abort()
    } catch {
      // Sem ação.
    }

    await falarResposta("Por nada.")
    sessaoAtivaRef.current = false
    setSessaoAtiva(false)
    processandoRef.current = false
    modoRef.current = "wake"
    atualizarEstado(
      "aguardando",
      `Conversa encerrada. Diga “Bom dia”, “Boa tarde” ou “Nexa” quando precisar de mim.`,
    )
    agendarReinicio(550)
  }, [agendarReinicio, atualizarEstado, falarResposta])

  const iniciarSessao = useCallback(async (gatilho) => {
    if (processandoRef.current || falandoRef.current) return

    sessaoAtivaRef.current = true
    setSessaoAtiva(true)
    modoRef.current = "session"
    processandoRef.current = true

    const resposta = respostaDeAtivacao(gatilho)
    setUltimaFala(gatilho === "nexa" ? "Nexa" : gatilho.replace(/^./, (letra) => letra.toUpperCase()))
    setUltimaResposta(resposta)

    try {
      reconhecimentoRef.current?.abort()
    } catch {
      // Sem ação.
    }

    await falarResposta(resposta)
    voltarParaEscuta()
  }, [falarResposta, voltarParaEscuta])

  const processarComando = useCallback(async (texto) => {
    const comando = String(texto || "").trim()
    if (!comando || processandoRef.current) return

    processandoRef.current = true
    setUltimaFala(comando)
    atualizarEstado("processando", comando)

    try {
      reconhecimentoRef.current?.abort()
    } catch {
      // Sem ação: o reconhecimento pode já ter sido encerrado pelo navegador.
    }

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
      await falarResposta(textoResposta)
      voltarParaEscuta()
    } catch (error) {
      console.error("[Nexa Voice] Falha ao processar comando:", error)
      const mensagem = error.response?.data?.message || error.message || "Não consegui processar o comando."
      setUltimaResposta(mensagem)
      processandoRef.current = false
      atualizarEstado("erro", mensagem)
      agendarReinicio(1800)
    }
  }, [agendarReinicio, atualizarEstado, carregarVocabulario, falarResposta, setPage, voltarParaEscuta])

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

  useEffect(() => {
    const Reconhecimento = obterReconhecimento()
    if (!Reconhecimento) {
      atualizarEstado("erro", "Reconhecimento de voz indisponível. Use Chrome ou o aplicativo Desktop atualizado.")
      return undefined
    }

    const reconhecimento = new Reconhecimento()
    reconhecimento.lang = "pt-BR"
    reconhecimento.continuous = true
    reconhecimento.interimResults = false
    reconhecimento.maxAlternatives = 1

    reconhecimento.onstart = () => {
      if (!ativadaRef.current || processandoRef.current || falandoRef.current) return

      if (sessaoAtivaRef.current || modoRef.current === "session") {
        atualizarEstado("conversando", "Pode falar normalmente. Diga “Obrigado” para encerrar.")
      } else {
        atualizarEstado(
          "aguardando",
          `Escutando pelo ${microfone}. Diga “Bom dia”, “Boa tarde” ou “Nexa”.`,
        )
      }
    }

    reconhecimento.onresult = (evento) => {
      for (let indice = evento.resultIndex; indice < evento.results.length; indice += 1) {
        const resultado = evento.results[indice]
        if (!resultado.isFinal) continue
        tratarTranscricaoRef.current?.(resultado[0]?.transcript || "")
      }
    }

    reconhecimento.onerror = (evento) => {
      const codigo = evento?.error || "erro-desconhecido"
      if (["no-speech", "aborted"].includes(codigo)) return

      if (["not-allowed", "service-not-allowed"].includes(codigo)) {
        ativadaRef.current = false
        localStorage.setItem(VOICE_ENABLED_KEY, "false")
        sessaoAtivaRef.current = false
        setSessaoAtiva(false)
        setEstado({
          ativada: false,
          status: "erro",
          detalhe: "Autorize o microfone no Windows e clique em Ativar uma vez.",
        })
        return
      }

      atualizarEstado("erro", codigo === "network"
        ? "O serviço de reconhecimento de voz ficou indisponível. Tentarei novamente."
        : `Falha no microfone: ${codigo}.`)
    }

    reconhecimento.onend = () => {
      if (ativadaRef.current && !processandoRef.current && !falandoRef.current) agendarReinicio(500)
    }

    reconhecimentoRef.current = reconhecimento
    if (ativadaRef.current) agendarReinicio(700)

    return () => {
      clearTimeout(reinicioRef.current)
      try {
        reconhecimento.abort()
      } catch {
        // Sem ação.
      }
      window.speechSynthesis?.cancel?.()
      try {
        audioVozRef.current?.pause?.()
        audioVozRef.current = null
      } catch {
        // Sem ação.
      }
      falandoRef.current = false
      reconhecimentoRef.current = null
    }
  }, [agendarReinicio, atualizarEstado, microfone])

  useEffect(() => {
    ativadaRef.current = estado.ativada
    localStorage.setItem(VOICE_ENABLED_KEY, String(estado.ativada))
    window.nexaDesktop?.setVoiceActive?.(estado.ativada).catch?.(() => {})

    if (!estado.ativada) {
      clearTimeout(reinicioRef.current)
      processandoRef.current = false
      falandoRef.current = false
      sessaoAtivaRef.current = false
      setSessaoAtiva(false)
      window.speechSynthesis?.cancel?.()
      modoRef.current = "wake"
      try {
        reconhecimentoRef.current?.abort()
      } catch {
        // Sem ação.
      }
    }
  }, [estado.ativada])

  useEffect(() => {
    let ativo = true

    verificarVozNeural().then((status) => {
      if (!ativo) return
      vozNeuralDisponivelRef.current = Boolean(status.neuralDisponivel)
      vozNeuralNomeRef.current = status.vozNeural || "pt-BR-FranciscaNeural"

      if (status.neuralDisponivel) {
        setVozAtiva(`Voz neural — ${vozNeuralNomeRef.current}`)
        return
      }

      const voz = escolherVozFeminina(window.speechSynthesis?.getVoices?.() || [])
      setVozAtiva(nomeAmigavelVoz(voz))
    })

    return () => { ativo = false }
  }, [])

  useEffect(() => {
    const sintetizador = window.speechSynthesis
    if (!sintetizador) return undefined

    const carregarVozes = () => {
      const voz = escolherVozFeminina(sintetizador.getVoices?.() || [])
      if (!vozNeuralDisponivelRef.current) setVozAtiva(nomeAmigavelVoz(voz))
      return voz
    }
    carregarVozes()
    sintetizador.addEventListener?.("voiceschanged", carregarVozes)
    return () => sintetizador.removeEventListener?.("voiceschanged", carregarVozes)
  }, [])

  useEffect(() => {
    navigator.mediaDevices?.addEventListener?.("devicechange", atualizarNomeMicrofone)
    if (estado.ativada) {
      atualizarNomeMicrofone()
      carregarVocabulario()
    }
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", atualizarNomeMicrofone)
  }, [atualizarNomeMicrofone, carregarVocabulario, estado.ativada])

  async function ativarVoz() {
    if (!obterReconhecimento()) {
      atualizarEstado("erro", "Reconhecimento de voz indisponível. Use Chrome ou o aplicativo Desktop atualizado.")
      return
    }

    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
      fluxo.getTracks().forEach((faixa) => faixa.stop())
      await atualizarNomeMicrofone()
      await carregarVocabulario()
      ativadaRef.current = true
      sessaoAtivaRef.current = false
      setSessaoAtiva(false)
      modoRef.current = "wake"
      setEstado({ ativada: true, status: "iniciando", detalhe: "Preparando escuta contínua..." })
      agendarReinicio(250)
    } catch (error) {
      console.error("[Nexa Voice] Permissão do microfone negada:", error)
      setEstado({
        ativada: false,
        status: "erro",
        detalhe: "Não consegui acessar o microfone. Libere a permissão no Windows ou no navegador.",
      })
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
          <div style={styles.microphone}><span>Entrada</span><strong>{microfone}</strong></div>
          <div style={styles.microphone}><span>Voz</span><strong>{vozAtiva}</strong></div>
          <div style={styles.vocabulary}>Vocabulário adaptativo ativo · {totalVocabulario} termos aprendidos</div>
          {sessaoAtiva && <div style={styles.sessionBadge}>Conversa aberta — diga “Obrigado” para encerrar</div>}
          {ultimaFala && <div style={styles.last}><span>Você</span><p>{ultimaFala}</p></div>}
          {ultimaResposta && <div style={styles.last}><span>Nexa</span><p>{ultimaResposta}</p></div>}
          <button type="button" style={{ ...styles.control, ...(estado.ativada ? styles.controlPause : styles.controlStart) }} onClick={pausarOuRetomar}>
            {estado.ativada ? "Pausar escuta" : "Ativar uma vez"}
          </button>
          <small style={styles.help}>
            Abra a conversa dizendo “Bom dia”, “Boa tarde” ou “Nexa”. A Nexa pode aprender nomes após sua confirmação. Diga “Obrigado” para encerrar.
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
  microphone: { display: "flex", flexDirection: "column", gap: "3px", padding: "9px", background: "rgba(255,255,255,.05)", borderRadius: "9px", fontSize: "11px" },
  vocabulary: { fontSize: "11px", color: "#9ee7c2", marginTop: "-3px" },
  sessionBadge: { padding: "8px 9px", borderRadius: "9px", background: "rgba(55,255,116,.09)", border: "1px solid rgba(55,255,116,.22)", color: "#aaffc5", fontSize: "11px", fontWeight: 700 },
  last: { padding: "9px", background: "rgba(0,168,255,.08)", border: "1px solid rgba(0,168,255,.17)", borderRadius: "9px" },
  control: { border: 0, borderRadius: "10px", padding: "10px 12px", fontWeight: "bold", cursor: "pointer" },
  controlStart: { background: "linear-gradient(135deg,#00a8ff,#2eff78)", color: "#001b34" },
  controlPause: { background: "rgba(255,184,77,.13)", color: "#ffd298", border: "1px solid rgba(255,184,77,.30)" },
  help: { color: "#849ab5", lineHeight: 1.4 },
}
