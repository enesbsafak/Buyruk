import { useCallback, useState } from 'react'
import type { Settings } from '../types'

const STORAGE_KEY = 'multicli.settings'

export const DEFAULT_SETTINGS: Settings = {
  cmdCommand: 'cmd.exe',
  powershellCommand: 'powershell.exe',
  claudeCommand: 'claude',
  codexCommand: 'codex',
  opencodeCommand: 'opencode',
  hiddenFolders: ['node_modules', '.git', 'dist', 'build'],
  // A Nerd Font first so CLI glyphs (claude/codex/starship) render; plain fallbacks after.
  terminalFont: '"JetBrainsMono NF", "Cascadia Code", Consolas, monospace',
  terminalFontSize: 13,
  theme: 'dark'
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const update = useCallback((next: Settings) => {
    setSettings(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage unavailable; settings stay in memory for this session.
    }
  }, [])

  return { settings, update }
}
