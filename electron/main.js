const { app, BrowserWindow, ipcMain, powerSaveBlocker, session } = require("electron")
const { autoUpdater } = require("electron-updater")
const { spawn } = require("child_process")
const readline = require("readline")
const path = require("path")

let mainWindow = null
let voicePowerBlockerId = null
let nativeVoiceProcess = null
let nativeVoiceReady = false
let nativeVoiceShouldRun = false
let nativeVoiceRestartTimer = null

function configurarAtualizacaoAutomatica() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on("error", (error) => {
    console.error("Falha ao verificar atualização da Nexa:", error)
  })

  autoUpdater.on("update-downloaded", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send("nexa-update:downloaded", {
      message: "Uma nova versão da Nexa foi baixada e será instalada ao fechar o aplicativo.",
    })
  })

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error("Não foi possível consultar atualizações da Nexa:", error)
    })
  }, 5000)
}

function origemPermitida(url = "") {
  try {
    const origem = new URL(url).origin
    return origem === "https://contabilplus-web.vercel.app" || origem === "http://localhost:5173"
  } catch {
    return false
  }
}

function enviarEventoVoz(canal, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(canal, payload)
}

function caminhoScriptVoz() {
  if (app.isPackaged) return path.join(process.resourcesPath, "nexa-voice-listener.ps1")
  return path.join(__dirname, "nexa-voice-listener.ps1")
}

function enviarComandoVoz(comando) {
  if (!nativeVoiceProcess || nativeVoiceProcess.killed || !nativeVoiceProcess.stdin?.writable) return false

  try {
    nativeVoiceProcess.stdin.write(`${comando}\n`)
    return true
  } catch {
    return false
  }
}

function encerrarMotorVozNativo() {
  clearTimeout(nativeVoiceRestartTimer)
  nativeVoiceRestartTimer = null
  nativeVoiceShouldRun = false
  nativeVoiceReady = false

  if (!nativeVoiceProcess) return

  try {
    enviarComandoVoz("STOP")
  } catch {
    // O processo pode já ter sido encerrado.
  }

  const processo = nativeVoiceProcess
  nativeVoiceProcess = null

  setTimeout(() => {
    try {
      if (!processo.killed) processo.kill()
    } catch {
      // Sem ação.
    }
  }, 700)
}

function iniciarMotorVozNativo() {
  if (process.platform !== "win32") {
    return Promise.resolve({ ok: false, message: "Reconhecimento nativo disponível somente no Windows." })
  }

  nativeVoiceShouldRun = true

  if (nativeVoiceProcess && !nativeVoiceProcess.killed) {
    enviarComandoVoz("RESUME")
    return Promise.resolve({ ok: true, ready: nativeVoiceReady })
  }

  const script = caminhoScriptVoz()
  const processo = spawn(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-Language",
      "pt-BR",
    ],
    {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  )

  nativeVoiceProcess = processo
  nativeVoiceReady = false

  const linhas = readline.createInterface({ input: processo.stdout })
  linhas.on("line", (linha) => {
    const texto = String(linha || "").trim()
    if (!texto) return

    try {
      const evento = JSON.parse(texto)

      if (evento.type === "ready") {
        nativeVoiceReady = true
        enviarEventoVoz("nexa-voice-native:status", {
          status: "ready",
          message: `Reconhecimento do Windows pronto (${evento.language || "pt-BR"}).`,
          recognizer: evento.name || evento.description || "Windows Speech Recognition",
        })
        if (nativeVoiceShouldRun) enviarComandoVoz("RESUME")
        return
      }

      if (evento.type === "transcript") {
        enviarEventoVoz("nexa-voice-native:transcript", {
          text: String(evento.text || "").trim(),
          confidence: Number(evento.confidence || 0),
        })
        return
      }

      if (evento.type === "audio-state") {
        enviarEventoVoz("nexa-voice-native:audio-state", { state: evento.state || "" })
        return
      }

      if (evento.type === "error") {
        enviarEventoVoz("nexa-voice-native:error", {
          code: evento.code || "native-recognizer-error",
          message: evento.message || "Falha no reconhecimento nativo do Windows.",
        })
        return
      }

      enviarEventoVoz("nexa-voice-native:status", evento)
    } catch {
      enviarEventoVoz("nexa-voice-native:debug", { message: texto })
    }
  })

  processo.stderr.on("data", (dados) => {
    const mensagem = String(dados || "").trim()
    if (!mensagem) return
    enviarEventoVoz("nexa-voice-native:error", {
      code: "powershell-stderr",
      message: mensagem,
    })
  })

  processo.on("error", (error) => {
    nativeVoiceReady = false
    enviarEventoVoz("nexa-voice-native:error", {
      code: "native-process-start-failed",
      message: error.message || "Não foi possível iniciar o reconhecimento de voz do Windows.",
    })
  })

  processo.on("exit", (code) => {
    if (nativeVoiceProcess === processo) nativeVoiceProcess = null
    nativeVoiceReady = false

    enviarEventoVoz("nexa-voice-native:status", {
      status: "stopped",
      message: code === 0 ? "Reconhecimento nativo encerrado." : `Reconhecimento nativo encerrado (código ${code}).`,
    })

    if (nativeVoiceShouldRun) {
      clearTimeout(nativeVoiceRestartTimer)
      nativeVoiceRestartTimer = setTimeout(() => iniciarMotorVozNativo(), 1200)
    }
  })

  return Promise.resolve({ ok: true, ready: false })
}

