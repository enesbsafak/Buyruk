import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { IPC } from './ipcChannels'
import type { AppUpdateStatus } from '../src/updateTypes'
import type {
  AiLimitsOverview,
  AiLimitsRequest,
  DbActiveConnection,
  DbColumn,
  DbColumnDef,
  DbConnectResult,
  DbConnectionInput,
  DbIndex,
  DbResultSet,
  DbRowsResult,
  DbTable,
  GitOverview,
  SavedDbConnection
} from '../src/types'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
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

const api = {
  // ---- File system ----
  selectFolder: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.SELECT_FOLDER, defaultPath),
  createFolderDialog: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.CREATE_FOLDER_DIALOG, defaultPath),
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
  gitCommitDiff: (root: string, hash: string): Promise<string> =>
    ipcRenderer.invoke(IPC.GIT_COMMIT_DIFF, root, hash),
  gitFileSides: (
    root: string,
    filePath: string,
    oldPath?: string
  ): Promise<{ original: string; modified: string; binary: boolean }> =>
    ipcRenderer.invoke(IPC.GIT_FILE_SIDES, root, filePath, oldPath),
  gitFetch: (root: string): Promise<GitOverview> => ipcRenderer.invoke(IPC.GIT_FETCH, root),
  gitCommit: (root: string, message: string, paths: string[]): Promise<GitOverview> =>
    ipcRenderer.invoke(IPC.GIT_COMMIT, root, message, paths),
  gitPush: (root: string): Promise<GitOverview> => ipcRenderer.invoke(IPC.GIT_PUSH, root),
  gitPull: (root: string): Promise<GitOverview> => ipcRenderer.invoke(IPC.GIT_PULL, root),
  gitBranches: (root: string): Promise<{ current: string; branches: string[] }> =>
    ipcRenderer.invoke(IPC.GIT_BRANCHES, root),
  gitCheckout: (root: string, name: string): Promise<GitOverview> =>
    ipcRenderer.invoke(IPC.GIT_CHECKOUT, root, name),
  gitCreateBranch: (root: string, name: string): Promise<GitOverview> =>
    ipcRenderer.invoke(IPC.GIT_CREATE_BRANCH, root, name),
  gitClone: (options: {
    url: string
    parentDir: string
    folderName?: string
  }): Promise<{ path: string }> => ipcRenderer.invoke(IPC.GIT_CLONE, options),
  onGitCloneProgress: (callback: (message: string) => void): (() => void) => {
    const listener = (_e: unknown, message: string) => callback(message)
    ipcRenderer.on(IPC.GIT_CLONE_PROGRESS, listener)
    return () => ipcRenderer.removeListener(IPC.GIT_CLONE_PROGRESS, listener)
  },

  // ---- AI usage limits ----
  aiLimits: {
    get: (request?: AiLimitsRequest): Promise<AiLimitsOverview> =>
      ipcRenderer.invoke(IPC.AI_LIMITS_GET, request)
  },

  // ---- PostgreSQL panel ----
  db: {
    listConnections: (): Promise<SavedDbConnection[]> =>
      ipcRenderer.invoke(IPC.DB_LIST_CONNECTIONS),
    saveConnection: (input: DbConnectionInput, id?: string): Promise<SavedDbConnection[]> =>
      ipcRenderer.invoke(IPC.DB_SAVE_CONNECTION, input, id),
    deleteConnection: (id: string): Promise<SavedDbConnection[]> =>
      ipcRenderer.invoke(IPC.DB_DELETE_CONNECTION, id),
    connect: (payload: { savedId?: string; input?: DbConnectionInput }): Promise<DbConnectResult> =>
      ipcRenderer.invoke(IPC.DB_CONNECT, payload),
    disconnect: (connectionId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.DB_DISCONNECT, connectionId),
    activeConnections: (): Promise<DbActiveConnection[]> =>
      ipcRenderer.invoke(IPC.DB_ACTIVE_CONNECTIONS),
    listSchemas: (connectionId: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.DB_LIST_SCHEMAS, connectionId),
    listTables: (connectionId: string, schema: string): Promise<DbTable[]> =>
      ipcRenderer.invoke(IPC.DB_LIST_TABLES, connectionId, schema),
    getColumns: (connectionId: string, schema: string, table: string): Promise<DbColumn[]> =>
      ipcRenderer.invoke(IPC.DB_GET_COLUMNS, connectionId, schema, table),
    getIndexes: (connectionId: string, schema: string, table: string): Promise<DbIndex[]> =>
      ipcRenderer.invoke(IPC.DB_GET_INDEXES, connectionId, schema, table),
    getRows: (
      connectionId: string,
      schema: string,
      table: string,
      opts: { limit: number; offset: number; orderBy?: string | null; orderDir?: 'ASC' | 'DESC' }
    ): Promise<DbRowsResult> =>
      ipcRenderer.invoke(IPC.DB_GET_ROWS, connectionId, schema, table, opts),
    runQuery: (connectionId: string, sql: string): Promise<DbResultSet> =>
      ipcRenderer.invoke(IPC.DB_RUN_QUERY, connectionId, sql),
    insertRow: (
      connectionId: string,
      schema: string,
      table: string,
      values: Record<string, string | null>
    ): Promise<void> => ipcRenderer.invoke(IPC.DB_INSERT_ROW, connectionId, schema, table, values),
    updateRow: (
      connectionId: string,
      schema: string,
      table: string,
      pk: Record<string, string | null>,
      changes: Record<string, string | null>
    ): Promise<void> =>
      ipcRenderer.invoke(IPC.DB_UPDATE_ROW, connectionId, schema, table, pk, changes),
    deleteRow: (
      connectionId: string,
      schema: string,
      table: string,
      pk: Record<string, string | null>
    ): Promise<void> => ipcRenderer.invoke(IPC.DB_DELETE_ROW, connectionId, schema, table, pk),
    createTable: (
      connectionId: string,
      schema: string,
      name: string,
      columns: DbColumnDef[]
    ): Promise<void> =>
      ipcRenderer.invoke(IPC.DB_CREATE_TABLE, connectionId, schema, name, columns),
    dropTable: (connectionId: string, schema: string, table: string): Promise<void> =>
      ipcRenderer.invoke(IPC.DB_DROP_TABLE, connectionId, schema, table),
    truncateTable: (connectionId: string, schema: string, table: string): Promise<void> =>
      ipcRenderer.invoke(IPC.DB_TRUNCATE_TABLE, connectionId, schema, table),
    addColumn: (
      connectionId: string,
      schema: string,
      table: string,
      column: DbColumnDef
    ): Promise<void> => ipcRenderer.invoke(IPC.DB_ADD_COLUMN, connectionId, schema, table, column),
    dropColumn: (connectionId: string, schema: string, table: string, column: string): Promise<void> =>
      ipcRenderer.invoke(IPC.DB_DROP_COLUMN, connectionId, schema, table, column),
    createIndex: (
      connectionId: string,
      schema: string,
      table: string,
      input: { name: string; columns: string[]; unique: boolean }
    ): Promise<void> => ipcRenderer.invoke(IPC.DB_CREATE_INDEX, connectionId, schema, table, input),
    dropIndex: (connectionId: string, schema: string, name: string): Promise<void> =>
      ipcRenderer.invoke(IPC.DB_DROP_INDEX, connectionId, schema, name)
  },

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
