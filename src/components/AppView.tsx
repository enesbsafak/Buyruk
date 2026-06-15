import { useMemo } from 'react'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { WorkspacePanels } from './WorkspacePanels'
import { AppOverlays } from './AppOverlays'
import { GitPanel } from './GitPanel'
import type { Command } from './CommandPalette'
import type { OrchestratorConfig } from '../orchestrator'
import type { RecentFolder } from '../utils/persistence'
import type { AppUpdateStatus } from '../updateTypes'
import type {
  AiLimitsOverview,
  GitOverview,
  GitStatus,
  SessionRuntime,
  Settings,
  TerminalType
} from '../types'

interface AppViewProps {
  activeId: string | null
  activeSession: SessionRuntime | null
  broadcast: boolean
  closeOrchestrator: () => void
  closePalette: () => void
  closeQuickOpen: () => void
  closeSettings: () => void
  commands: Command[]
  explorerNonce: number
  aiLimits: AiLimitsOverview
  gitOverview: GitOverview
  gitPanelOpen: boolean
  gitStatus: GitStatus
  handleBell: (id: string) => void
  handleBroadcastPrompt: () => void
  handleChangeContent: (path: string, content: string) => void
  handleCheckForUpdates: () => void
  handleCloseActive: () => void
  handleCloseFile: (path: string) => void
  handleCloseSession: (id: string) => void
  handleInstallUpdate: () => void
  handleUpdateAiTools: () => void
  handleFetchGit: () => void
  handleInput: (id: string, data: string) => void
  handleNewFolder: () => void
  handleNewTerminal: (type: TerminalType) => void
  handleOpenFile: (path: string) => void
  handleOpenFolder: () => void
  handleOpenGitDiff: (path: string) => void
  handleOpenRecent: (recent: RecentFolder) => void
  handleOpenTerminalHere: (cwd: string, type: TerminalType) => void
  handleRenameSession: (session: SessionRuntime) => void
  handleResetOrchestrator: () => void
  handleRefreshAiLimits: () => void
  handleRefreshGit: () => void
  handleRestart: (session: SessionRuntime) => void
  handleSaveOrchestrator: (config: OrchestratorConfig) => void
  handleSaveSettings: (settings: Settings) => void
  handleSelectFile: (path: string) => void
  openOrchestrator: () => void
  openSettings: () => void
  orchestratorConfig: OrchestratorConfig
  orchestratorOpen: boolean
  orchestratorSummary: string
  paletteOpen: boolean
  quickOpenOpen: boolean
  recents: RecentFolder[]
  saveActiveFile: () => void
  sessions: SessionRuntime[]
  settings: Settings
  settingsOpen: boolean
  statusMessage: string
  toggleGitPanel: () => void
  updateStatus: AppUpdateStatus
  setActiveSession: (id: string) => void
  bumpExplorer: () => void
}

