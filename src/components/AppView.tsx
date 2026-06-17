import { useMemo } from 'react'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { WorkspacePanels } from './WorkspacePanels'
import { WelcomeScreen } from './WelcomeScreen'
import { AppOverlays } from './AppOverlays'
import type { Command } from './CommandPalette'
import type { OrchestratorConfig } from '../orchestrator'
import type { RecentFolder } from '../utils/persistence'
import type { AppUpdateStatus } from '../updateTypes'
import type {
  GitChange,
  GitCommit,
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
  handleOpenCommitDiff: (commit: GitCommit) => void
  handleOpenFileDiff: (change: GitChange) => void
  handleGitCommit: (message: string, paths: string[]) => Promise<boolean>
  handleGitPush: () => void
  handleGitPull: () => void
  handleCheckoutBranch: (name: string) => void
  handleCreateBranch: () => void
  handleOpenRecent: (recent: RecentFolder) => void
  handleCloneRepo: () => void
  handleOpenTerminalHere: (cwd: string, type: TerminalType) => void
  handleRenameSession: (session: SessionRuntime) => void
  handleResetOrchestrator: () => void
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
  toggleBroadcast: () => void
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
  handleOpenCommitDiff,
  handleOpenFileDiff,
  handleGitCommit,
  handleGitPush,
  handleGitPull,
  handleCheckoutBranch,
  handleCreateBranch,
  handleOpenRecent,
  handleCloneRepo,
  handleOpenTerminalHere,
  handleRenameSession,
  handleResetOrchestrator,
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
  toggleBroadcast,
  toggleGitPanel,
  updateStatus,
  setActiveSession,
  bumpExplorer
}: AppViewProps) {
  const gitPanel = useMemo(
    () => ({
      open: gitPanelOpen,
      overview: gitOverview,
      root: activeSession?.cwd ?? null,
      onClose: toggleGitPanel,
      onRefresh: handleRefreshGit,
      onFetch: handleFetchGit,
      onPush: handleGitPush,
      onPull: handleGitPull,
      onCommit: handleGitCommit,
      onCheckoutBranch: handleCheckoutBranch,
      onCreateBranch: handleCreateBranch,
      onOpenFileDiff: handleOpenFileDiff,
      onOpenCommitDiff: handleOpenCommitDiff
    }),
    [
      gitPanelOpen,
      gitOverview,
      activeSession?.cwd,
      toggleGitPanel,
      handleRefreshGit,
      handleFetchGit,
      handleGitPush,
      handleGitPull,
      handleGitCommit,
      handleCheckoutBranch,
      handleCreateBranch,
      handleOpenFileDiff,
      handleOpenCommitDiff
    ]
  )

  return (
    <div className="app">
      <Toolbar
        onNewTerminal={handleNewTerminal}
        onOpenFolder={handleOpenFolder}
        onNewFolder={handleNewFolder}
        onCloneRepo={handleCloneRepo}
        onOpenSettings={openSettings}
        onOpenOrchestrator={openOrchestrator}
        recents={recents}
        onOpenRecent={handleOpenRecent}
        onUpdateAiTools={handleUpdateAiTools}
        orchestratorEnabled={orchestratorConfig.enabled}
        activeSession={activeSession}
      />

      {sessions.length === 0 ? (
        <WelcomeScreen
          recents={recents}
          onNewTerminal={handleNewTerminal}
          onCloneRepo={handleCloneRepo}
          onOpenRecent={handleOpenRecent}
        />
      ) : (
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
          onToggleBroadcast={toggleBroadcast}
          onOpenFile={handleOpenFile}
          onOpenTerminalHere={handleOpenTerminalHere}
          onRefresh={bumpExplorer}
          onChangeContent={handleChangeContent}
          onSaveFile={saveActiveFile}
          onSelectFile={handleSelectFile}
          onCloseFile={handleCloseFile}
          onOpenGitDiff={handleOpenGitDiff}
          gitPanel={gitPanel}
        />
      )}

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
