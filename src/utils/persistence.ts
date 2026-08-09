import type { TerminalType } from '../types'

const SESSIONS_KEY = 'multicli.sessions'
const RECENTS_KEY = 'multicli.recents'
const PANEL_SIZE_PREFIX = 'multicli.panel.'
const TERMINAL_LAYOUT_KEY = 'multicli.terminalLayout'
const MAX_RECENTS = 8

export type TerminalLayoutMode = 'grid' | 'tabs'

export interface TerminalLayout {
  mode: TerminalLayoutMode
  /** Fixed column count for grid mode; 0 means "derive from pane count". */
  columns: number
  /** Relative column/row weights, rebuilt whenever the grid shape changes. */
  colFractions: number[]
  rowFractions: number[]
}

export const DEFAULT_TERMINAL_LAYOUT: TerminalLayout = {
  mode: 'grid',
  columns: 0,
  colFractions: [],
  rowFractions: []
}

const numberList = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'number' && item > 0 ? [item] : []))
    : []

export function loadTerminalLayout(): TerminalLayout {
  try {
    const raw = localStorage.getItem(TERMINAL_LAYOUT_KEY)
    if (!raw) return DEFAULT_TERMINAL_LAYOUT
    const parsed = JSON.parse(raw) as Partial<TerminalLayout>
    return {
      mode: parsed.mode === 'tabs' ? 'tabs' : 'grid',
      columns:
        typeof parsed.columns === 'number' && parsed.columns >= 0 && parsed.columns <= 6
          ? Math.floor(parsed.columns)
          : 0,
      colFractions: numberList(parsed.colFractions),
      rowFractions: numberList(parsed.rowFractions)
    }
  } catch {
    return DEFAULT_TERMINAL_LAYOUT
  }
}

export function saveTerminalLayout(layout: TerminalLayout): void {
  try {
    localStorage.setItem(TERMINAL_LAYOUT_KEY, JSON.stringify(layout))
  } catch {
    // ignore
  }
}

// Which explorer folders were open, remembered per workspace root so reopening a
// project lands you back on the same view instead of a fully collapsed tree.
const EXPANDED_PREFIX = 'multicli.expanded.'
const MAX_EXPANDED = 400

export function loadExpandedDirs(root: string): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_PREFIX + root.toLowerCase())
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

export function saveExpandedDirs(root: string, dirs: Set<string>): void {
  try {
    const list = [...dirs].slice(0, MAX_EXPANDED)
    localStorage.setItem(EXPANDED_PREFIX + root.toLowerCase(), JSON.stringify(list))
  } catch {
    // ignore
  }
}

export interface SavedSession {
  type: TerminalType
  cwd: string
  title: string
  /** Serialized scrollback, only written when the app shuts down. */
  snapshot?: string
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

// localStorage is a few MB in total, so a runaway snapshot must never cost us the
// session list itself: drop the snapshots and retry before giving up.
export function saveSessions(list: SavedSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list))
  } catch {
    try {
      const withoutSnapshots = list.map(({ snapshot: _snapshot, ...rest }) => rest)
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(withoutSnapshots))
    } catch {
      // ignore
    }
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

// Remember a draggable panel divider position (px) so the layout is restored on
// next launch instead of resetting to its default size.
export function loadPanelSize(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(PANEL_SIZE_PREFIX + key)
    if (raw === null) return fallback
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : fallback
  } catch {
    return fallback
  }
}

export function savePanelSize(key: string, size: number): void {
  try {
    localStorage.setItem(PANEL_SIZE_PREFIX + key, String(Math.round(size)))
  } catch {
    // ignore
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
