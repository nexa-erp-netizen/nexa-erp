import { useEffect, useRef, useState } from "react"

const POSITION_KEY = "nexaFloatingCalculatorPosition"
const OPEN_KEY = "nexaFloatingCalculatorOpen"

function limitar(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), Math.max(minimo, maximo))
}

function calcular(a, b, operador) {
  if (operador === "+") return a + b
  if (operador === "-") return a - b
  if (operador === "×") return a * b
  if (operador === "÷") return b === 0 ? null : a / b
  return b
}

function normalizarNumero(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

function formatarDisplay(valor) {
  const texto = String(valor ?? "0")
  if (texto === "Erro") return texto
  const [inteiro, decimal] = texto.split(".")
  const sinal = inteiro.startsWith("-") ? "-" : ""
  const bruto = sinal ? inteiro.slice(1) : inteiro
  const formatado = bruto.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${sinal}${formatado}${decimal !== undefined ? `,${decimal}` : ""}`
}

export default function FloatingCalculator({ avoidNexa = false }) {
  const containerRef = useRef(null)
  const dragRef = useRef(null)
  const [aberta, setAberta] = useState(() => localStorage.getItem(OPEN_KEY) === "1")
  const [posicao, setPosicao] = useState(() => {
    try {
      const salva = JSON.parse(localStorage.getItem(POSITION_KEY) || "null")
      return salva && Number.isFinite(salva.x) && Number.isFinite(salva.y) ? salva : null
    } catch {
      return null
    }
  })
  const [display, setDisplay] = useState("0")
  const [acumulador, setAcumulador] = useState(null)
  const [operador, setOperador] = useState(null)
  const [aguardandoNovoNumero, setAguardandoNovoNumero] = useState(false)

  useEffect(() => {
    localStorage.setItem(OPEN_KEY, aberta ? "1" : "0")
  }, [aberta])

  useEffect(() => {
    if (!posicao) return
    localStorage.setItem(POSITION_KEY, JSON.stringify(posicao))
  }, [posicao])

  useEffect(() => {
    function ajustarPosicao() {
      if (!posicao || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setPosicao(atual => atual ? ({
        x: limitar(atual.x, 8, window.innerWidth - rect.width - 8),
        y: limitar(atual.y, 8, window.innerHeight - rect.height - 8),
      }) : atual)
    }
    const id = requestAnimationFrame(ajustarPosicao)
    window.addEventListener("resize", ajustarPosicao)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener("resize", ajustarPosicao)
    }
  }, [aberta])

  function iniciarArrasto(evento) {
    if (evento.button !== undefined && evento.button !== 0) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = {
      pointerId: evento.pointerId,
      offsetX: evento.clientX - rect.left,
      offsetY: evento.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    }
    evento.currentTarget.setPointerCapture?.(evento.pointerId)
  }

  function mover(evento) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== evento.pointerId) return
    setPosicao({
      x: limitar(evento.clientX - drag.offsetX, 8, window.innerWidth - drag.width - 8),
      y: limitar(evento.clientY - drag.offsetY, 8, window.innerHeight - drag.height - 8),
    })
  }

  function terminarArrasto(evento) {
    if (dragRef.current?.pointerId === evento.pointerId) dragRef.current = null
  }

  function limpar() {
    setDisplay("0")
    setAcumulador(null)
    setOperador(null)
    setAguardandoNovoNumero(false)
  }

  function digitarNumero(numero) {
    if (display === "Erro" || aguardandoNovoNumero) {
      setDisplay(String(numero))
      setAguardandoNovoNumero(false)
      return
    }
    if (display === "0") setDisplay(String(numero))
    else if (display.length < 16) setDisplay(`${display}${numero}`)
  }

  function digitarDecimal() {
    if (display === "Erro" || aguardandoNovoNumero) {
      setDisplay("0.")
      setAguardandoNovoNumero(false)
      return
    }
    if (!display.includes(".")) setDisplay(`${display}.`)
  }

  function apagarUltimo() {
    if (display === "Erro" || aguardandoNovoNumero) return
    if (display.length <= 1 || (display.length === 2 && display.startsWith("-"))) setDisplay("0")
    else setDisplay(display.slice(0, -1))
  }

  function inverterSinal() {
    if (display === "Erro") return
    const valor = normalizarNumero(display)
    setDisplay(String(valor === 0 ? 0 : -valor))
  }

  function porcentagem() {
    if (display === "Erro") return
    setDisplay(String(normalizarNumero(display) / 100))
    setAguardandoNovoNumero(true)
  }

  function aplicarOperacao(proximoOperador) {
    if (display === "Erro") return limpar()
    const entrada = normalizarNumero(display)

    if (acumulador === null) {
      setAcumulador(entrada)
    } else if (operador && !aguardandoNovoNumero) {
      const resultado = calcular(acumulador, entrada, operador)
      if (resultado === null || !Number.isFinite(resultado)) {
        setDisplay("Erro")
        setAcumulador(null)
        setOperador(null)
        setAguardandoNovoNumero(true)
        return
      }
      const reduzido = Number(resultado.toPrecision(12))
      setDisplay(String(reduzido))
      setAcumulador(reduzido)
    }

    setOperador(proximoOperador)
    setAguardandoNovoNumero(true)
  }

  function igual() {
    if (!operador || acumulador === null || display === "Erro") return
    const entrada = normalizarNumero(display)
    const resultado = calcular(acumulador, entrada, operador)
    if (resultado === null || !Number.isFinite(resultado)) {
      setDisplay("Erro")
    } else {
      setDisplay(String(Number(resultado.toPrecision(12))))
    }
    setAcumulador(null)
    setOperador(null)
    setAguardandoNovoNumero(true)
  }

  useEffect(() => {
    if (!aberta) return
    function teclado(evento) {
      if (/^\d$/.test(evento.key)) return digitarNumero(evento.key)
      if (evento.key === "." || evento.key === ",") return digitarDecimal()
      if (evento.key === "+") return aplicarOperacao("+")
      if (evento.key === "-") return aplicarOperacao("-")
      if (evento.key === "*") return aplicarOperacao("×")
      if (evento.key === "/") { evento.preventDefault(); return aplicarOperacao("÷") }
      if (evento.key === "Enter" || evento.key === "=") { evento.preventDefault(); return igual() }
      if (evento.key === "Backspace") return apagarUltimo()
      if (evento.key === "Escape") return setAberta(false)
      if (evento.key.toLowerCase() === "c") return limpar()
      if (evento.key === "%") return porcentagem()
    }
    window.addEventListener("keydown", teclado)
    return () => window.removeEventListener("keydown", teclado)
  }, [aberta, display, acumulador, operador, aguardandoNovoNumero])

  const posicaoStyle = posicao
    ? { left: posicao.x, top: posicao.y }
    : { right: avoidNexa ? 286 : 18, bottom: 18 }

  const botoes = [
    ["AC", limpar, "utility"], ["±", inverterSinal, "utility"], ["%", porcentagem, "utility"], ["÷", () => aplicarOperacao("÷"), "operator"],
    ["7", () => digitarNumero(7)], ["8", () => digitarNumero(8)], ["9", () => digitarNumero(9)], ["×", () => aplicarOperacao("×"), "operator"],
    ["4", () => digitarNumero(4)], ["5", () => digitarNumero(5)], ["6", () => digitarNumero(6)], ["-", () => aplicarOperacao("-"), "operator"],
    ["1", () => digitarNumero(1)], ["2", () => digitarNumero(2)], ["3", () => digitarNumero(3)], ["+", () => aplicarOperacao("+"), "operator"],
    ["⌫", apagarUltimo, "utility"], ["0", () => digitarNumero(0)], [",", digitarDecimal], ["=", igual, "equals"],
  ]

  return (
    <aside ref={containerRef} style={{ ...styles.container, ...(aberta ? styles.expanded : styles.collapsed), ...posicaoStyle }}>
      <div
        style={styles.header}
        onPointerDown={iniciarArrasto}
        onPointerMove={mover}
        onPointerUp={terminarArrasto}
        onPointerCancel={terminarArrasto}
      >
        <span style={styles.icon}>🧮</span>
        <div style={styles.headerText}>
          <strong>Calculadora</strong>
          {!aberta && <small>{formatarDisplay(display)}</small>}
        </div>
        <button
          type="button"
          aria-label={aberta ? "Recolher calculadora" : "Abrir calculadora"}
          style={styles.toggle}
          onPointerDown={evento => evento.stopPropagation()}
          onClick={() => setAberta(atual => !atual)}
        >
          {aberta ? "−" : "+"}
        </button>
      </div>

      {aberta && (
        <div style={styles.content}>
          <div style={styles.displayWrap}>
            <small style={styles.expression}>{acumulador !== null && operador ? `${formatarDisplay(acumulador)} ${operador}` : "Cálculo rápido"}</small>
            <div style={styles.display}>{formatarDisplay(display)}</div>
          </div>
          <div style={styles.grid}>
            {botoes.map(([rotulo, acao, tipo], indice) => (
              <button
                type="button"
                key={`${rotulo}-${indice}`}
                style={{
                  ...styles.key,
                  ...(tipo === "operator" ? styles.operator : {}),
                  ...(tipo === "utility" ? styles.utility : {}),
                  ...(tipo === "equals" ? styles.equals : {}),
                }}
                onClick={acao}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <small style={styles.help}>Arraste pelo cabeçalho. Teclado numérico também funciona.</small>
        </div>
      )}
    </aside>
  )
}

const styles = {
  container: {
    position: "fixed",
    zIndex: 9998,
    color: "#f4fbff",
    background: "rgba(3,22,52,.98)",
    border: "1px solid rgba(0,190,255,.34)",
    borderRadius: 16,
    boxShadow: "0 18px 45px rgba(0,0,0,.42)",
    overflow: "hidden",
    backdropFilter: "blur(12px)",
    userSelect: "none",
  },
  collapsed: { width: 190 },
  expanded: { width: 320, maxWidth: "calc(100vw - 20px)" },
  header: {
    display: "flex", alignItems: "center", gap: 10, padding: "11px 12px",
    background: "linear-gradient(135deg,rgba(0,168,255,.17),rgba(46,255,120,.09))",
    cursor: "grab", touchAction: "none",
  },
  icon: { fontSize: 19 },
  headerText: { display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 },
  toggle: { width: 31, height: 31, borderRadius: 9, border: "1px solid rgba(139,215,255,.28)", background: "rgba(0,168,255,.12)", color: "#ccecff", fontSize: 20, lineHeight: 1, cursor: "pointer" },
  content: { padding: 12 },
  displayWrap: { padding: "12px 13px", marginBottom: 10, borderRadius: 12, background: "#061a39", border: "1px solid rgba(255,255,255,.08)", textAlign: "right", overflow: "hidden" },
  expression: { display: "block", minHeight: 15, color: "#86a7c8", fontSize: 11, marginBottom: 5 },
  display: { fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", overflowWrap: "anywhere" },
  grid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 7 },
  key: { height: 48, borderRadius: 11, border: "1px solid rgba(255,255,255,.09)", background: "#0b315d", color: "#f5fbff", fontSize: 17, fontWeight: 800, cursor: "pointer" },
  operator: { background: "#0b6078", borderColor: "rgba(54,200,232,.4)", color: "#dffaff" },
  utility: { background: "#17365d", color: "#bcd2e8" },
  equals: { background: "linear-gradient(135deg,#00a8ff,#2eff78)", color: "#001b34", border: 0 },
  help: { display: "block", marginTop: 9, color: "#7898b7", textAlign: "center", fontSize: 10 },
}
