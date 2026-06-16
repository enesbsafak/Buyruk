import type { AccountsState, CliAccount, CliKind } from '../types'

const PORTABLE_CLAUDE_CONFIG = new Set([
  'agents',
  'commands',
  'settings.json',
  'settings.local.json',
  'skills'
])

const CLAUDE_AUTH_NAME = /(auth|credential|oauth|session|token)/i

export function shouldSeedClaudeConfigEntry(name: string): boolean {
  const clean = name.trim()
  if (!clean || CLAUDE_AUTH_NAME.test(clean)) return false
  return PORTABLE_CLAUDE_CONFIG.has(clean)
}

export function accountByIdForType(
  state: AccountsState,
  id: string | undefined,
  type: CliKind
): CliAccount | undefined {
  if (!id) return undefined
  return state.accounts.find((account) => account.id === id && account.type === type)
}

export function accountsByType(state: AccountsState, type: CliKind): CliAccount[] {
  return state.accounts.filter((account) => account.type === type)
}

export function resolveDefaultAccount(state: AccountsState, type: CliKind): CliAccount | undefined {
  return accountByIdForType(state, state.activeByType[type], type) ?? accountsByType(state, type)[0]
}