export function AppView({
  activeId,
  activeSession,
  broadcast,
  closeOrchestrator,
  closePalette,
  closeQuickOpen,
  closeSettings,
  commands,
  explorerNonce,
  aiLimits,
  gitOverview,
  gitPanelOpen,
  gitStatus,
  handleBell,
  handleBroadcastPrompt,
  handleChangeContent,
  handleCheckForUpdates,
  handleCloseActive,
  handleCloseFile,
  handleCloseSession,
  handleInstallUpdate,
  handleUpdateAiTools,
  handleFetchGit,
  handleInput,
  handleNewFolder,
  handleNewTerminal,
  handleOpenFile,
  handleOpenFolder,
  handleOpenGitDiff,
  handleOpenRecent,
  handleOpenTerminalHere,
  handleRenameSession,
  handleResetOrchestrator,
  handleRefreshAiLimits,
  handleRefreshGit,
  handleRestart,
  handleSaveOrchestrator,
  handleSaveSettings,
  handleSelectFile,
  openOrchestrator,
  openSettings,
  orchestratorConfig,
  orchestratorOpen,
  orchestratorSummary,
  paletteOpen,
  quickOpenOpen,
  recents,
  saveActiveFile,
  sessions,
  settings,
  settingsOpen,
  statusMessage,
  toggleGitPanel,
  updateStatus,
  setActiveSession,
  bumpExplorer
}: AppViewProps) {
  const gitPopover = useMemo(
    () => (
      <GitPanel
        overview={gitOverview}
        popover
        onRefresh={handleRefreshGit}
        onFetch={handleFetchGit}
        onOpenDiff={(path) => {
          handleOpenGitDiff(path)
          toggleGitPanel()
        }}
        onClose={toggleGitPanel}
      />
    ),
    [gitOverview, handleFetchGit, handleOpenGitDiff, handleRefreshGit, toggleGitPanel]
  )

  return (
    <div className="app">
      <Toolbar
        onNewTerminal={handleNewTerminal}
        onOpenFolder={handleOpenFolder}
        onNewFolder={handleNewFolder}
        onCloseActive={handleCloseActive}
        onOpenSettings={openSettings}
        onOpenOrchestrator={openOrchestrator}
        hasActive={!!activeId}
        recents={recents}
        onOpenRecent={handleOpenRecent}
        broadcast={broadcast}
        onBroadcastPrompt={handleBroadcastPrompt}
        onUpdateAiTools={handleUpdateAiTools}
        aiLimits={aiLimits}
        onRefreshAiLimits={handleRefreshAiLimits}
        gitChangeCount={gitOverview.changes.length}
        gitPanelOpen={gitPanelOpen}
        onToggleGitPanel={toggleGitPanel}
        gitPopover={gitPopover}
        orchestratorEnabled={orchestratorConfig.enabled}
      />

      <WorkspacePanels
        sessions={sessions}
        activeId={activeId}
        activeSession={activeSession}
        settings={settings}
        broadcast={broadcast}
        gitStatus={gitStatus}
        explorerNonce={explorerNonce}
        onSelectSession={setActiveSession}
        onCloseSession={handleCloseSession}
        onRestart={handleRestart}
        onRenameSession={handleRenameSession}
        onInput={handleInput}
        onBell={handleBell}
        onOpenFile={handleOpenFile}
        onOpenTerminalHere={handleOpenTerminalHere}
        onRefresh={bumpExplorer}
        onChangeContent={handleChangeContent}
        onSaveFile={saveActiveFile}
        onSelectFile={handleSelectFile}
        onCloseFile={handleCloseFile}
        onOpenGitDiff={handleOpenGitDiff}
      />

      <StatusBar
        activeSession={activeSession}
        terminalCount={sessions.length}
        statusMessage={statusMessage}
        gitBranch={gitStatus.isRepo ? gitStatus.branch : null}
        updateStatus={updateStatus}
        orchestratorSummary={orchestratorSummary}
        orchestratorEnabled={orchestratorConfig.enabled}
        onOpenOrchestrator={openOrchestrator}
        onCheckForUpdates={handleCheckForUpdates}
        onInstallUpdate={handleInstallUpdate}
      />

      <AppOverlays
        quickOpenOpen={quickOpenOpen}
        activeSession={activeSession}
        hiddenFolders={settings.hiddenFolders}
        commands={commands}
        paletteOpen={paletteOpen}
        orchestratorOpen={orchestratorOpen}
        settingsOpen={settingsOpen}
        settings={settings}
        orchestratorConfig={orchestratorConfig}
        onPickFile={handleOpenFile}
        onCloseQuickOpen={closeQuickOpen}
        onClosePalette={closePalette}
        onSaveOrchestrator={handleSaveOrchestrator}
        onResetOrchestrator={handleResetOrchestrator}
        onCloseOrchestrator={closeOrchestrator}
        onSaveSettings={handleSaveSettings}
        onCloseSettings={closeSettings}
      />
    </div>
  )
}
