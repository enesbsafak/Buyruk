import { describe, expect, it } from 'vitest'
import {
  createDefaultOrchestratorConfig,
  describeOrchestratorConfig,
  normalizeOrchestratorConfig
} from './orchestrator'
import type { Settings } from './types'

const settings: Settings = {
  cmdCommand: 'cmd.exe',
  powershellCommand: 'powershell.exe',
  claudeCommand: 'claude',
  codexCommand: 'codex',
  opencodeCommand: 'opencode',
  hiddenFolders: [],
  terminalFont: 'Consolas',
  terminalFontSize: 13,
  theme: 'dark'
}

describe('orchestrator config', () => {
  it('creates a safe default workflow', () => {
    const config = createDefaultOrchestratorConfig(settings)

    expect(config.enabled).toBe(false)
    expect(config.orchestratorModelId).toBe('claude')
    expect(config.writerModelId).toBe('codex')
    expect(config.models.map((model) => model.id)).toEqual(['claude', 'codex', 'opencode'])
    expect(config.applyMode).toBe('user-confirmed')
    expect(config.fileLocking).toBe(true)
  })

  it('normalizes invalid selections and clamps rounds', () => {
    const fallback = createDefaultOrchestratorConfig(settings)
    const config = normalizeOrchestratorConfig(
      {
        enabled: true,
        orchestratorModelId: 'missing',
        writerModelId: 'codex',
        discussantModelIds: ['claude', 'missing', 'claude'],
        approverModelIds: ['missing'],
        approvalPolicy: 'all',
        applyMode: 'auto-after-approval',
        discussionRounds: 99
      },
      fallback
    )

    expect(config.orchestratorModelId).toBe('claude')
    expect(config.writerModelId).toBe('codex')
    expect(config.discussantModelIds).toEqual(['claude'])
    expect(config.approverModelIds).toEqual([])
    expect(config.discussionRounds).toBe(5)
  })

  it('describes enabled flow in role order', () => {
    const config = {
      ...createDefaultOrchestratorConfig(settings),
      enabled: true
    }

    expect(describeOrchestratorConfig(config)).toBe('Claude yönetir · Claude onaylar · Codex yazar')
  })
})
