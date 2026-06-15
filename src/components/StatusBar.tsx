import { Icon } from './Icon'
import type { SessionRuntime } from '../types'
import type { AppUpdateStatus } from '../updateTypes'

interface StatusBarProps {
  activeSession: SessionRuntime | null
  terminalCount: number
  statusMessage: string
  gitBranch: string | null
  updateStatus: AppUpdateStatus
  orchestratorSummary: string
  orchestratorEnabled: boolean
  onOpenOrchestrator: () => void
  onCheckForUpdates: () => void
  onInstallUpdate: () => void
}

export function StatusBar({
  activeSession,
  terminalCount,
  statusMessage,
  gitBranch,
  updateStatus,
  orchestratorSummary,
  orchestratorEnabled,
  onOpenOrchestrator,
  onCheckForUpdates,
  onInstallUpdate
}: StatusBarProps) {
  const activeFile = activeSession?.openFiles.find(
    (f) => f.path === activeSession.activeFilePath
  )
  const dirty =
    activeFile && !activeFile.isBinary && activeFile.content !== activeFile.savedContent
  const updateBusy =
    updateStatus.state === 'checking' ||
    updateStatus.state === 'available' ||
    updateStatus.state === 'downloading'
  const updateReady = updateStatus.state === 'downloaded'

  return (
    <footer className="status-bar">
      <span className="status-item status-path" title={activeSession?.cwd}>
        <Icon name="folder" size={13} />
        {activeSession ? activeSession.cwd : <span className="dim">workspace seçilmedi</span>}
      </span>
      <span className="status-item">
        <Icon name="file" size={13} />
        {activeFile ? activeFile.name : <span className="dim">dosya yok</span>}
      </span>

      {gitBranch && (
        <span className="status-item" title="Git dalı">
          <Icon name="chevron" size={13} />
          {gitBranch}
        </span>
      )}

      <span className="status-spacer" />

      <span className="status-item">
        <span className={`status-dot ${dirty ? 'dirty' : ''}`} />
        {statusMessage || (dirty ? 'Kaydedilmedi' : 'Hazır')}
      </span>

      <span className="status-item">
        <Icon name="terminal" size={13} />
        {terminalCount} terminal
      </span>

      <button
        type="button"
        className={`status-item status-link ${orchestratorEnabled ? 'is-on' : ''}`}
        title={orchestratorSummary}
        onClick={onOpenOrchestrator}
      >
        <Icon name="orchestrator" size={13} />
        <span>{orchestratorEnabled ? 'AI açık' : 'AI kapalı'}</span>
      </button>

      <span className={`status-item update-status update-${updateStatus.state}`} title={updateStatus.error}>
        <Icon name="refresh" size={13} />
        <span>{updateStatus.message}</span>
        {typeof updateStatus.percent === 'number' && (
          <span className="dim">%{updateStatus.percent}</span>
        )}
        <button
          type="button"
          className="status-action"
          onClick={updateReady ? onInstallUpdate : onCheckForUpdates}
          disabled={updateBusy}
        >
          {updateReady ? 'Yeniden başlat' : 'Güncelle'}
        </button>
      </span>
    </footer>
  )
}
