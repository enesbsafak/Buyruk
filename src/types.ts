export type TerminalType = 'cmd' | 'powershell' | 'claude' | 'codex' | 'opencode' | 'antigravity'

// CLI types with AI-specific behavior (used by aiLimits and CLI-type logic).
export type CliKind = 'claude' | 'codex' | 'opencode' | 'antigravity'

export type AiLimitTool = 'codex' | 'claude' | 'opencode' | 'antigravity'
export type AiLimitStatus = 'ready' | 'unavailable' | 'error'
export type AiLimitSource = 'global' | 'none'

export interface AiLimitWindow {
  id: string
  label: string
  usedPercent: number
  remainingPercent: number
  periodDurationMs: number | null
  resetsAt: number | null
}

export interface AiLimitMetric {
  label: string
  value: string
}

export interface AiToolLimit {
  tool: AiLimitTool
  label: string
  status: AiLimitStatus
  detail: string
  windows: AiLimitWindow[]
  metrics: AiLimitMetric[]
  updatedAt: number | null
  planType?: string | null
  source: AiLimitSource
}

export interface AiLimitsOverview {
  tools: AiToolLimit[]
  lastUpdated: number
}

export interface AiLimitsRequest {
  force?: boolean
}

export function isCliKind(type: TerminalType): type is CliKind {
  return type === 'claude' || type === 'codex' || type === 'opencode' || type === 'antigravity'
}

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
  // When set, this tab is a read-only side-by-side diff: diffOriginal is the
  // left (HEAD) side and `content` is the right (working tree) side.
  diffOriginal?: string
}

export interface GitBranches {
  current: string
  branches: string[]
}

export interface GitFileSides {
  original: string
  modified: string
  binary: boolean
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
  oldPath?: string
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

// ---- PostgreSQL panel ----

// Full connection details. `password` only ever travels renderer → main; it is
// stored encrypted (safeStorage) and never returned to the renderer.
export interface DbConnectionInput {
  label: string
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl: boolean
}

// A saved connection as exposed to the renderer — never includes the password.
export interface SavedDbConnection {
  id: string
  label: string
  host: string
  port: number
  database: string
  user: string
  ssl: boolean
  hasPassword: boolean
}

// Result of opening a live connection. `connectionId` is a runtime handle used
// for all subsequent queries.
export interface DbConnectResult {
  connectionId: string
  serverVersion: string
  database: string
  user: string
  host: string
}

export interface DbActiveConnection {
  connectionId: string
  label: string
  database: string
  user: string
  host: string
}

export interface DbColumn {
  name: string
  dataType: string
  nullable: boolean
  default: string | null
  isPrimaryKey: boolean
}

export interface DbIndex {
  name: string
  definition: string
  isPrimary: boolean
  isUnique: boolean
}

export interface DbTable {
  schema: string
  name: string
  kind: 'table' | 'view'
  estimatedRows: number | null
}

// A generic result set (SQL console / table browse). `rows` is row-major: each
// row is an array aligned to `columns`. Values are JSON-serialized for display.
export interface DbResultSet {
  columns: string[]
  rows: (string | null)[][]
  rowCount: number
  command: string
  durationMs: number
}

export interface DbRowsResult extends DbResultSet {
  total: number
  primaryKey: string[]
}

// One column definition used by the create-table / add-column DDL forms.
export interface DbColumnDef {
  name: string
  dataType: string
  nullable: boolean
  default: string
  primaryKey: boolean
}

export type ThemeName = 'dark' | 'light'

export interface Settings {
  cmdCommand: string
  powershellCommand: string
  claudeCommand: string
  codexCommand: string
  opencodeCommand: string
  antigravityCommand: string
  defaultProjectDir: string
  hiddenFolders: string[]
  terminalFont: string
  terminalFontSize: number
  theme: ThemeName
}
