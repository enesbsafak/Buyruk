import { CommandPalette, type Command } from './CommandPalette'
import { QuickOpen } from './QuickOpen'
import { SettingsModal } from './SettingsModal'
import { DatabasePanel } from './DatabasePanel'
import type { SessionRuntime, Settings } from '../types'

interface AppOverlaysProps {
  quickOpenOpen: boolean
  activeSession: SessionRuntime | null
  hiddenFolders: string[]
  commands: Command[]
  paletteOpen: boolean
  settingsOpen: boolean
  settings: Settings
  onPickFile: (path: string) => void
  onCloseQuickOpen: () => void
  onClosePalette: () => void
  onSaveSettings: (settings: Settings) => void
  onCloseSettings: () => void
  dbOpen: boolean
  onCloseDatabase: () => void
}

export function AppOverlays({
  quickOpenOpen,
  activeSession,
  hiddenFolders,
  commands,
  paletteOpen,
  settingsOpen,
  settings,
  onPickFile,
  onCloseQuickOpen,
  onClosePalette,
  onSaveSettings,
  onCloseSettings,
  dbOpen,
  onCloseDatabase
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

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onSave={onSaveSettings}
        onClose={onCloseSettings}
      />

      <DatabasePanel open={dbOpen} onClose={onCloseDatabase} />
    </>
  )
}
