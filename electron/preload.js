const { contextBridge, ipcRenderer } = require("electron")

function assinar(canal, callback) {
  if (typeof callback !== "function") return () => {}
  const handler = (_event, payload) => callback(payload)
  ipcRenderer.on(canal, handler)
  return () => ipcRenderer.removeListener(canal, handler)
}

contextBridge.exposeInMainWorld("nexaDesktop", {
  isDesktop: true,
  platform: process.platform,
  setVoiceActive: (active) => ipcRenderer.invoke("nexa-voice:set-active", Boolean(active)),
  nativeVoice: {
    isAvailable: process.platform === "win32",
    start: () => ipcRenderer.invoke("nexa-voice-native:start"),
    pause: () => ipcRenderer.invoke("nexa-voice-native:pause"),
    stop: () => ipcRenderer.invoke("nexa-voice-native:stop"),
    status: () => ipcRenderer.invoke("nexa-voice-native:status"),
    onTranscript: (callback) => assinar("nexa-voice-native:transcript", callback),
    onStatus: (callback) => assinar("nexa-voice-native:status", callback),
    onAudioState: (callback) => assinar("nexa-voice-native:audio-state", callback),
    onError: (callback) => assinar("nexa-voice-native:error", callback),
  },
})
