import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { CliIcon } from './CliIcon'
import { basename } from '../utils/pathUtils'
import type { RecentFolder, WorkspaceProfile } from '../utils/persistence'
import type { SessionRuntime, TerminalType } from '../types'
import brandLogo from '../assets/icon.png'

interface ToolbarProps {
  onNewTerminal: (type: TerminalType) => void
  onOpenFolder: () => void
  onNewFolder: () => void
  onCloneRepo: () => void
  onOpenSettings: () => void
  recents: RecentFolder[]
  onOpenRecent: (recent: RecentFolder) => void
  profiles: WorkspaceProfile[]
  onSaveProfile: () => void
  onOpenProfile: (profile: WorkspaceProfile) => void
  onDeleteProfile: (profile: WorkspaceProfile) => void
  onUpdateAiTools: () => void
  activeSession: SessionRuntime | null
}

const NEW_BUTTONS: { type: TerminalType; label: string }[] = [
  { type: 'cmd', label: 'CMD' },
  { type: 'powershell', label: 'PowerShell' },
  { type: 'claude', label: 'Claude' },
  { type: 'codex', label: 'Codex' },
  { type: 'opencode', label: 'OpenCode' },
  { type: 'antigravity', label: 'Antigravity' }
]

export function Toolbar({
  onNewTerminal,
  onOpenFolder,
  onNewFolder,
  onCloneRepo,
  onOpenSettings,
  recents,
  onOpenRecent,
  profiles,
  onSaveProfile,
  onOpenProfile,
  onDeleteProfile,
  onUpdateAiTools,
  activeSession
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
          title="Çalışma alanları ve son klasörler"
        >
          <Icon name="chevron" />
          <span className="toolbar-label">Aç</span>
        </button>
        {recentsOpen && (
          <div className="dropdown-panel">
            {profiles.length > 0 && (
              <>
                <div className="dropdown-heading">Çalışma alanları</div>
                {profiles.map((profile) => (
                  <div key={profile.id} className="dropdown-row">
                    <button
                      type="button"
                      className="dropdown-item"
                      title={`${profile.sessions.length} terminal`}
                      onClick={() => {
                        setRecentsOpen(false)
                        onOpenProfile(profile)
                      }}
                    >
                      <Icon name="grid" size={15} />
                      <span className="dropdown-item-name">{profile.name}</span>
                      <span className="dropdown-item-path">
                        {profile.sessions.length} terminal
                      </span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-row-action"
                      title="Sil"
                      onClick={() => onDeleteProfile(profile)}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                ))}
                <div className="dropdown-sep" />
              </>
            )}

            <button type="button" className="dropdown-item" onClick={() => {
              setRecentsOpen(false)
              onSaveProfile()
            }}>
              <Icon name="save" size={15} />
              <span className="dropdown-item-name">Bu düzeni kaydet…</span>
            </button>

            {recents.length > 0 && (
              <>
                <div className="dropdown-sep" />
                <div className="dropdown-heading">Son klasörler</div>
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
              </>
            )}
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
      <button type="button" className="btn btn-ghost toolbar-action no-drag" title="GitHub'dan Klonla" onClick={onCloneRepo}>
        <Icon name="download" />
        <span className="toolbar-label">Klonla</span>
      </button>

      <div className="toolbar-spacer" />

      <button
        type="button"
        className="btn btn-ghost toolbar-action no-drag"
        title="Codex, Claude, OpenCode ve Antigravity araçlarını güncelle"
        onClick={onUpdateAiTools}
      >
        <Icon name="refresh" size={15} />
        <span className="toolbar-label">AI Araçları Güncelle</span>
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