function pausarMotorVozNativo() {
  nativeVoiceShouldRun = false
  enviarComandoVoz("PAUSE")
  return { ok: true }
}

function retomarMotorVozNativo() {
  nativeVoiceShouldRun = true
  if (!nativeVoiceProcess || nativeVoiceProcess.killed) return iniciarMotorVozNativo()
  enviarComandoVoz("RESUME")
  return Promise.resolve({ ok: true, ready: nativeVoiceReady })
}

function configurarPermissoesDeAudio() {
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission !== "media" || !origemPermitida(requestingOrigin)) return false
    const tipo = details?.mediaType || details?.mediaTypes?.[0]
    return !tipo || tipo === "audio"
  })

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission !== "media" || !origemPermitida(webContents.getURL())) {
      callback(false)
      return
    }

    const tipos = Array.isArray(details?.mediaTypes) ? details.mediaTypes : []
    callback(!tipos.length || tipos.includes("audio"))
  })
}

function configurarMotorDeVozDesktop() {
  ipcMain.handle("nexa-voice:set-active", async (_event, active) => {
    if (active) {
      if (voicePowerBlockerId === null || !powerSaveBlocker.isStarted(voicePowerBlockerId)) {
        voicePowerBlockerId = powerSaveBlocker.start("prevent-app-suspension")
      }
      await retomarMotorVozNativo()
    } else {
      encerrarMotorVozNativo()
      if (voicePowerBlockerId !== null && powerSaveBlocker.isStarted(voicePowerBlockerId)) {
        powerSaveBlocker.stop(voicePowerBlockerId)
        voicePowerBlockerId = null
      }
    }

    return { active: Boolean(active), powerBlockerId: voicePowerBlockerId }
  })

  ipcMain.handle("nexa-voice-native:start", () => retomarMotorVozNativo())
  ipcMain.handle("nexa-voice-native:pause", () => pausarMotorVozNativo())
  ipcMain.handle("nexa-voice-native:stop", () => {
    encerrarMotorVozNativo()
    return { ok: true }
  })
  ipcMain.handle("nexa-voice-native:status", () => ({
    available: process.platform === "win32",
    running: Boolean(nativeVoiceProcess && !nativeVoiceProcess.killed),
    ready: nativeVoiceReady,
  }))
}

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "Nexa ERP",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  })

  mainWindow = win
  win.loadURL("https://contabilplus-web.vercel.app")

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null
  })

  win.maximize()
  win.show()
}

app.whenReady().then(() => {
  configurarPermissoesDeAudio()
  configurarMotorDeVozDesktop()
  createWindow()
  configurarAtualizacaoAutomatica()
})

app.on("before-quit", () => {
  encerrarMotorVozNativo()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
