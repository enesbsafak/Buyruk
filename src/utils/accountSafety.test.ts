import { describe, expect, it } from 'vitest'
import { accountByIdForType, resolveDefaultAccount, shouldSeedClaudeConfigEntry } from './accountSafety'
import type { AccountsState } from '../types'

const state: AccountsState = {
  accounts: [
    { id: 'claude-1', type: 'claude', label: 'Claude', createdAt: 1, lastUsedAt: 1 },
    { id: 'codex-1', type: 'codex', label: 'Codex', createdAt: 2, lastUsedAt: 2 }
  ],
  activeByType: { claude: 'codex-1', codex: 'codex-1' }
}

describe('accountSafety', () => {
  it('does not resolve an account id for the wrong CLI type', () => {
    expect(accountByIdForType(state, 'codex-1', 'claude')).toBeUndefined()
    expect(accountByIdForType(state, 'codex-1', 'codex')?.label).toBe('Codex')
  })

  it('falls back to the first account of the requested type when active id is stale', () => {
    expect(resolveDefaultAccount(state, 'claude')?.id).toBe('claude-1')
  })

  it('allows seeding portable Claude config while excluding auth-like files', () => {
    expect(shouldSeedClaudeConfigEntry('skills')).toBe(true)
    expect(shouldSeedClaudeConfigEntry('settings.json')).toBe(true)
    expect(shouldSeedClaudeConfigEntry('oauth_token')).toBe(false)
    expect(shouldSeedClaudeConfigEntry('credentials.json')).toBe(false)
  })
})
