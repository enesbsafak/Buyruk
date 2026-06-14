import {
  dialog,
  shell,
  clipboard,
  type BrowserWindow,
  type IpcMain,
  type OpenDialogOptions
} from 'electron'
import fs from 'node:fs/promises'
import { watch as fsWatch, type FSWatcher } from 'node:fs'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { IPC } from './ipcChannels'

function execGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => resolve(err ? '' : stdout)
    )
  })
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

const MAX_TEXT_SIZE = 5 * 1024 * 1024 // 5 MB
const BINARY_SNIFF_BYTES = 8000
const GIT_RENAME_ARROW = /^.* -> (.*)$/

// A NUL byte in the first chunk is a reliable, cheap "this is binary" heuristic.
function looksBinary(buffer: Buffer): boolean {
  const len = Math.min(buffer.length, BINARY_SNIFF_BYTES)
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

export function registerFileSystemHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(IPC.SELECT_FOLDER, async () => {
    const win = getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Klasör seç',
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({
          title: 'Klasör seç',
          properties: ['openDirectory', 'createDirectory']
        })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Pick a parent directory; the renderer then asks for a name and calls createFolder.
  ipcMain.handle(IPC.CREATE_FOLDER_DIALOG, async () => {
    const win = getWindow()
    const opts: OpenDialogOptions = {
      title: 'Yeni klasör için konum seç',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.READ_DIR, async (_e, dirPath: string): Promise<FileNode[]> => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory()
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
  })

  ipcMain.handle(
    IPC.READ_FILE,
    async (_e, filePath: string): Promise<{ content: string; isBinary: boolean }> => {
      const buffer = await fs.readFile(filePath)
      if (buffer.length > MAX_TEXT_SIZE || looksBinary(buffer)) {
        return { content: '', isBinary: true }
      }
      return { content: buffer.toString('utf8'), isBinary: false }
    }
  )

  ipcMain.handle(IPC.READ_FILE_BASE64, async (_e, filePath: string): Promise<string> => {
    const mimeByExt: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.avif': 'image/avif'
    }
    const mime = mimeByExt[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    const buffer = await fs.readFile(filePath)
    return `data:${mime};base64,${buffer.toString('base64')}`
  })

  ipcMain.handle(IPC.WRITE_FILE, async (_e, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf8')
  })

  ipcMain.handle(IPC.CREATE_FILE, async (_e, filePath: string) => {
    // 'wx' fails if the file already exists, so we never clobber existing data.
    await fs.writeFile(filePath, '', { flag: 'wx' })
  })

  ipcMain.handle(IPC.CREATE_FOLDER, async (_e, dirPath: string) => {
    await fs.mkdir(dirPath, { recursive: true })
  })

  ipcMain.handle(IPC.DELETE_PATH, async (_e, targetPath: string) => {
    await fs.rm(targetPath, { recursive: true, force: true })
  })

  ipcMain.handle(IPC.RENAME_PATH, async (_e, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath)
  })

  // ---- Watch the active workspace and notify the renderer on changes ----
  let watcher: FSWatcher | null = null
  let watchTimer: NodeJS.Timeout | null = null
  ipcMain.handle(IPC.WATCH_DIR, (_e, dirPath: string | null) => {
    if (watcher) {
      try {
        watcher.close()
      } catch {
        // ignore
      }
      watcher = null
    }
    if (!dirPath) return
    try {
      watcher = fsWatch(dirPath, { recursive: true }, (_event, filename) => {
        const name = String(filename ?? '')
        // Ignore churn from heavy/irrelevant folders.
        if (/(^|[\\/])(node_modules|\.git)([\\/]|$)/.test(name)) return
        if (watchTimer) clearTimeout(watchTimer)
        watchTimer = setTimeout(() => {
          const win = getWindow()
          if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
            win.webContents.send(IPC.FS_CHANGED)
          }
        }, 300)
      })
    } catch {
      // directory may not exist / be watchable
    }
  })

  ipcMain.handle(IPC.REVEAL_PATH, (_e, targetPath: string) => {
    shell.showItemInFolder(targetPath)
  })

  ipcMain.handle(IPC.COPY_TEXT, (_e, text: string) => {
    clipboard.writeText(text)
  })

  // Flat recursive file list for quick-open (skips hidden folders, capped).
  ipcMain.handle(
    IPC.LIST_FILES,
    async (_e, root: string, hidden: string[]): Promise<string[]> => {
      const hiddenSet = new Set(hidden.map((h) => h.toLowerCase()))
      const out: string[] = []
      const MAX = 8000
      const walk = async (dir: string): Promise<void> => {
        if (out.length >= MAX) return
        let entries
        try {
          entries = await fs.readdir(dir, { withFileTypes: true })
        } catch {
          return
        }
        const childDirs: string[] = []
        for (const entry of entries) {
          if (out.length >= MAX) return
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (hiddenSet.has(entry.name.toLowerCase())) continue
            childDirs.push(full)
          } else {
            out.push(full)
          }
        }
        await Promise.all(childDirs.map((childDir) => walk(childDir)))
      }
      await walk(root)
      return out
    }
  )

  // Git status for the workspace: branch + per-file status codes (abs path keys).
  ipcMain.handle(
    IPC.GIT_STATUS,
    async (
      _e,
      root: string
    ): Promise<{ isRepo: boolean; branch: string; files: Record<string, string> }> => {
      const branch = (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], root)).trim()
      if (!branch) return { isRepo: false, branch: '', files: {} }
      const porcelain = await execGit(['status', '--porcelain'], root)
      const files: Record<string, string> = {}
      for (const line of porcelain.split('\n')) {
        if (!line.trim()) continue
        const code = line.slice(0, 2).trim()
        let file = line.slice(3)
        file = GIT_RENAME_ARROW.exec(file)?.[1] ?? file
        file = file.replace(/^"|"$/g, '')
        files[path.join(root, file).toLowerCase()] = code
      }
      return { isRepo: true, branch, files }
    }
  )
}
