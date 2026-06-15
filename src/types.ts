export type TerminalType = 'cmd' | 'powershell' | 'claude' | 'codex' | 'opencode'

export interface TerminalSession {
  id: string
  type: TerminalType
  title: string
  cwd: string
  createdAt: number
  isActive: boolean
}

export interface CreateTerminalOptions {
  type: TerminalType
  cwd: string
  command: string
  cols?: number
  rows?: number
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

export interface OpenFile {
  path: string
  name: string
  content: string
  savedContent: string
  language: string
  isBinary: boolean
  isImage: boolean
  readOnly?: boolean
  dataUrl?: string
}

export type TerminalStatus = 'running' | 'exited'

// A live session in the renderer: the base session data plus UI/runtime state.
export interface SessionRuntime extends TerminalSession {
  status: TerminalStatus
  exitCode?: number
  // Bumped on restart; used as part of the pane key to force a fresh xterm.
  gen: number
  openFiles: OpenFile[]
  activeFilePath: string | null
}

export interface GitStatus {
  isRepo: boolean
  branch: string
  files: Record<string, string>
}

export interface GitChange {
  path: string
  absolutePath: string
  status: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
}

export interface GitCommit {
  hash: string
  author: string
  relativeDate: string
  subject: string
  refs: string
}

export interface GitRemoteActivity {
  name: string
  hash: string
  relativeDate: string
  author: string
  subject: string
}

export interface GitOverview {
  isRepo: boolean
  root: string
  branch: string
  upstream: string
  ahead: number
  behind: number
  stashCount: number
  changes: GitChange[]
  recentCommits: GitCommit[]
  remoteActivity: GitRemoteActivity[]
  lastUpdated: number
}

export type ThemeName = 'dark' | 'light'

export interface Settings {
  cmdCommand: string
  powershellCommand: string
  claudeCommand: string
  codexCommand: string
  opencodeCommand: string
  hiddenFolders: string[]
  terminalFont: string
  terminalFontSize: number
  theme: ThemeName
}
