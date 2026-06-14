import { type BrowserWindow, type IpcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type * as PtyType from 'node-pty'
import { IPC } from './ipcChannels'

// Load node-pty lazily so the app still launches (and shows its UI) even when the
// native binary hasn't been compiled yet. Errors only surface when a terminal is
// actually created, as a clear message instead of a startup crash.
let ptyLib: typeof PtyType | null = null
async function getPty(): Promise<typeof PtyType> {
  if (!ptyLib) {
    try {
      ptyLib = await import('node-pty')
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new Error(
        'node-pty yüklenemedi. Native modül derlenmemiş olabilir ' +
          '(Visual Studio C++ Build Tools + Python gerekli, ardından `npm install`). ' +
          `Detay: ${detail}`
      )
    }
  }
  return ptyLib
}

export type TerminalType = 'cmd' | 'powershell' | 'claude' | 'codex'

export interface CreateTerminalOptions {
  type: TerminalType
  cwd: string
  command: string
  cols?: number
  rows?: number
}

export interface TerminalSession {
  id: string
  type: TerminalType
  title: string
  cwd: string
  createdAt: number
  isActive: boolean
}

const TYPE_LABEL: Record<TerminalType, string> = {
  cmd: 'CMD',
  powershell: 'PowerShell',
  claude: 'Claude',
  codex: 'Codex'
}

export class TerminalManager {
  private terminals = new Map<string, PtyType.IPty>()
  private window: BrowserWindow | null = null

  attachWindow(win: BrowserWindow): void {
    this.window = win
  }

  detachWindow(): void {
    this.window = null
  }

  // Safely send to the renderer: the window/webContents can be destroyed while
  // a pty is still flushing data on shutdown (otherwise: "Object has been destroyed").
  private post(channel: string, ...args: unknown[]): void {
    const win = this.window
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return
    try {
      win.webContents.send(channel, ...args)
    } catch {
      // window torn down mid-send; ignore
    }
  }

  registerHandlers(ipcMain: IpcMain): void {
    ipcMain.handle(IPC.CREATE_TERMINAL, (_e, options: CreateTerminalOptions) =>
      this.create(options)
    )
    ipcMain.handle(
      IPC.RESTART_TERMINAL,
      (_e, payload: CreateTerminalOptions & { id: string }) =>
        this.restart(payload.id, payload)
    )
    ipcMain.on(IPC.WRITE_TERMINAL, (_e, id: string, data: string) => this.write(id, data))
    ipcMain.on(IPC.RESIZE_TERMINAL, (_e, id: string, cols: number, rows: number) =>
      this.resize(id, cols, rows)
    )
    ipcMain.handle(IPC.KILL_TERMINAL, (_e, id: string) => this.kill(id))
  }

  // Decide which executable + args to spawn for each session type.
  // cmd/powershell are launched directly. claude/codex are launched *inside* cmd.exe
  // with /k so that (a) PATH-resolved shims (.cmd) work, and (b) the terminal stays
  // alive after the CLI exits, and (c) "not recognized" errors are visible to the user.
  private resolveShell(options: CreateTerminalOptions): { file: string; args: string[] } {
    const comspec = process.env.ComSpec || 'cmd.exe'
    switch (options.type) {
      case 'cmd':
        return { file: options.command || 'cmd.exe', args: [] }
      case 'powershell':
        return { file: options.command || 'powershell.exe', args: [] }
      case 'claude':
      case 'codex':
        return { file: comspec, args: ['/k', options.command] }
      default:
        return { file: comspec, args: [] }
    }
  }

  private async spawnPty(id: string, options: CreateTerminalOptions): Promise<void> {
    const pty = await getPty()
    const { file, args } = this.resolveShell(options)

    const ptyProcess = pty.spawn(file, args, {
      name: 'xterm-color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
      env: process.env as Record<string, string>
    })

    this.terminals.set(id, ptyProcess)

    ptyProcess.onData((data) => {
      this.post(IPC.TERMINAL_DATA, id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.post(IPC.TERMINAL_EXIT, id, exitCode)
      this.terminals.delete(id)
    })
  }

  private async create(options: CreateTerminalOptions): Promise<TerminalSession> {
    const id = randomUUID()
    await this.spawnPty(id, options)
    return {
      id,
      type: options.type,
      title: `${TYPE_LABEL[options.type]} · ${path.basename(options.cwd)}`,
      cwd: options.cwd,
      createdAt: Date.now(),
      isActive: true
    }
  }

  // Re-spawn a pty under the same id (used to revive an exited terminal in place).
  private async restart(id: string, options: CreateTerminalOptions): Promise<void> {
    const existing = this.terminals.get(id)
    if (existing) {
      try {
        existing.kill()
      } catch {
        // already gone
      }
      this.terminals.delete(id)
    }
    await this.spawnPty(id, options)
  }

  private write(id: string, data: string): void {
    this.terminals.get(id)?.write(data)
  }

  private resize(id: string, cols: number, rows: number): void {
    const term = this.terminals.get(id)
    if (!term) return
    try {
      term.resize(Math.max(1, cols), Math.max(1, rows))
    } catch {
      // Resizing a process that just exited can throw; ignore.
    }
  }

  private kill(id: string): void {
    const term = this.terminals.get(id)
    if (!term) return
    try {
      term.kill()
    } catch {
      // already gone
    }
    this.terminals.delete(id)
  }

  killAll(): void {
    for (const term of this.terminals.values()) {
      try {
        term.kill()
      } catch {
        // ignore
      }
    }
    this.terminals.clear()
  }
}
