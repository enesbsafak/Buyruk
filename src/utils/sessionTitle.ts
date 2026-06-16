import type { TerminalType } from '../types'
import { basename } from './pathUtils'

const TERMINAL_LABELS: Record<TerminalType, string> = {
  cmd: 'CMD',
  powershell: 'PowerShell',
  claude: 'Claude',
  codex: 'Codex',
  opencode: 'OpenCode'
}

// Build a session/tab title: "Claude · İş hesabı · projem". The linked account
// label, when present, sits right after the CLI label (just like the toolbar
// account menu shows it).
export function sessionTitle(
  type: TerminalType,
  cwd: string,
  accountLabel?: string
): string {
  const parts = [TERMINAL_LABELS[type]]
  if (accountLabel) parts.push(accountLabel)
  parts.push(basename(cwd))
  return parts.join(' · ')
}
