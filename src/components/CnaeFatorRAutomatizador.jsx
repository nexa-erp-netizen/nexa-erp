import { useEffect } from "react"
import { classificarCnaeFatorR, normalizarCnae, VERSAO_CLASSIFICADOR_CNAE } from "../motorTributario/classificarCnaeFatorR"

const BOX_ID = "nexa-cnae-fator-r-auto"

function encontrarSelectPorOpcao(texto) {
  const alvo = String(texto || "").toLowerCase()
  return [...document.querySelectorAll("select")].find((select) =>
    [...select.options].some((option) =>
      String(option.textContent || "").toLowerCase().includes(alvo)
    )
  ) || null
}

function definirValorReact(elemento, valor) {
  if (!elemento) return

  const proto = elemento instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype

  const descriptor = Object.getOwnPropertyDescriptor(proto, "value")
  if (descriptor?.set) descriptor.set.call(elemento, valor)
  else elemento.value = valor

  elemento.dispatchEvent(new Event("change", { bubbles: true }))
  elemento.dispatchEvent(new Event("input", { bubbles: true }))
}

function corPorStatus(status) {
  if (status === "SIM") return {
    borda: "rgba(55,255,116,.45)",
    fundo: "rgba(55,255,116,.09)",
    titulo: "#76ff9d",
  }

  if (status === "NAO") return {
    borda: "rgba(0,168,255,.45)",
    fundo: "rgba(0,168,255,.09)",
    titulo: "#8bd7ff",
  }

  if (status === "NAO_APLICAVEL") return {
    borda: "rgba(169,184,204,.35)",
    fundo: "rgba(169,184,204,.07)",
    titulo: "#c4d4e9",
  }

  return {
    borda: "rgba(255,207,112,.45)",
    fundo: "rgba(255,207,112,.08)",
    titulo: "#ffcf70",
  }
}

function obterOuCriarBox(inputCnae) {
  let box = document.getElementById(BOX_ID)

  if (!box) {
    box = document.createElement("div")
    box.id = BOX_ID
    box.setAttribute("role", "status")
    box.setAttribute("aria-live", "polite")
    inputCnae.insertAdjacentElement("afterend", box)
  } else if (box.previousElementSibling !== inputCnae) {
    inputCnae.insertAdjacentElement("afterend", box)
  }

  return box
}

function renderizarBox(inputCnae, resultado, codigo) {
  const box = obterOuCriarBox(inputCnae)
  const cores = corPorStatus(resultado.status)

  Object.assign(box.style, {
    border: `1px solid ${cores.borda}`,
    background: cores.fundo,
    borderRadius: "12px",
    padding: "12px 13px",
    color: "#dce8f8",
    fontSize: "12px",
    lineHeight: "1.5",
    gridColumn: "1 / -1",
    boxSizing: "border-box",
  })

  const codigoTexto = codigo ? `CNAE ${codigo}` : "CNAE ainda incompleto"

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <strong style="color:${cores.titulo}">${escapeHtml(resultado.titulo)}</strong>
      <span style="color:#8ea4c0">Nexa CNAE ${escapeHtml(VERSAO_CLASSIFICADOR_CNAE)} • ${escapeHtml(codigoTexto)}</span>
    </div>
    <div style="margin-top:5px">${escapeHtml(resultado.motivo)}</div>
    ${resultado.status === "SIM"
      ? '<div style="margin-top:5px;color:#a9b8cc">O Anexo não é fixado aqui: será III ou V conforme o cálculo do Fator R.</div>'
      : ''}
    ${resultado.status === "REVISAR"
      ? '<div style="margin-top:5px;color:#ffcf70"><strong>Ação necessária:</strong> confirmar a atividade real antes de salvar a classificação.</div>'
      : ''}
  `
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export default function CnaeFatorRAutomatizador() {
  useEffect(() => {
    const limpezas = []
    let timer = null

    function processar() {
      const inputCnae = document.querySelector('input[placeholder="CNAE Principal"]')
      if (!inputCnae) return

      const regimeSelect = encontrarSelectPorOpcao("Selecione o regime")
      const ramoSelect = encontrarSelectPorOpcao("Selecione o ramo de atividade")
      const fatorSelect = encontrarSelectPorOpcao("Utiliza Fator R?")
      const anexoSelect = encontrarSelectPorOpcao("Selecione o Anexo")

      const valorCnae = inputCnae.value || ""
      const codigo = normalizarCnae(valorCnae)

      const resultado = classificarCnaeFatorR({
        cnae: valorCnae,
        descricao: valorCnae,
        regime: regimeSelect?.value || "",
        ramoAtividade: ramoSelect?.value || "",
      })

      renderizarBox(inputCnae, resultado, codigo)

      // Só automatizamos quando a classificação é de alta confiança.
      if (resultado.confianca !== "alta") return

      if (fatorSelect && resultado.utilizaFatorR) {
        if (fatorSelect.value !== resultado.utilizaFatorR) {
          definirValorReact(fatorSelect, resultado.utilizaFatorR)
        }
      }

      // Anexo I, II ou IV só é preenchido quando o classificador tem
      // enquadramento inicial de alta confiança.
      // Para Fator R, o anexo será III/V e fica para o cálculo do período.
      if (anexoSelect && resultado.anexoSugerido) {
        if (anexoSelect.value !== resultado.anexoSugerido) {
          definirValorReact(anexoSelect, resultado.anexoSugerido)
        }
      }
    }

    function agendar() {
      clearTimeout(timer)
      timer = setTimeout(processar, 80)
    }

    function conectar() {
      const inputCnae = document.querySelector('input[placeholder="CNAE Principal"]')
      if (!inputCnae || inputCnae.__nexaFatorRConectado) return

      inputCnae.__nexaFatorRConectado = true

      const eventos = ["input", "change", "blur"]
      eventos.forEach((evento) => inputCnae.addEventListener(evento, agendar))

      const regimeSelect = encontrarSelectPorOpcao("Selecione o regime")
      const ramoSelect = encontrarSelectPorOpcao("Selecione o ramo de atividade")

      if (regimeSelect) regimeSelect.addEventListener("change", agendar)
      if (ramoSelect) ramoSelect.addEventListener("change", agendar)

      limpezas.push(() => {
        eventos.forEach((evento) => inputCnae.removeEventListener(evento, agendar))
        if (regimeSelect) regimeSelect.removeEventListener("change", agendar)
        if (ramoSelect) ramoSelect.removeEventListener("change", agendar)
        try { delete inputCnae.__nexaFatorRConectado } catch {}
      })

      agendar()
    }

    const observer = new MutationObserver(() => {
      conectar()
    })

    observer.observe(document.body, { childList: true, subtree: true })
    conectar()

    return () => {
      clearTimeout(timer)
      observer.disconnect()
      limpezas.forEach((limpar) => limpar())
      document.getElementById(BOX_ID)?.remove()
    }
  }, [])

  return null
}
