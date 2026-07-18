const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("nexaDesktop", {
  isDesktop: true,
  platform: process.platform,
  setVoiceActive: (active) => ipcRenderer.invoke("nexa-voice:set-active", Boolean(active)),
})
