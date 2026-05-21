const { app, BrowserWindow } = require("electron")
const { autoUpdater } = require("electron-updater")
const path = require("path")

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
    },
  })

  const isDev = !app.isPackaged

  if (isDev) {
    win.loadURL("http://localhost:5173")
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"))
  }

  win.maximize()
  win.show()
}

app.whenReady().then(() => {

  autoUpdater.checkForUpdatesAndNotify()

  createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})