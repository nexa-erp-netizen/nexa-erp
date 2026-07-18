const { app, BrowserWindow, ipcMain, powerSaveBlocker, session } = require("electron")
const { autoUpdater } = require("electron-updater")
const path = require("path")

let voicePowerBlockerId = null

function origemPermitida(url = "") {
  try {
    const origem = new URL(url).origin
    return origem === "https://contabilplus-web.vercel.app" || origem === "http://localhost:5173"
  } catch {
    return false
  }
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
  ipcMain.handle("nexa-voice:set-active", (_event, active) => {
    if (active) {
      if (voicePowerBlockerId === null || !powerSaveBlocker.isStarted(voicePowerBlockerId)) {
        voicePowerBlockerId = powerSaveBlocker.start("prevent-app-suspension")
      }
    } else if (voicePowerBlockerId !== null && powerSaveBlocker.isStarted(voicePowerBlockerId)) {
      powerSaveBlocker.stop(voicePowerBlockerId)
      voicePowerBlockerId = null
    }

    return { active: Boolean(active), powerBlockerId: voicePowerBlockerId }
  })
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

  win.loadURL("https://contabilplus-web.vercel.app")

  win.maximize()
  win.show()
}

app.whenReady().then(() => {
  configurarPermissoesDeAudio()
  configurarMotorDeVozDesktop()
  autoUpdater.checkForUpdatesAndNotify()
  createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
