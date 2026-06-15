import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { CliIcon } from './CliIcon'
import { basename } from '../utils/pathUtils'
import brandLogo from '../assets/icon.png'
import type { RecentFolder } from '../utils/persistence'
import type { TerminalType } from '../types'

interface ToolbarProps {
  onNewTerminal: (type: TerminalType) => void
  onOpenFolder: () => void
  onNewFolder: () => void
  onCloseActive: () => void
  onOpenSettings: () => void
  onOpenOrchestrator: () => void
  hasActive: boolean
  recents: RecentFolder[]
  onOpenRecent: (recent: RecentFolder) => void
  broadcast: boolean
  onBroadcastPrompt: () => void
  gitChangeCount: number
  gitPanelOpen: boolean
  onToggleGitPanel: () => void
  orchestratorEnabled: boolean
}

const NEW_BUTTONS: { type: TerminalType; label: string }[] = [
  { type: 'cmd', label: 'CMD' },
  { type: 'powershell', label: 'PowerShell' },
  { type: 'claude', label: 'Claude' },
  { type: 'codex', label: 'Codex' }
]

export function Toolbar({
  onNewTerminal,
  onOpenFolder,
  onNewFolder,
  onCloseActive,
  onOpenSettings,
  onOpenOrchestrator,
  hasActive,
  recents,
  onOpenRecent,
  broadcast,
  onBroadcastPrompt,
  gitChangeCount,
  gitPanelOpen,
  onToggleGitPanel,
  orchestratorEnabled
}: ToolbarProps) {
  const [maximized, setMaximized] = useState(false)
  const [recentsOpen, setRecentsOpen] = useState(false)
  const recentsRef = useRef<HTMLDivElement>(null)

  useEffect(() => window.api.windowControls.onMaximizedChange(setMaximized), [])

  // Close the recents dropdown on any outside click.
  useEffect(() => {
    if (!recentsOpen) return
    const onDown = (e: MouseEvent) => {
      if (!recentsRef.current?.contains(e.target as Node)) setRecentsOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [recentsOpen])

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <img className="brand-logo" src={brandLogo} alt="Buyruk" />
        Buyruk
      </div>

      <div className="toolbar-group no-drag" aria-label="Yeni oturum">
        {NEW_BUTTONS.map(({ type, label }) => (
          <button type="button" key={type} className="seg-btn" title={`Yeni ${label}`} onClick={() => onNewTerminal(type)}>
            <CliIcon type={type} size={15} />
            <span className="seg-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="dropdown no-drag" ref={recentsRef}>
        <button
          type="button"
          className="btn btn-ghost toolbar-action"
          onClick={() => setRecentsOpen((o) => !o)}
          disabled={recents.length === 0}
          title="Son klasörler"
        >
          <Icon name="chevron" />
          <span className="toolbar-label">Son</span>
        </button>
        {recentsOpen && (
          <div className="dropdown-panel">
            {recents.map((r) => (
              <button
                type="button"
                key={r.cwd}
                className="dropdown-item"
                title={r.cwd}
                onClick={() => {
                  setRecentsOpen(false)
                  onOpenRecent(r)
                }}
              >
                <CliIcon type={r.type} size={15} />
                <span className="dropdown-item-name">{basename(r.cwd)}</span>
                <span className="dropdown-item-path">{r.cwd}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="btn btn-ghost toolbar-action no-drag" title="Klasör Aç" onClick={onOpenFolder}>
        <Icon name="folder" />
        <span className="toolbar-label">Klasör Aç</span>
      </button>
      <button type="button" className="btn btn-ghost toolbar-action no-drag" title="Yeni Klasör" onClick={onNewFolder}>
        <Icon name="folder-plus" />
        <span className="toolbar-label">Yeni Klasör</span>
      </button>
      <button
        type="button"
        className={`btn btn-ghost toolbar-action toolbar-git no-drag ${gitPanelOpen ? 'is-on' : ''}`}
        title="Git paneli"
        onClick={onToggleGitPanel}
      >
        <Icon name="git-diff" />
        <span className="toolbar-label">Git</span>
        {gitChangeCount > 0 && <span className="toolbar-count">{gitChangeCount}</span>}
      </button>
      <button type="button" className="btn btn-ghost toolbar-action no-drag" title="Terminali Kapat" onClick={onCloseActive} disabled={!hasActive}>
        <Icon name="close" />
        <span className="toolbar-label">Terminali Kapat</span>
      </button>

      <div className="toolbar-spacer" />

      <button
        type="button"
        className={`icon-btn no-drag ${broadcast ? 'is-on' : ''}`}
        title={broadcast ? 'Broadcast modu açık: mesaj gönder' : 'Broadcast gönder'}
        onClick={onBroadcastPrompt}
      >
        <Icon name="broadcast" size={17} />
      </button>
      <button
        type="button"
        className={`icon-btn no-drag ${orchestratorEnabled ? 'is-on' : ''}`}
        title={orchestratorEnabled ? 'AI orkestrasyon açık' : 'AI orkestrasyon'}
        onClick={onOpenOrchestrator}
      >
        <Icon name="orchestrator" size={17} />
      </button>
      <button type="button" className="icon-btn no-drag" title="Ayarlar" onClick={onOpenSettings}>
        <Icon name="settings" size={17} />
      </button>

      <div className="win-controls no-drag">
        <button
          type="button"
          className="win-btn"
          title="Küçült"
          onClick={() => window.api.windowControls.minimize()}
        >
          <Icon name="win-minimize" size={15} />
        </button>
        <button
          type="button"
          className="win-btn"
          title={maximized ? 'Geri Yükle' : 'Büyüt'}
          onClick={() => window.api.windowControls.maximizeToggle()}
        >
          <Icon name={maximized ? 'win-restore' : 'win-maximize'} size={14} />
        </button>
        <button
          type="button"
          className="win-btn close"
          title="Kapat"
          onClick={() => window.api.windowControls.close()}
        >
          <Icon name="close" size={15} />
        </button>
      </div>
    </header>
  )
}
