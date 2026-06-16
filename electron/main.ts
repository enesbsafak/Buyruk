import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'node:path'
import { existsSync } from 'node:fs'
import log from 'electron-log/main'
import { registerFileSystemHandlers } from './fileSystem'
import { TerminalManager } from './terminalManager'
import { IPC } from './ipcChannels'
import { loadWindowState, trackWindowState } from './windowState'
import { registerUpdaterHandlers, startAutoUpdateCheck } from './updater'
import { registerAccountHandlers } from './accounts'
import { registerAiLimitHandlers } from './aiLimits'
import { assertTrustedIpcSender, isSafeDevServerUrl, isTrustedAppUrl } from './security'

let mainWindow: BrowserWindow | null = null
let allowClose = false
const terminalManager = new TerminalManager()

app.enableSandbox()
log.initialize()
log.transports.file.level = 'info'

function createWindow(): void {
  const saved = loadWindowState()
  const iconPath = path.join(__dirname, '../build/icon.png')
  mainWindow = new BrowserWindow({
    width: saved.bounds?.width ?? 1440,
    height: saved.bounds?.height ?? 900,
    x: saved.bounds?.x,
    y: saved.bounds?.y,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#15161e',
    title: 'Buyruk',
    icon: existsSync(iconPath) ? iconPath : undefined,
    // Hide the native title bar but keep native resize/snap; we draw our own.
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  if (saved.maximized) mainWindow.maximize()

  terminalManager.attachWindow(mainWindow)
  trackWindowState(mainWindow)

  mainWindow.on('maximize', () =>
    mainWindow?.webContents.send(IPC.WINDOW_MAXIMIZED, true)
  )
  mainWindow.on('unmaximize', () =>
    mainWindow?.webContents.send(IPC.WINDOW_MAXIMIZED, false)
  )

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isTrustedAppUrl(navigationUrl)) event.preventDefault()
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (!app.isPackaged && isSafeDevServerUrl(devServerUrl)) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // F12 toggles DevTools on demand (we removed the native menu, so its default
  // accelerator is gone). DevTools is no longer auto-opened, keeping the console clean.
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  // Ask the renderer to confirm when there are unsaved changes.
  mainWindow.on('close', (e) => {
    if (allowClose) return
    e.preventDefault()
    mainWindow?.webContents.send(IPC.APP_CONFIRM_CLOSE)
  })

  mainWindow.on('closed', () => {
    terminalManager.killAll()
    terminalManager.detachWindow()
    mainWindow = null
  })
}

function registerWindowControls(): void {
  ipcMain.on(IPC.WINDOW_MINIMIZE, (e) => {
    try {
      assertTrustedIpcSender(e)
    } catch {
      return
    }
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })
  ipcMain.on(IPC.WINDOW_MAXIMIZE_TOGGLE, (e) => {
    try {
      assertTrustedIpcSender(e)
    } catch {
      return
    }
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC.WINDOW_CLOSE, (e) => {
    try {
      assertTrustedIpcSender(e)
    } catch {
      return
    }
    BrowserWindow.fromWebContents(e.sender)?.close()
  })
  ipcMain.on(IPC.APP_DO_CLOSE, (e) => {
    try {
      assertTrustedIpcSender(e)
    } catch {
      return
    }
    allowClose = true
    mainWindow?.close()
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null) // remove the default top-left application menu
  registerFileSystemHandlers(ipcMain, () => mainWindow)
  terminalManager.registerHandlers(ipcMain)
  registerAccountHandlers(ipcMain)
  registerAiLimitHandlers(ipcMain)
  registerWindowControls()
  registerUpdaterHandlers(ipcMain, () => mainWindow)
  createWindow()
  startAutoUpdateCheck(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  terminalManager.killAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  allowClose = true
  terminalManager.killAll()
})
