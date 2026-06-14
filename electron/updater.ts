import { app, type BrowserWindow, type IpcMain } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { IPC } from './ipcChannels'
import type { AppUpdateStatus } from '../src/updateTypes'

let currentStatus: AppUpdateStatus = {
  state: 'idle',
  message: 'Güncelleme hazır',
  version: app.getVersion()
}
let listenersRegistered = false

const percent = (value: number | undefined): number | undefined =>
  typeof value === 'number' ? Math.round(value) : undefined

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

function emitStatus(
  getWindow: () => BrowserWindow | null,
  status: AppUpdateStatus
): AppUpdateStatus {
  currentStatus = status
  const win = getWindow()
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send(IPC.UPDATE_STATUS, status)
  }
  return status
}

function describeVersion(info: UpdateInfo): string | undefined {
  return info.version || undefined
}

function registerAutoUpdaterEvents(getWindow: () => BrowserWindow | null): void {
  if (listenersRegistered) return
  listenersRegistered = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    emitStatus(getWindow, {
      state: 'checking',
      message: 'Güncelleme denetleniyor',
      version: app.getVersion()
    })
  })

  autoUpdater.on('update-available', (info) => {
    emitStatus(getWindow, {
      state: 'available',
      message: `Yeni sürüm bulundu: ${describeVersion(info) ?? 'bilinmiyor'}`,
      version: describeVersion(info)
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    emitStatus(getWindow, {
      state: 'not-available',
      message: 'Güncel sürümü kullanıyorsun',
      version: describeVersion(info) ?? app.getVersion()
    })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    emitStatus(getWindow, {
      state: 'downloading',
      message: `Güncelleme indiriliyor: %${percent(progress.percent) ?? 0}`,
      percent: percent(progress.percent),
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    emitStatus(getWindow, {
      state: 'downloaded',
      message: `Sürüm ${describeVersion(info) ?? 'güncelleme'} indirildi`,
      version: describeVersion(info)
    })
  })

  autoUpdater.on('error', (error) => {
    emitStatus(getWindow, {
      state: 'error',
      message: 'Güncelleme kontrolü başarısız',
      version: app.getVersion(),
      error: errorMessage(error)
    })
  })
}

export function registerUpdaterHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null
): void {
  registerAutoUpdaterEvents(getWindow)

  ipcMain.handle(IPC.UPDATE_GET_STATUS, () => currentStatus)

  ipcMain.handle(IPC.UPDATE_CHECK, async () => {
    if (!app.isPackaged) {
      return emitStatus(getWindow, {
        state: 'idle',
        message: 'Güncelleme kontrolü paketli sürümde çalışır',
        version: app.getVersion()
      })
    }

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      return emitStatus(getWindow, {
        state: 'error',
        message: 'Güncelleme kontrolü başarısız',
        version: app.getVersion(),
        error: errorMessage(error)
      })
    }

    return currentStatus
  })

  ipcMain.on(IPC.UPDATE_INSTALL, () => {
    if (currentStatus.state === 'downloaded') {
      autoUpdater.quitAndInstall(false, true)
    }
  })
}

export function startAutoUpdateCheck(getWindow: () => BrowserWindow | null): void {
  registerAutoUpdaterEvents(getWindow)
  if (!app.isPackaged) return
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      emitStatus(getWindow, {
        state: 'error',
        message: 'Güncelleme kontrolü başarısız',
        version: app.getVersion(),
        error: errorMessage(error)
      })
    })
  }, 4000)
}
