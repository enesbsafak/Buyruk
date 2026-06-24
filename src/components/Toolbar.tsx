import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { CliIcon } from './CliIcon'
import { AiLimitsPopover } from './AiLimitsPopover'
import { basename } from '../utils/pathUtils'
import type { RecentFolder } from '../utils/persistence'
import type { AiLimitsOverview, SessionRuntime, TerminalType } from '../types'
import brandLogo from '../assets/icon.png'

interface ToolbarProps {
  onNewTerminal: (type: TerminalType) => void
  onOpenFolder: () => void
  onNewFolder: () => void
  onCloneRepo: () => void
  onOpenSettings: () => void
  recents: RecentFolder[]
  onOpenRecent: (recent: RecentFolder) => void
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
  onUpdateAiTools,
  activeSession
}: ToolbarProps) {
  const [maximized, setMaximized] = useState(false)
  const [recentsOpen, setRecentsOpen] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [limitsLoading, setLimitsLoading] = useState(false)
  const [limitsError, setLimitsError] = useState<string | null>(null)
  const [limitsOverview, setLimitsOverview] = useState<AiLimitsOverview | null>(null)
  const recentsRef = useRef<HTMLDivElement>(null)
  const limitsRef = useRef<HTMLDivElement>(null)

  useEffect(() => window.api.windowControls.onMaximizedChange(setMaximized), [])

  const loadLimits = async (force = false, clearBeforeLoad = false) => {
    setLimitsLoading(true)
    setLimitsError(null)
    if (clearBeforeLoad) setLimitsOverview(null)
    try {
      const overview = await window.api.aiLimits.get({ force })
      setLimitsOverview(overview)
    } catch (err) {
      setLimitsError(err instanceof Error ? err.message : String(err))
    } finally {
      setLimitsLoading(false)
    }
  }

  // Close the recents dropdown on any outside click.
  useEffect(() => {
    if (!recentsOpen) return
    const onDown = (e: MouseEvent) => {
      if (!recentsRef.current?.contains(e.target as Node)) setRecentsOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [recentsOpen])

  useEffect(() => {
    if (!limitsOpen) return
    void loadLimits(false, true)
    const onDown = (e: MouseEvent) => {
      if (!limitsRef.current?.contains(e.target as Node)) setLimitsOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [limitsOpen])

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
      <div className="toolbar-popover-wrap no-drag" ref={limitsRef}>
        <button
          type="button"
          className={`icon-btn ${limitsOpen ? 'is-on' : ''}`}
          title="AI kullanım limitleri"
          onClick={() => setLimitsOpen((open) => !open)}
        >
          <Icon name="bolt" size={16} />
        </button>
        {limitsOpen && (
          <div className="toolbar-popover ai-limits-popover">
            <AiLimitsPopover
              overview={limitsOverview}
              loading={limitsLoading}
              error={limitsError}
              onRefresh={() => void loadLimits(true)}
            />
          </div>
        )}
      </div>
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
