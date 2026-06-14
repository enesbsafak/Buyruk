import type {
  CreateTerminalOptions,
  FileNode,
  TerminalSession
} from './types'
import type { AppUpdateStatus } from './updateTypes'

declare global {
  interface Window {
    api: {
      // File system
      selectFolder(): Promise<string | null>
      createFolderDialog(): Promise<string | null>
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
      gitDiff(root: string, filePath: string): Promise<string>

      // Clipboard
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
