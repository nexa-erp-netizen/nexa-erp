import { useCallback, useEffect, useRef, useState } from "react"
import { conversarComNexa } from "../services/conversaNexaService"
import {
  executarAcaoDeVoz,
  obterContextoVoz,
  registrarConversaVoz,
} from "../services/nexaVoiceService"

const VOICE_ENABLED_KEY = "nexaVoiceEnabled"
const WAKE_WORD_PATTERN = /^\s*(?:(?:ei|ola|olá)\s+)?(?:nexa|néxa|neksa|nexta)\b[\s,.:;-]*(.*)$/i
const TEMPO_COMANDO_MS = 9000
const TEMPO_MAXIMO_FALA_MS = 18000

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
    detalhe: ativada ? "Preparando o microfone..." : "Ative uma vez para usar sem tocar no microfone.",
  }
}

function nomeStatus(status) {
  if (status === "aguardando") return "Aguardando “Nexa”"
  if (status === "ouvindo") return "Ouvindo seu comando"
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

export default function NexaVoiceListener({ usuario, setPage }) {
  const [estado, setEstado] = useState(criarEstadoInicial)
  const [ultimaFala, setUltimaFala] = useState("")
  const [ultimaResposta, setUltimaResposta] = useState("")
  const [microfone, setMicrofone] = useState("Microfone padrão do Windows")
  const [expandido, setExpandido] = useState(false)

  const reconhecimentoRef = useRef(null)
  const ativadaRef = useRef(estado.ativada)
  const modoRef = useRef("wake")
  const processandoRef = useRef(false)
  const falandoRef = useRef(false)
  const reinicioRef = useRef(null)
  const limiteComandoRef = useRef(null)
  const conversaIdRef = useRef(obterContextoVoz().conversaId || null)
  const historicoRef = useRef([])
  const tratarTranscricaoRef = useRef(null)

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

  const falarResposta = useCallback((textoOriginal) => new Promise((resolve) => {
    const sintetizador = window.speechSynthesis
    const CriadorDeFala = window.SpeechSynthesisUtterance
    const texto = limparRespostaDaNexa(textoOriginal)

    if (!sintetizador || !CriadorDeFala || !texto) {
      resolve(false)
      return
    }

    try {
      reconhecimentoRef.current?.abort()
    } catch {
      // O reconhecimento pode já estar encerrado.
    }

    falandoRef.current = true
    atualizarEstado("falando", texto)

    const fala = new CriadorDeFala(texto)
    fala.lang = "pt-BR"
    fala.rate = 1
    fala.pitch = 1
    fala.volume = 1

    const vozes = sintetizador.getVoices?.() || []
    fala.voice = vozes.find((voz) => /^pt-BR$/i.test(voz.lang))
      || vozes.find((voz) => /^pt/i.test(voz.lang))
      || null

    let concluida = false
    const finalizar = (falou = true) => {
      if (concluida) return
      concluida = true
      falandoRef.current = false
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
  }), [atualizarEstado])

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

  const voltarParaEspera = useCallback(() => {
    clearTimeout(limiteComandoRef.current)
    modoRef.current = "wake"
    processandoRef.current = false
    atualizarEstado("aguardando", `Escutando pelo ${microfone}. Diga “Nexa”.`)
    agendarReinicio(500)
  }, [agendarReinicio, atualizarEstado, microfone])

  const processarComando = useCallback(async (texto) => {
    const comando = String(texto || "").trim()
    if (!comando || processandoRef.current) return

    clearTimeout(limiteComandoRef.current)
    processandoRef.current = true
    modoRef.current = "wake"
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
      historicoRef.current = [
        ...historicoRef.current,
        { autor: "Você", texto: comando },
        { autor: "Nexa", texto: textoResposta },
      ].slice(-12)

      executarAcaoDeVoz({ acao: resposta.acao, setPage })
      await falarResposta(textoResposta)
      tocarSinal(900, 80)
      voltarParaEspera()
    } catch (error) {
      console.error("[Nexa Voice] Falha ao processar comando:", error)
      const mensagem = error.response?.data?.message || error.message || "Não consegui processar o comando."
      setUltimaResposta(mensagem)
      processandoRef.current = false
      atualizarEstado("erro", mensagem)
      agendarReinicio(1800)
    }
  }, [agendarReinicio, atualizarEstado, falarResposta, setPage, voltarParaEspera])

  useEffect(() => {
    tratarTranscricaoRef.current = (transcricao) => {
      const texto = String(transcricao || "").trim()
      if (!texto || processandoRef.current) return

      if (modoRef.current === "command") {
        const semWakeWord = texto.match(WAKE_WORD_PATTERN)?.[1]?.trim() || texto
        processarComando(semWakeWord)
        return
      }

      const ativacao = texto.match(WAKE_WORD_PATTERN)
      if (!ativacao) return

      tocarSinal(720, 90)
      const comandoNaMesmaFrase = String(ativacao[1] || "").trim()
      if (comandoNaMesmaFrase) {
        processarComando(comandoNaMesmaFrase)
        return
      }

      modoRef.current = "command"
      atualizarEstado("ouvindo", "Pode falar.")
      clearTimeout(limiteComandoRef.current)
      limiteComandoRef.current = setTimeout(() => {
        if (modoRef.current === "command" && !processandoRef.current) {
          modoRef.current = "wake"
          atualizarEstado("aguardando", "Não ouvi o comando. Diga “Nexa” novamente.")
        }
      }, TEMPO_COMANDO_MS)
    }
  }, [processarComando, atualizarEstado])

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
      atualizarEstado(
        modoRef.current === "command" ? "ouvindo" : "aguardando",
        modoRef.current === "command" ? "Pode falar." : `Escutando pelo ${microfone}. Diga “Nexa”.`,
      )
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
      clearTimeout(limiteComandoRef.current)
      try {
        reconhecimento.abort()
      } catch {
        // Sem ação.
      }
      window.speechSynthesis?.cancel?.()
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
      clearTimeout(limiteComandoRef.current)
      processandoRef.current = false
      falandoRef.current = false
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
    navigator.mediaDevices?.addEventListener?.("devicechange", atualizarNomeMicrofone)
    if (estado.ativada) atualizarNomeMicrofone()
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", atualizarNomeMicrofone)
  }, [atualizarNomeMicrofone, estado.ativada])

  async function ativarVoz() {
    if (!obterReconhecimento()) {
      atualizarEstado("erro", "Reconhecimento de voz indisponível. Use Chrome ou o aplicativo Desktop atualizado.")
      return
    }

    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
      fluxo.getTracks().forEach((faixa) => faixa.stop())
      await atualizarNomeMicrofone()
      ativadaRef.current = true
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
          {ultimaFala && <div style={styles.last}><span>Você</span><p>{ultimaFala}</p></div>}
          {ultimaResposta && <div style={styles.last}><span>Nexa</span><p>{ultimaResposta}</p></div>}
          <button type="button" style={{ ...styles.control, ...(estado.ativada ? styles.controlPause : styles.controlStart) }} onClick={pausarOuRetomar}>
            {estado.ativada ? "Pausar escuta" : "Ativar uma vez"}
          </button>
          <small style={styles.help}>Depois de ativada, basta dizer “Nexa” — não é necessário tocar no microfone novamente.</small>
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
  last: { padding: "9px", background: "rgba(0,168,255,.08)", border: "1px solid rgba(0,168,255,.17)", borderRadius: "9px" },
  control: { border: 0, borderRadius: "10px", padding: "10px 12px", fontWeight: "bold", cursor: "pointer" },
  controlStart: { background: "linear-gradient(135deg,#00a8ff,#2eff78)", color: "#001b34" },
  controlPause: { background: "rgba(255,184,77,.13)", color: "#ffd298", border: "1px solid rgba(255,184,77,.30)" },
  help: { color: "#849ab5", lineHeight: 1.4 },
}
