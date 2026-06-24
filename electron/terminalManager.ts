import { type BrowserWindow, type IpcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type * as PtyType from 'node-pty'
import { IPC } from './ipcChannels'
import { assertTrustedIpcSender, assertWorkspaceRoot } from './security'

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

export type TerminalType = 'cmd' | 'powershell' | 'claude' | 'codex' | 'opencode' | 'antigravity'

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
  codex: 'Codex',
  opencode: 'OpenCode',
  antigravity: 'Antigravity'
}
const TERMINAL_TYPES = new Set<TerminalType>([
  'cmd',
  'powershell',
  'claude',
  'codex',
  'opencode',
  'antigravity'
])
const DEFAULT_COMMAND: Record<TerminalType, string> = {
  cmd: 'cmd.exe',
  powershell: 'powershell.exe',
  claude: 'claude',
  codex: 'codex',
  opencode: 'opencode',
  antigravity: 'agy'
}
const MAX_COMMAND_LENGTH = 2048
const MAX_TERMINAL_DIMENSION = 500

function clampDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(MAX_TERMINAL_DIMENSION, Math.floor(value!)))
}

export class TerminalManager {
  private terminals = new Map<string, PtyType.IPty>()
  private writeQueues = new Map<string, string[]>()
  private writeTimers = new Map<string, NodeJS.Timeout>()
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
    const handle = (
      channel: string,
      listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown
    ): void => {
      ipcMain.handle(channel, async (event, ...args) => {
        assertTrustedIpcSender(event)
        return listener(event, ...args)
      })
    }
    const on = (
      channel: string,
      listener: (event: IpcMainEvent, ...args: any[]) => void
    ): void => {
      ipcMain.on(channel, (event, ...args) => {
        try {
          assertTrustedIpcSender(event)
        } catch {
          return
        }
        listener(event, ...args)
      })
    }

    handle(IPC.CREATE_TERMINAL, (_e, options: CreateTerminalOptions) =>
      this.create(options)
    )
    handle(
      IPC.RESTART_TERMINAL,
      (_e, payload: CreateTerminalOptions & { id: string }) =>
        this.restart(payload.id, payload)
    )
    on(IPC.WRITE_TERMINAL, (_e, id: string, data: string) => this.write(id, data))
    on(IPC.RESIZE_TERMINAL, (_e, id: string, cols: number, rows: number) =>
      this.resize(id, cols, rows)
    )
    handle(IPC.KILL_TERMINAL, (_e, id: string) => this.kill(id))
  }

  private normalizeOptions(options: CreateTerminalOptions): CreateTerminalOptions {
    if (!options || !TERMINAL_TYPES.has(options.type)) {
      throw new Error('Geçersiz terminal türü')
    }
    const fallbackCommand = DEFAULT_COMMAND[options.type]
    const command = typeof options.command === 'string' ? options.command.trim() : fallbackCommand
    if (command.length > MAX_COMMAND_LENGTH || /[\r\n\0]/.test(command)) {
      throw new Error('Geçersiz terminal komutu')
    }
    return {
      ...options,
      cwd: assertWorkspaceRoot(options.cwd),
      command: command || fallbackCommand,
      cols: clampDimension(options.cols, 80),
      rows: clampDimension(options.rows, 24)
    }
  }

  // Decide which executable + args to spawn for each session type.
  // cmd/powershell are launched directly. AI CLIs are launched *inside* cmd.exe
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
        return { file: comspec, args: ['/k', options.command || 'claude'] }
      case 'codex':
      case 'opencode':
      case 'antigravity':
        return { file: comspec, args: ['/k', options.command] }
      default:
        return { file: comspec, args: [] }
    }
  }

  private async spawnPty(id: string, options: CreateTerminalOptions): Promise<void> {
    const pty = await getPty()
    const { file, args } = this.resolveShell(options)

    const env = { ...(process.env as Record<string, string>) }

    const ptyProcess = pty.spawn(file, args, {
      name: 'xterm-color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
      env
    })

    this.terminals.set(id, ptyProcess)

    ptyProcess.onData((data) => {
      this.post(IPC.TERMINAL_DATA, id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.post(IPC.TERMINAL_EXIT, id, exitCode)
      this.clearWriteQueue(id)
      this.terminals.delete(id)
    })
  }

  // Title format: "Claude · projem".
  private buildTitle(options: CreateTerminalOptions): string {
    return `${TYPE_LABEL[options.type]} · ${path.basename(options.cwd)}`
  }

  private async create(options: CreateTerminalOptions): Promise<TerminalSession> {
    const safeOptions = this.normalizeOptions(options)
    const id = randomUUID()
    await this.spawnPty(id, safeOptions)
    return {
      id,
      type: safeOptions.type,
      title: this.buildTitle(safeOptions),
      cwd: safeOptions.cwd,
      createdAt: Date.now(),
      isActive: true
    }
  }

  // Re-spawn a pty under the same id (used to revive an exited terminal in place).
  private async restart(id: string, options: CreateTerminalOptions): Promise<void> {
    const safeOptions = this.normalizeOptions(options)
    const existing = this.terminals.get(id)
    if (existing) {
      try {
        existing.kill()
      } catch {
        // already gone
      }
      this.terminals.delete(id)
    }
    await this.spawnPty(id, safeOptions)
  }

  private write(id: string, data: string): void {
    const term = this.terminals.get(id)
    if (!term) return
    const activeQueue = this.writeQueues.get(id)
    if (!activeQueue && data.length <= 1024) {
      term.write(data)
      return
    }

    const queue = activeQueue ?? []
    queue.push(...this.chunkWrite(data))
    this.writeQueues.set(id, queue)
    this.flushWriteQueue(id)
  }

  private chunkWrite(data: string): string[] {
    const chunks: string[] = []
    let current = ''
    for (const char of data) {
      if (current.length + char.length > 1024) {
        chunks.push(current)
        current = ''
      }
      current += char
    }
    if (current) chunks.push(current)
    return chunks
  }

  private flushWriteQueue(id: string): void {
    if (this.writeTimers.has(id)) return
    const queue = this.writeQueues.get(id)
    if (!queue || queue.length === 0) {
      this.writeQueues.delete(id)
      return
    }

    const tick = () => {
      const term = this.terminals.get(id)
      const currentQueue = this.writeQueues.get(id)
      if (!term || !currentQueue || currentQueue.length === 0) {
        this.clearWriteQueue(id)
        return
      }

      const next = currentQueue.shift()
      if (next) term.write(next)

      if (currentQueue.length === 0) {
        this.clearWriteQueue(id)
        return
      }

      this.writeTimers.set(id, setTimeout(tick, 2))
    }

    this.writeTimers.set(id, setTimeout(tick, 0))
  }

  private clearWriteQueue(id: string): void {
    const timer = this.writeTimers.get(id)
    if (timer) clearTimeout(timer)
    this.writeTimers.delete(id)
    this.writeQueues.delete(id)
  }

  private resize(id: string, cols: number, rows: number): void {
    const term = this.terminals.get(id)
    if (!term) return
    try {
      term.resize(clampDimension(cols, 80), clampDimension(rows, 24))
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
    this.clearWriteQueue(id)
    this.terminals.delete(id)
  }

  killAll(): void {
    for (const [id, term] of this.terminals) {
      try {
        term.kill()
      } catch {
        // ignore
      }
      this.clearWriteQueue(id)
    }
    this.terminals.clear()
  }
}
