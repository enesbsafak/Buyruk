import { useCallback, useMemo, useState } from 'react'
import {
  createDefaultOrchestratorConfig,
  normalizeOrchestratorConfig,
  type OrchestratorConfig
} from '../orchestrator'
import type { Settings } from '../types'

const STORAGE_KEY = 'buyruk.orchestrator'

function loadConfig(fallback: OrchestratorConfig): OrchestratorConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    return normalizeOrchestratorConfig(JSON.parse(raw) as Partial<OrchestratorConfig>, fallback)
  } catch {
    return fallback
  }
}

function persistConfig(config: OrchestratorConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // localStorage unavailable; config remains in memory for this session.
  }
}

export function useOrchestrator(settings: Settings) {
  const fallback = useMemo(
    () => createDefaultOrchestratorConfig(settings),
    [settings]
  )
  const [config, setConfig] = useState<OrchestratorConfig>(() => loadConfig(fallback))

  const update = useCallback(
    (next: OrchestratorConfig) => {
      const normalized = normalizeOrchestratorConfig(next, fallback)
      setConfig(normalized)
      persistConfig(normalized)
    },
    [fallback]
  )

  const reset = useCallback(() => {
    setConfig(fallback)
    persistConfig(fallback)
  }, [fallback])

  return { config, update, reset }
}
