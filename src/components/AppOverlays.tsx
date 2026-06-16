import { CommandPalette, type Command } from './CommandPalette'
import { OrchestratorModal } from './OrchestratorModal'
import { QuickOpen } from './QuickOpen'
import { SettingsModal } from './SettingsModal'
import type { OrchestratorConfig } from '../orchestrator'
import type { UseAccounts } from '../hooks/useAccounts'
import type { CliKind, SessionRuntime, Settings } from '../types'

interface AppOverlaysProps {
  quickOpenOpen: boolean
  activeSession: SessionRuntime | null
  hiddenFolders: string[]
  commands: Command[]
  paletteOpen: boolean
  orchestratorOpen: boolean
  settingsOpen: boolean
  settings: Settings
  orchestratorConfig: OrchestratorConfig
  accounts: UseAccounts
  onAddAccount: (type: CliKind) => void
  onPickFile: (path: string) => void
  onCloseQuickOpen: () => void
  onClosePalette: () => void
  onSaveOrchestrator: (config: OrchestratorConfig) => void
  onResetOrchestrator: () => void
  onCloseOrchestrator: () => void
  onSaveSettings: (settings: Settings) => void
  onCloseSettings: () => void
}

export function AppOverlays({
  quickOpenOpen,
  activeSession,
  hiddenFolders,
  commands,
  paletteOpen,
  orchestratorOpen,
  settingsOpen,
  settings,
  orchestratorConfig,
  accounts,
  onAddAccount,
  onPickFile,
  onCloseQuickOpen,
  onClosePalette,
  onSaveOrchestrator,
  onResetOrchestrator,
  onCloseOrchestrator,
  onSaveSettings,
  onCloseSettings
}: AppOverlaysProps) {
  return (
    <>
      {quickOpenOpen && activeSession && (
        <QuickOpen
          root={activeSession.cwd}
          hidden={hiddenFolders}
          onPick={onPickFile}
          onClose={onCloseQuickOpen}
        />
      )}

      {paletteOpen && <CommandPalette commands={commands} onClose={onClosePalette} />}

      <OrchestratorModal
        open={orchestratorOpen}
        config={orchestratorConfig}
        onSave={onSaveOrchestrator}
        onReset={onResetOrchestrator}
        onClose={onCloseOrchestrator}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        accounts={accounts}
        onAddAccount={onAddAccount}
        onSave={onSaveSettings}
        onClose={onCloseSettings}
      />
    </>
  )
}
