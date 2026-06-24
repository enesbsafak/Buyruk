import { TerminalArea } from './TerminalArea'
import { FileExplorer } from './FileExplorer'
import { CodeEditor } from './CodeEditor'
import { SplitLayout } from './SplitLayout'
import { GitPanel } from './GitPanel'
import { Icon } from './Icon'
import type {
  GitChange,
  GitCommit,
  GitOverview,
  GitStatus,
  SessionRuntime,
  Settings,
  TerminalType
} from '../types'

export interface GitPanelBundle {
  open: boolean
  overview: GitOverview
  root: string | null
  onClose: () => void
  onRefresh: () => void
  onFetch: () => void
  onPush: () => void
  onPull: () => void
  onCommit: (message: string, paths: string[]) => Promise<boolean>
  onCheckoutBranch: (name: string) => void
  onCreateBranch: () => void
  onOpenFileDiff: (change: GitChange) => void
  onOpenCommitDiff: (commit: GitCommit) => void
}

interface WorkspacePanelsProps {
  sessions: SessionRuntime[]
  activeId: string | null
  activeSession: SessionRuntime | null
  settings: Settings
  broadcast: boolean
  gitStatus: GitStatus
  explorerNonce: number
  onSelectSession: (id: string) => void
  onCloseSession: (id: string) => void
  onRestart: (session: SessionRuntime) => void
  onRenameSession: (session: SessionRuntime) => void
  onInput: (id: string, data: string) => void
  onBell: (id: string) => void
  onToggleBroadcast: () => void
  onOpenFile: (path: string) => void
  onOpenTerminalHere: (cwd: string, type: TerminalType) => void
  onRefresh: () => void
  onChangeContent: (path: string, content: string) => void
  onSaveFile: () => void
  onSelectFile: (path: string) => void
  onCloseFile: (path: string) => void
  onOpenGitDiff: (path: string) => void
  gitPanel: GitPanelBundle
}

export function WorkspacePanels({
  sessions,
  activeId,
  activeSession,
  settings,
  broadcast,
  gitStatus,
  explorerNonce,
  onSelectSession,
  onCloseSession,
  onRestart,
  onRenameSession,
  onInput,
  onBell,
  onToggleBroadcast,
  onOpenFile,
  onOpenTerminalHere,
  onRefresh,
  onChangeContent,
  onSaveFile,
  onSelectFile,
  onCloseFile,
  onOpenGitDiff,
  gitPanel
}: WorkspacePanelsProps) {
  const monacoTheme = settings.theme === 'light' ? 'vs' : 'tokyo-night'

  // Pin the right sidebar (file explorer + editor) to ~15% of the window so it stays
  // compact no matter the window size; the terminal flexes to fill the rest.
  const sidebarInitial = Math.max(240, Math.round(window.innerWidth * 0.15))

  const editor = (
    <CodeEditor
      session={activeSession}
      theme={monacoTheme}
      onChangeContent={onChangeContent}
      onSave={onSaveFile}
      onSelectFile={onSelectFile}
      onCloseFile={onCloseFile}
    />
  )

  const gitDock = (
    <GitPanel
      overview={gitPanel.overview}
      root={gitPanel.root}
      onRefresh={gitPanel.onRefresh}
      onFetch={gitPanel.onFetch}
      onPush={gitPanel.onPush}
      onPull={gitPanel.onPull}
      onCommit={gitPanel.onCommit}
      onCheckoutBranch={gitPanel.onCheckoutBranch}
      onCreateBranch={gitPanel.onCreateBranch}
      onOpenFileDiff={gitPanel.onOpenFileDiff}
      onOpenCommitDiff={gitPanel.onOpenCommitDiff}
      onClose={gitPanel.onClose}
    />
  )

  return (
    <div className="main">
      <SplitLayout
        direction="horizontal"
        initial={sidebarInitial}
        min={200}
        anchor="second"
        storageKey="main-sidebar"
      >
        <TerminalArea
          sessions={sessions}
          activeId={activeId}
          fontFamily={settings.terminalFont}
          fontSize={settings.terminalFontSize}
          broadcast={broadcast}
          onSelect={onSelectSession}
          onClose={onCloseSession}
          onRestart={onRestart}
          onRename={onRenameSession}
          onInput={onInput}
          onBell={onBell}
          onToggleBroadcast={onToggleBroadcast}
        />

        <div className="workspace-sidebar">
          <div className="workspace-sidebar-head">
            <span className="workspace-sidebar-title">Çalışma Alanı</span>
            <button
              type="button"
              className={`btn btn-ghost sidebar-git-toggle ${gitPanel.open ? 'is-on' : ''}`}
              title="Git paneli"
              aria-pressed={gitPanel.open}
              onClick={gitPanel.onClose}
            >
              <Icon name="git-diff" size={13} />
              <span>Git</span>
              {gitPanel.overview.changes.length > 0 && (
                <span className="toolbar-count">{gitPanel.overview.changes.length}</span>
              )}
            </button>
          </div>
          <div className="workspace-sidebar-body">
            <SplitLayout direction="vertical" initial={320} min={120} storageKey="sidebar-explorer">
              <FileExplorer
                rootPath={activeSession?.cwd ?? null}
                hiddenFolders={settings.hiddenFolders}
                gitFiles={gitStatus.files}
                onOpenFile={onOpenFile}
                onOpenGitDiff={onOpenGitDiff}
                onOpenTerminalHere={onOpenTerminalHere}
                refreshNonce={explorerNonce}
                onRefresh={onRefresh}
              />
              {gitPanel.open ? (
                <SplitLayout direction="vertical" initial={280} min={120} storageKey="git-editor">
                  {gitDock}
                  {editor}
                </SplitLayout>
              ) : (
                editor
              )}
            </SplitLayout>
          </div>
        </div>
      </SplitLayout>
    </div>
  )
}
