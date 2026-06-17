import type { TerminalType } from '../types'

const SESSIONS_KEY = 'multicli.sessions'
const RECENTS_KEY = 'multicli.recents'
const MAX_RECENTS = 8

export interface SavedSession {
  type: TerminalType
  cwd: string
  title: string
}

export interface RecentFolder {
  cwd: string
  type: TerminalType
}

export function loadSavedSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    return raw ? (JSON.parse(raw) as SavedSession[]) : []
  } catch {
    return []
  }
}

export function saveSessions(list: SavedSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function loadRecents(): RecentFolder[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    return raw ? (JSON.parse(raw) as RecentFolder[]) : []
  } catch {
    return []
  }
}

// Add/refresh a folder at the top of the recents list (dedup by path, capped).
export function pushRecent(cwd: string, type: TerminalType): RecentFolder[] {
  const list = loadRecents().filter((r) => r.cwd.toLowerCase() !== cwd.toLowerCase())
  list.unshift({ cwd, type })
  const trimmed = list.slice(0, MAX_RECENTS)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore
  }
  return trimmed
}
