import { app, type BrowserWindow, type IpcMain } from 'electron'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import log from 'electron-log/main'
import { IPC } from './ipcChannels'
import type { AppUpdateStatus } from '../src/updateTypes'

const UPDATER_CACHE_DIR = 'buyruk-updater'

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

const shortErrorMessage = (error: unknown): string => {
  const message = errorMessage(error)
  return message.length > 120 ? `${message.slice(0, 117)}...` : message
}

async function clearUpdaterCache(reason: string): Promise<void> {
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return

  const cacheDir = path.join(localAppData, UPDATER_CACHE_DIR)
  if (path.basename(cacheDir) !== UPDATER_CACHE_DIR) return

  try {
    await rm(cacheDir, { recursive: true, force: true })
    log.info(`[updater] Cache temizlendi (${reason}): ${cacheDir}`)
  } catch (error) {
    log.warn('[updater] Cache temizlenemedi', error)
  }
}

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

  autoUpdater.logger = log
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
    log.error('[updater] Hata', error)
    emitStatus(getWindow, {
      state: 'error',
      message: `Güncelleme hatası: ${shortErrorMessage(error)}`,
      version: app.getVersion(),
      error: errorMessage(error)
    })
  })
}

async function checkForUpdatesWithCacheRetry(
  getWindow: () => BrowserWindow | null
): Promise<AppUpdateStatus> {
  await clearUpdaterCache('kontrol öncesi')

  try {
    await autoUpdater.checkForUpdates()
    return currentStatus
  } catch (firstError) {
    log.warn('[updater] İlk kontrol başarısız, cache temizlenip tekrar denenecek', firstError)
    await clearUpdaterCache('hata sonrası retry')

    try {
      await autoUpdater.checkForUpdates()
      return currentStatus
    } catch (secondError) {
      return emitStatus(getWindow, {
        state: 'error',
        message: `Güncelleme hatası: ${shortErrorMessage(secondError)}`,
        version: app.getVersion(),
        error: errorMessage(secondError)
      })
    }
  }
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

    return checkForUpdatesWithCacheRetry(getWindow)
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
    checkForUpdatesWithCacheRetry(getWindow).catch((error) => {
      emitStatus(getWindow, {
        state: 'error',
        message: `Güncelleme hatası: ${shortErrorMessage(error)}`,
        version: app.getVersion(),
        error: errorMessage(error)
      })
    })
  }, 4000)
}
