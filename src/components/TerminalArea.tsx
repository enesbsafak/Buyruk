import { useRef, useState } from 'react'
import { Icon } from './Icon'
import { CliIcon } from './CliIcon'
import { TerminalPane } from './TerminalPane'
import { useTerminalLayout } from '../hooks/useTerminalLayout'
import type { SessionRuntime, ThemeName } from '../types'

interface TerminalAreaProps {
  sessions: SessionRuntime[]
  activeId: string | null
  fontFamily: string
  fontSize: number
  scrollback: number
  theme: ThemeName
  broadcast: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRestart: (session: SessionRuntime) => void
  onRename: (session: SessionRuntime) => void
  onReorder: (from: number, to: number) => void
  onInput: (id: string, data: string) => void
  onBell: (id: string) => void
  onCwdChange: (id: string, cwd: string) => void
  onToggleBroadcast: () => void
}

const COLUMN_CHOICES = [
  { value: 0, label: 'Oto' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' }
]

export function TerminalArea({
  sessions,
  activeId,
  fontFamily,
  fontSize,
  scrollback,
  theme,
  broadcast,
  onSelect,
  onClose,
  onRestart,
  onRename,
  onReorder,
  onInput,
  onBell,
  onCwdChange,
  onToggleBroadcast
}: TerminalAreaProps) {
  const [zoomedId, setZoomedId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const n = sessions.length
  const { grid, setMode, setColumns, dragColumn, dragRow, resetSizes } = useTerminalLayout(n)

  if (n === 0) {
    return (
      <div className="terminal-area">
        <div className="placeholder">
          <div className="placeholder-icon">
            <Icon name="terminal" size={26} />
          </div>
          <div className="placeholder-title">Çalışmaya başla</div>
          <div className="placeholder-text">
            CMD, PowerShell, Claude, Codex, OpenCode veya Antigravity oturumu açmak için bir
            klasör seç. Açtığın terminaller seçtiğin düzene göre yerleşir.
          </div>
        </div>
      </div>
    )
  }

  const zoom = sessions.some((s) => s.id === zoomedId) ? zoomedId : null
  const toggleZoom = (id: string) => setZoomedId((z) => (z === id ? null : id))
  const tabs = grid.mode === 'tabs'
  // In tab mode exactly one pane is on screen; zoom collapses the grid the same way.
  const soloId = tabs ? (sessions.some((s) => s.id === activeId) ? activeId : sessions[0].id) : zoom
  const showGridChrome = !tabs && !zoom && n > 1

  const cols = soloId ? 1 : grid.cols
  const remainder = n % cols

  const sendPrompt = () => {
    if (!prompt || !activeId) return
    onInput(activeId, prompt + '\r')
    setPrompt('')
  }

  const startBoundaryDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    axis: 'col' | 'row',
    index: number
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const container = gridRef.current
    if (!container) return
    const move = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const ratio =
        axis === 'col'
          ? (event.clientX - rect.left) / rect.width
          : (event.clientY - rect.top) / rect.height
      const clamped = Math.max(0, Math.min(1, ratio))
      if (axis === 'col') dragColumn(index, clamped)
      else dragRow(index, clamped)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = axis === 'col' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <div className="terminal-area">
      <div className="layout-bar">
        <div className="layout-modes" role="group" aria-label="Terminal düzeni">
          <button
            type="button"
            className={`seg-btn ${!tabs ? 'is-on' : ''}`}
            title="Izgara düzeni"
            aria-pressed={!tabs}
            onClick={() => setMode('grid')}
          >
            <Icon name="grid" size={14} />
            <span className="seg-label">Izgara</span>
          </button>
          <button
            type="button"
            className={`seg-btn ${tabs ? 'is-on' : ''}`}
            title="Sekme düzeni"
            aria-pressed={tabs}
            onClick={() => setMode('tabs')}
          >
            <Icon name="tabs" size={14} />
            <span className="seg-label">Sekme</span>
          </button>
        </div>

        {!tabs && (
          <div className="layout-cols" role="group" aria-label="Sütun sayısı">
            <span className="layout-hint">Sütun</span>
            {COLUMN_CHOICES.map((choice) => (
              <button
                type="button"
                key={choice.value}
                className={`chip ${grid.columns === choice.value ? 'is-on' : ''}`}
                aria-pressed={grid.columns === choice.value}
                onClick={() => setColumns(choice.value)}
              >
                {choice.label}
              </button>
            ))}
            <button
              type="button"
              className="icon-btn"
              title="Pane boyutlarını sıfırla"
              onClick={resetSizes}
            >
              <Icon name="restart" size={14} />
            </button>
          </div>
        )}

        {tabs && (
          <div className="layout-tabs" role="tablist" aria-label="Terminal sekmeleri">
            {sessions.map((s, index) => (
              <button
                type="button"
                key={s.id}
                role="tab"
                aria-selected={s.id === soloId}
                className={`layout-tab ${s.id === soloId ? 'is-active' : ''} ${
                  dropIndex === index ? 'is-drop' : ''
                }`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropIndex(index)
                }}
                onDragEnd={() => {
                  setDragIndex(null)
                  setDropIndex(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndex !== null) onReorder(dragIndex, index)
                  setDragIndex(null)
                  setDropIndex(null)
                }}
                onClick={() => onSelect(s.id)}
              >
                <CliIcon type={s.type} size={13} />
                <span className="layout-tab-label">{s.title}</span>
                {s.status === 'exited' && <span className="layout-tab-dot" />}
                <span
                  className="layout-tab-close"
                  role="presentation"
                  title="Kapat"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(s.id)
                  }}
                >
                  <Icon name="close" size={11} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="terminal-grid"
        ref={gridRef}
        style={{
          gridTemplateColumns: soloId
            ? 'minmax(0, 1fr)'
            : grid.colFractions.map((f) => `minmax(0, ${f}fr)`).join(' '),
          gridTemplateRows: soloId
            ? 'minmax(0, 1fr)'
            : grid.rowFractions.map((f) => `minmax(0, ${f}fr)`).join(' ')
        }}
      >
        {sessions.map((s, i) => {
          const isLast = i === n - 1
          const span = !soloId && isLast && remainder !== 0 ? cols - remainder + 1 : 1
          const hidden = soloId ? s.id !== soloId : false
          return (
            <div
              key={s.id}
              className={`terminal-cell ${dropIndex === i && !tabs ? 'is-drop' : ''}`}
              style={{
                display: hidden ? 'none' : undefined,
                gridColumn: span > 1 ? `span ${span}` : undefined
              }}
              onDragOver={(e) => {
                if (dragIndex === null || tabs) return
                e.preventDefault()
                setDropIndex(i)
              }}
              onDrop={(e) => {
                if (dragIndex === null || tabs) return
                e.preventDefault()
                onReorder(dragIndex, i)
                setDragIndex(null)
                setDropIndex(null)
              }}
            >
              <TerminalPane
                key={`${s.id}:${s.gen}`}
                session={s}
                active={s.id === activeId}
                zoomed={s.id === soloId}
                canZoom={!tabs}
                fontFamily={fontFamily}
                fontSize={fontSize}
                scrollback={scrollback}
                theme={theme}
                onSelect={onSelect}
                onClose={onClose}
                onRestart={onRestart}
                onRename={onRename}
                onToggleZoom={toggleZoom}
                onInput={onInput}
                onBell={onBell}
                onCwdChange={onCwdChange}
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => {
                  setDragIndex(null)
                  setDropIndex(null)
                }}
              />
            </div>
          )
        })}

        {showGridChrome &&
          grid.colBoundaries.map((offset, index) => (
            <div
              key={`col-${index}`}
              className="grid-divider grid-divider-col"
              role="separator"
              aria-orientation="vertical"
              aria-label={`${index + 1}. sütun sınırı`}
              style={{ left: `${offset * 100}%` }}
              onPointerDown={(e) => startBoundaryDrag(e, 'col', index)}
            />
          ))}
        {showGridChrome &&
          grid.rowBoundaries.map((offset, index) => (
            <div
              key={`row-${index}`}
              className="grid-divider grid-divider-row"
              role="separator"
              aria-orientation="horizontal"
              aria-label={`${index + 1}. satır sınırı`}
              style={{ top: `${offset * 100}%` }}
              onPointerDown={(e) => startBoundaryDrag(e, 'row', index)}
            />
          ))}
      </div>

      <div className="prompt-bar">
        <button
          type="button"
          className={`icon-btn broadcast-btn ${broadcast ? 'is-on' : ''}`}
          title={
            broadcast
              ? 'Broadcast açık: girdi tüm terminallere gönderiliyor'
              : 'Broadcast: girdiyi tüm terminallere gönder'
          }
          aria-pressed={broadcast}
          onClick={onToggleBroadcast}
        >
          <Icon name="broadcast" size={15} />
        </button>
        <input
          aria-label={broadcast ? 'Tüm terminallere gönder' : 'Aktif terminale gönder'}
          value={prompt}
          placeholder={
            broadcast ? 'Tüm terminallere gönder…' : 'Aktif terminale gönder… (Enter)'
          }
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              sendPrompt()
            }
          }}
        />
        <button type="button" className="btn btn-small" onClick={sendPrompt} disabled={!prompt}>
          Gönder
        </button>
      </div>
    </div>
  )
}
