import { TerminalArea } from './TerminalArea'
import { FileExplorer } from './FileExplorer'
import { CodeEditor } from './CodeEditor'
import { SplitLayout } from './SplitLayout'
import type { GitStatus, SessionRuntime, Settings, TerminalType } from '../types'

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
  onOpenGitDiff
}: WorkspacePanelsProps) {
  const monacoTheme = settings.theme === 'light' ? 'vs' : 'tokyo-night'

  return (
    <div className="main">
      <SplitLayout direction="horizontal" initial={760} min={260}>
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

        <SplitLayout direction="vertical" initial={320} min={120}>
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
          <CodeEditor
            session={activeSession}
            theme={monacoTheme}
            onChangeContent={onChangeContent}
            onSave={onSaveFile}
            onSelectFile={onSelectFile}
            onCloseFile={onCloseFile}
          />
        </SplitLayout>
      </SplitLayout>
    </div>
  )
}
