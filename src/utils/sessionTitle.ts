import type { TerminalType } from '../types'
import { basename } from './pathUtils'

const TERMINAL_LABELS: Record<TerminalType, string> = {
  cmd: 'CMD',
  powershell: 'PowerShell',
  claude: 'Claude',
  codex: 'Codex',
  opencode: 'OpenCode'
}

// Build a session/tab title: "Claude · projem".
export function sessionTitle(type: TerminalType, cwd: string): string {
  return `${TERMINAL_LABELS[type]} · ${basename(cwd)}`
}
