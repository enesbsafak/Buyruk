import type {
  CreateTerminalOptions,
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
  FileNode,
  GitBranches,
  GitFileSides,
  GitOverview,
  SavedDbConnection,
  TerminalSession
} from './types'
import type { AppUpdateStatus } from './updateTypes'

declare global {
  interface Window {
    api: {
      // File system
      selectFolder(defaultPath?: string): Promise<string | null>
      createFolderDialog(defaultPath?: string): Promise<string | null>
      readDir(path: string): Promise<FileNode[]>
      readFile(path: string): Promise<{ content: string; isBinary: boolean }>
      readFileBase64(path: string): Promise<string>
      writeFile(path: string, content: string): Promise<void>
      createFile(path: string): Promise<void>
      createFolder(path: string): Promise<void>
      deletePath(path: string): Promise<void>
      renamePath(oldPath: string, newPath: string): Promise<void>
      watchDir(path: string | null): Promise<void>
      onFsChanged(callback: () => void): () => void
      revealPath(path: string): Promise<void>
      copyText(text: string): Promise<void>
      listFiles(root: string, hidden: string[]): Promise<string[]>
      gitStatus(
        root: string
      ): Promise<{ isRepo: boolean; branch: string; files: Record<string, string> }>
      gitOverview(root: string): Promise<GitOverview>
      gitDiff(root: string, filePath: string): Promise<string>
      gitCommitDiff(root: string, hash: string): Promise<string>
      gitFileSides(root: string, filePath: string, oldPath?: string): Promise<GitFileSides>
      gitFetch(root: string): Promise<GitOverview>
      gitCommit(root: string, message: string, paths: string[]): Promise<GitOverview>
      gitPush(root: string): Promise<GitOverview>
      gitPull(root: string): Promise<GitOverview>
      gitBranches(root: string): Promise<GitBranches>
      gitCheckout(root: string, name: string): Promise<GitOverview>
      gitCreateBranch(root: string, name: string): Promise<GitOverview>

      // AI usage limits
      aiLimits: {
        get(request?: AiLimitsRequest): Promise<AiLimitsOverview>
      }

      // PostgreSQL panel
      db: {
        listConnections(): Promise<SavedDbConnection[]>
        saveConnection(input: DbConnectionInput, id?: string): Promise<SavedDbConnection[]>
        deleteConnection(id: string): Promise<SavedDbConnection[]>
        connect(payload: { savedId?: string; input?: DbConnectionInput }): Promise<DbConnectResult>
        disconnect(connectionId: string): Promise<void>
        activeConnections(): Promise<DbActiveConnection[]>
        listSchemas(connectionId: string): Promise<string[]>
        listTables(connectionId: string, schema: string): Promise<DbTable[]>
        getColumns(connectionId: string, schema: string, table: string): Promise<DbColumn[]>
        getIndexes(connectionId: string, schema: string, table: string): Promise<DbIndex[]>
        getRows(
          connectionId: string,
          schema: string,
          table: string,
          opts: { limit: number; offset: number; orderBy?: string | null; orderDir?: 'ASC' | 'DESC' }
        ): Promise<DbRowsResult>
        runQuery(connectionId: string, sql: string): Promise<DbResultSet>
        insertRow(
          connectionId: string,
          schema: string,
          table: string,
          values: Record<string, string | null>
        ): Promise<void>
        updateRow(
          connectionId: string,
          schema: string,
          table: string,
          pk: Record<string, string | null>,
          changes: Record<string, string | null>
        ): Promise<void>
        deleteRow(
          connectionId: string,
          schema: string,
          table: string,
          pk: Record<string, string | null>
        ): Promise<void>
        createTable(
          connectionId: string,
          schema: string,
          name: string,
          columns: DbColumnDef[]
        ): Promise<void>
        dropTable(connectionId: string, schema: string, table: string): Promise<void>
        truncateTable(connectionId: string, schema: string, table: string): Promise<void>
        addColumn(connectionId: string, schema: string, table: string, column: DbColumnDef): Promise<void>
        dropColumn(connectionId: string, schema: string, table: string, column: string): Promise<void>
        createIndex(
          connectionId: string,
          schema: string,
          table: string,
          input: { name: string; columns: string[]; unique: boolean }
        ): Promise<void>
        dropIndex(connectionId: string, schema: string, name: string): Promise<void>
      }
      gitClone(options: {
        url: string
        parentDir: string
        folderName?: string
      }): Promise<{ path: string }>
      onGitCloneProgress(callback: (message: string) => void): () => void

      // Clipboard
      clipboardReadText(): string
      clipboardHasImage(): boolean

      // Terminal
      createTerminal(options: CreateTerminalOptions): Promise<TerminalSession>
      restartTerminal(payload: CreateTerminalOptions & { id: string }): Promise<void>
      writeTerminal(id: string, data: string): void
      resizeTerminal(id: string, cols: number, rows: number): void
      killTerminal(id: string): Promise<void>
      onTerminalData(callback: (id: string, data: string) => void): () => void
      onTerminalExit(callback: (id: string, exitCode: number) => void): () => void

      // Window controls
      windowControls: {
        minimize(): void
        maximizeToggle(): void
        close(): void
        onMaximizedChange(callback: (maximized: boolean) => void): () => void
        onConfirmClose(callback: () => void): () => void
        doClose(): void
      }

      // Auto update
      updates: {
        getStatus(): Promise<AppUpdateStatus>
        check(): Promise<AppUpdateStatus>
        install(): void
        onStatus(callback: (status: AppUpdateStatus) => void): () => void
      }
    }
  }
}

export {}
