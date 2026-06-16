import { app, type IpcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { IPC } from './ipcChannels'
import { shouldSeedClaudeConfigEntry } from '../src/utils/accountSafety'

// CLI types that support multiple linked accounts. Plain shells (cmd/powershell)
// have no notion of an account.
export type CliKind = 'claude' | 'codex' | 'opencode'

const CLI_KINDS: CliKind[] = ['claude', 'codex', 'opencode']

export function isCliKind(value: unknown): value is CliKind {
  return typeof value === 'string' && (CLI_KINDS as string[]).includes(value)
}

export interface CliAccount {
  id: string
  type: CliKind
  label: string
  createdAt: number
  lastUsedAt: number
}

export interface AccountsState {
  accounts: CliAccount[]
  // The account used by default when a new session of that CLI is opened.
  activeByType: Partial<Record<CliKind, string>>
}

interface AddAccountInput {
  type: CliKind
  label: string
}

const STORE_DIR = 'cli-accounts'
const STORE_FILE = 'accounts.json'
// Each account gets its own directory; the CLI writes its credentials/config there.
const DATA_DIR = 'data'

function storeRoot(): string {
  return path.join(app.getPath('userData'), STORE_DIR)
}

function storePath(): string {
  return path.join(storeRoot(), STORE_FILE)
}

// Absolute path of the per-account config directory. This is what each CLI's
// "config home" env var points at, so its auth lands in an isolated place.
export function accountDir(id: string): string {
  return path.join(storeRoot(), DATA_DIR, id)
}

function emptyState(): AccountsState {
  return { accounts: [], activeByType: {} }
}

function readStore(): AccountsState {
  try {
    const raw = readFileSync(storePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AccountsState>
    const accounts = Array.isArray(parsed.accounts)
      ? parsed.accounts.filter((a): a is CliAccount => isCliKind(a?.type) && typeof a?.id === 'string')
      : []
    const activeByType: AccountsState['activeByType'] = {}
    for (const type of CLI_KINDS) {
      const id = (parsed.activeByType ?? {})[type]
      if (typeof id === 'string' && accounts.some((account) => account.id === id && account.type === type)) {
        activeByType[type] = id
      }
    }
    return { accounts, activeByType }
  } catch {
    return emptyState()
  }
}

function writeStore(state: AccountsState): void {
  mkdirSync(storeRoot(), { recursive: true })
  writeFileSync(storePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function seedClaudeAccountDir(dir: string): void {
  const source = path.join(app.getPath('home'), '.claude')
  if (!existsSync(source)) return

  for (const name of readdirSync(source)) {
    if (!shouldSeedClaudeConfigEntry(name)) continue
    const from = path.join(source, name)
    const to = path.join(dir, name)
    if (existsSync(to)) continue
    try {
      cpSync(from, to, { recursive: true, force: false })
    } catch {
      // Keep account creation usable even if one optional config entry is locked.
    }
  }
}

function prepareAccountDir(account: CliAccount): void {
  const dir = accountDir(account.id)
  mkdirSync(dir, { recursive: true })
  if (account.type === 'claude') seedClaudeAccountDir(dir)
}

function listAccounts(): AccountsState {
  return readStore()
}

function findAccount(state: AccountsState, id: string): CliAccount | undefined {
  return state.accounts.find((a) => a.id === id)
}

function addAccount({ type, label }: AddAccountInput): AccountsState {
  const state = readStore()
  const id = randomUUID()
  const now = Date.now()
  const trimmed = label.trim() || 'Hesap'
  state.accounts.push({ id, type, label: trimmed, createdAt: now, lastUsedAt: now })
  // First account of a type becomes the default for that type.
  if (!state.activeByType[type]) state.activeByType[type] = id
  // Pre-create the config directory so the CLI can write into it on first login.
  prepareAccountDir(state.accounts[state.accounts.length - 1])
  writeStore(state)
  return state
}

function removeAccount(id: string): AccountsState {
  const state = readStore()
  const account = findAccount(state, id)
  if (!account) return state
  try {
    rmSync(accountDir(id), { recursive: true, force: true })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Hesap dosyaları silinemedi: ${detail}`)
  }
  state.accounts = state.accounts.filter((a) => a.id !== id)
  if (state.activeByType[account.type] === id) {
    const next = state.accounts.find((a) => a.type === account.type)
    if (next) state.activeByType[account.type] = next.id
    else delete state.activeByType[account.type]
  }
  writeStore(state)
  return state
}

function renameAccount(id: string, label: string): AccountsState {
  const state = readStore()
  const account = findAccount(state, id)
  if (account) {
    account.label = label.trim() || account.label
    writeStore(state)
  }
  return state
}

function setActiveAccount(type: CliKind, id: string): AccountsState {
  const state = readStore()
  const account = findAccount(state, id)
  if (account?.type === type) {
    state.activeByType[type] = id
    writeStore(state)
  }
  return state
}

// Resolve an account's display label (for terminal titles). Undefined when the
// id is missing or no longer linked.
export function accountLabel(id?: string, type?: CliKind): string | undefined {
  if (!id) return undefined
  const account = findAccount(readStore(), id)
  if (!account || (type && account.type !== type)) return undefined
  return account.label
}

// Bump lastUsedAt when a session actually spawns under this account.
export function touchAccount(id: string): void {
  const state = readStore()
  const account = findAccount(state, id)
  if (!account) return
  account.lastUsedAt = Date.now()
  writeStore(state)
}

export function accountMatchesType(id: string | undefined, type: CliKind): boolean {
  if (!id) return false
  const account = findAccount(readStore(), id)
  return account?.type === type
}

// Map an account's config directory to the env var(s) each CLI reads to locate
// its credentials. Setting these only on the spawned terminal isolates accounts
// without touching the user's global config.
function accountEnv(type: CliKind, dir: string): Record<string, string> {
  switch (type) {
    case 'claude':
      return { CLAUDE_CONFIG_DIR: dir }
    case 'codex':
      return { CODEX_HOME: dir }
    case 'opencode':
      // opencode stores auth under $XDG_DATA_HOME/opencode and config under
      // $XDG_CONFIG_HOME/opencode; pointing both at the account dir isolates it.
      return { XDG_DATA_HOME: dir, XDG_CONFIG_HOME: dir }
  }
}

// Resolve the env overrides for a terminal spawn given an (optional) accountId.
// Returns {} when there is no account (plain shell, or AI CLI with no link yet).
export function resolveTerminalEnv(type: CliKind | undefined, accountId?: string): Record<string, string> {
  if (!accountId) return {}
  if (!type) return {}
  const state = readStore()
  const account = findAccount(state, accountId)
  if (!account || account.type !== type) return {}
  const dir = accountDir(account.id)
  mkdirSync(dir, { recursive: true })
  return accountEnv(account.type, dir)
}

export function registerAccountHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.ACCOUNTS_LIST, () => listAccounts())
  ipcMain.handle(IPC.ACCOUNTS_ADD, (_e, input: AddAccountInput) => addAccount(input))
  ipcMain.handle(IPC.ACCOUNTS_REMOVE, (_e, id: string) => removeAccount(id))
  ipcMain.handle(IPC.ACCOUNTS_RENAME, (_e, id: string, label: string) =>
    renameAccount(id, label)
  )
  ipcMain.handle(IPC.ACCOUNTS_SET_ACTIVE, (_e, type: CliKind, id: string) =>
    setActiveAccount(type, id)
  )
}
