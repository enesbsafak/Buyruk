import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { IPC } from './ipcChannels'
import type { AppUpdateStatus } from '../src/updateTypes'
import type { GitOverview } from '../src/types'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

export type TerminalType = 'cmd' | 'powershell' | 'claude' | 'codex' | 'opencode'

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

const api = {
  // ---- File system ----
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.SELECT_FOLDER),
  createFolderDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.CREATE_FOLDER_DIALOG),
  readDir: (p: string): Promise<FileNode[]> => ipcRenderer.invoke(IPC.READ_DIR, p),
  readFile: (p: string): Promise<{ content: string; isBinary: boolean }> =>
    ipcRenderer.invoke(IPC.READ_FILE, p),
  readFileBase64: (p: string): Promise<string> =>
    ipcRenderer.invoke(IPC.READ_FILE_BASE64, p),
  writeFile: (p: string, content: string): Promise<void> =>
    ipcRenderer.invoke(IPC.WRITE_FILE, p, content),
  createFile: (p: string): Promise<void> => ipcRenderer.invoke(IPC.CREATE_FILE, p),
  createFolder: (p: string): Promise<void> => ipcRenderer.invoke(IPC.CREATE_FOLDER, p),
  deletePath: (p: string): Promise<void> => ipcRenderer.invoke(IPC.DELETE_PATH, p),
  renamePath: (oldPath: string, newPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.RENAME_PATH, oldPath, newPath),
  watchDir: (p: string | null): Promise<void> => ipcRenderer.invoke(IPC.WATCH_DIR, p),
  onFsChanged: (callback: () => void): (() => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC.FS_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.FS_CHANGED, listener)
  },
  revealPath: (p: string): Promise<void> => ipcRenderer.invoke(IPC.REVEAL_PATH, p),
  copyText: (text: string): Promise<void> => ipcRenderer.invoke(IPC.COPY_TEXT, text),
  listFiles: (root: string, hidden: string[]): Promise<string[]> =>
    ipcRenderer.invoke(IPC.LIST_FILES, root, hidden),
  gitStatus: (
    root: string
  ): Promise<{ isRepo: boolean; branch: string; files: Record<string, string> }> =>
    ipcRenderer.invoke(IPC.GIT_STATUS, root),
  gitOverview: (root: string): Promise<GitOverview> =>
    ipcRenderer.invoke(IPC.GIT_OVERVIEW, root),
  gitDiff: (root: string, filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.GIT_DIFF, root, filePath),
  gitFetch: (root: string): Promise<GitOverview> => ipcRenderer.invoke(IPC.GIT_FETCH, root),

  // ---- Clipboard ----
  clipboardReadText: (): string => clipboard.readText(),
  clipboardHasImage: (): boolean => !clipboard.readImage().isEmpty(),

  // ---- Terminal ----
  createTerminal: (options: CreateTerminalOptions): Promise<TerminalSession> =>
    ipcRenderer.invoke(IPC.CREATE_TERMINAL, options),
  restartTerminal: (payload: CreateTerminalOptions & { id: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.RESTART_TERMINAL, payload),
  writeTerminal: (id: string, data: string): void =>
    ipcRenderer.send(IPC.WRITE_TERMINAL, id, data),
  resizeTerminal: (id: string, cols: number, rows: number): void =>
    ipcRenderer.send(IPC.RESIZE_TERMINAL, id, cols, rows),
  killTerminal: (id: string): Promise<void> => ipcRenderer.invoke(IPC.KILL_TERMINAL, id),

  onTerminalData: (callback: (id: string, data: string) => void): (() => void) => {
    const listener = (_e: unknown, id: string, data: string) => callback(id, data)
    ipcRenderer.on(IPC.TERMINAL_DATA, listener)
    return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA, listener)
  },
  onTerminalExit: (callback: (id: string, exitCode: number) => void): (() => void) => {
    const listener = (_e: unknown, id: string, exitCode: number) => callback(id, exitCode)
    ipcRenderer.on(IPC.TERMINAL_EXIT, listener)
    return () => ipcRenderer.removeListener(IPC.TERMINAL_EXIT, listener)
  },

  // ---- Window controls (custom title bar) ----
  windowControls: {
    minimize: (): void => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    maximizeToggle: (): void => ipcRenderer.send(IPC.WINDOW_MAXIMIZE_TOGGLE),
    close: (): void => ipcRenderer.send(IPC.WINDOW_CLOSE),
    onMaximizedChange: (callback: (maximized: boolean) => void): (() => void) => {
      const listener = (_e: unknown, maximized: boolean) => callback(maximized)
      ipcRenderer.on(IPC.WINDOW_MAXIMIZED, listener)
      return () => ipcRenderer.removeListener(IPC.WINDOW_MAXIMIZED, listener)
    },
    onConfirmClose: (callback: () => void): (() => void) => {
      const listener = () => callback()
      ipcRenderer.on(IPC.APP_CONFIRM_CLOSE, listener)
      return () => ipcRenderer.removeListener(IPC.APP_CONFIRM_CLOSE, listener)
    },
    doClose: (): void => ipcRenderer.send(IPC.APP_DO_CLOSE)
  },

  // ---- Auto update ----
  updates: {
    getStatus: (): Promise<AppUpdateStatus> => ipcRenderer.invoke(IPC.UPDATE_GET_STATUS),
    check: (): Promise<AppUpdateStatus> => ipcRenderer.invoke(IPC.UPDATE_CHECK),
    install: (): void => ipcRenderer.send(IPC.UPDATE_INSTALL),
    onStatus: (callback: (status: AppUpdateStatus) => void): (() => void) => {
      const listener = (_e: unknown, status: AppUpdateStatus) => callback(status)
      ipcRenderer.on(IPC.UPDATE_STATUS, listener)
      return () => ipcRenderer.removeListener(IPC.UPDATE_STATUS, listener)
    }
  }
}

export type MultiCliApi = typeof api

contextBridge.exposeInMainWorld('api', api)
