import { TerminalArea } from './TerminalArea'
import { FileExplorer } from './FileExplorer'
import { CodeEditor } from './CodeEditor'
import { SplitLayout } from './SplitLayout'
import { GitPanel } from './GitPanel'
import { ClipboardPanel } from './ClipboardPanel'
import { Icon } from './Icon'
import type { TerminalActivity } from '../hooks/useTerminalActivity'
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
  activity: Record<string, TerminalActivity>
  settings: Settings
  gitStatus: GitStatus
  explorerNonce: number
  onSelectSession: (id: string) => void
  onCloseSession: (id: string) => void
  onRestart: (session: SessionRuntime) => void
  onRenameSession: (session: SessionRuntime) => void
  onReorderSessions: (from: number, to: number) => void
  onInput: (id: string, data: string) => void
  onBell: (id: string) => void
  onCwdChange: (id: string, cwd: string) => void
  onSendContext: (sessionId: string, text: string) => void
  onDropImage: (sessionId: string, imagePath: string) => void
  clipboardOpen: boolean
  onCloseClipboard: () => void
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
  activity,
  settings,
  gitStatus,
  explorerNonce,
  onSelectSession,
  onCloseSession,
  onRestart,
  onRenameSession,
  onReorderSessions,
  onInput,
  onBell,
  onCwdChange,
  onSendContext,
  onDropImage,
  clipboardOpen,
  onCloseClipboard,
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

  // Only the AI CLIs can act on a file reference; cmd/PowerShell would just try
  // to run it as a command.
  const aiSessions = sessions.filter(
    (s) =>
      s.status === 'running' &&
      (s.type === 'claude' || s.type === 'codex' || s.type === 'opencode' || s.type === 'antigravity')
  )

  // Pin the right sidebar (file explorer + editor) to ~15% of the window so it stays
  // compact no matter the window size; the terminal flexes to fill the rest.
  const sidebarInitial = Math.max(240, Math.round(window.innerWidth * 0.15))

  const editor = (
    <CodeEditor
      session={activeSession}
      theme={monacoTheme}
      aiSessions={aiSessions}
      onSendContext={onSendContext}
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

  const explorerAndEditor = (
    <SplitLayout direction="vertical" initial={320} min={120} storageKey="sidebar-explorer">
      <FileExplorer
        rootPath={activeSession?.cwd ?? null}
        hiddenFolders={settings.hiddenFolders}
        gitFiles={gitStatus.files}
        onOpenFile={onOpenFile}
        onOpenGitDiff={onOpenGitDiff}
        onOpenTerminalHere={onOpenTerminalHere}
        aiSessions={aiSessions}
        onSendContext={onSendContext}
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
          activity={activity}
          fontFamily={settings.terminalFont}
          fontSize={settings.terminalFontSize}
          scrollback={settings.terminalScrollback}
          theme={settings.theme}
          onSelect={onSelectSession}
          onClose={onCloseSession}
          onRestart={onRestart}
          onRename={onRenameSession}
          onReorder={onReorderSessions}
          onInput={onInput}
          onBell={onBell}
          onCwdChange={onCwdChange}
          onDropImage={onDropImage}
        />

        <div className="workspace-sidebar">
          {/* Doubles as the sidebar's toolbar — a title here would crowd out the
              toggles at the sidebar's default width. */}
          <div className="workspace-sidebar-head">
            <button
              type="button"
              className={`btn btn-ghost sidebar-git-toggle ${clipboardOpen ? 'is-on' : ''}`}
              title="Pano paneli: kopyaladığın görseller"
              aria-pressed={clipboardOpen}
              onClick={onCloseClipboard}
            >
              <Icon name="image" size={13} />
              <span>Pano</span>
            </button>
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
            {clipboardOpen && (
              <SplitLayout
                direction="vertical"
                initial={220}
                min={120}
                anchor="second"
                storageKey="sidebar-clipboard"
              >
                <div className="workspace-sidebar-stack">{explorerAndEditor}</div>
                <ClipboardPanel open onClose={onCloseClipboard} />
              </SplitLayout>
            )}
            {!clipboardOpen && explorerAndEditor}
          </div>
        </div>
      </SplitLayout>
    </div>
  )
}
