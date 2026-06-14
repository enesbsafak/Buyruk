import { useState } from 'react'
import { Icon } from './Icon'
import { TerminalPane } from './TerminalPane'
import type { SessionRuntime } from '../types'

interface TerminalAreaProps {
  sessions: SessionRuntime[]
  activeId: string | null
  fontFamily: string
  fontSize: number
  broadcast: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRestart: (session: SessionRuntime) => void
  onRename: (session: SessionRuntime) => void
  onInput: (id: string, data: string) => void
  onBell: (id: string) => void
}

export function TerminalArea({
  sessions,
  activeId,
  fontFamily,
  fontSize,
  broadcast,
  onSelect,
  onClose,
  onRestart,
  onRename,
  onInput,
  onBell
}: TerminalAreaProps) {
  const [zoomedId, setZoomedId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const n = sessions.length

  if (n === 0) {
    return (
      <div className="terminal-area">
        <div className="placeholder">
          <div className="placeholder-icon">
            <Icon name="terminal" size={26} />
          </div>
          <div className="placeholder-title">Çalışmaya başla</div>
          <div className="placeholder-text">
            CMD, PowerShell, Claude veya Codex oturumu açmak için bir klasör seç. Birden
            fazla terminal açtığında otomatik olarak yan yana döşenir.
          </div>
        </div>
      </div>
    )
  }

  const zoom = sessions.some((s) => s.id === zoomedId) ? zoomedId : null
  const toggleZoom = (id: string) => setZoomedId((z) => (z === id ? null : id))

  const cols = zoom ? 1 : Math.ceil(Math.sqrt(n))
  const rows = zoom ? 1 : Math.ceil(n / cols)
  const remainder = n % cols

  const sendPrompt = () => {
    if (!prompt || !activeId) return
    onInput(activeId, prompt + '\r')
    setPrompt('')
  }

  return (
    <div className="terminal-area">
      <div
        className="terminal-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
        }}
      >
        {sessions.map((s, i) => {
          const isLast = i === n - 1
          const span = !zoom && isLast && remainder !== 0 ? cols - remainder + 1 : 1
          const hidden = zoom ? s.id !== zoom : false
          return (
            <div
              key={s.id}
              style={{
                display: hidden ? 'none' : undefined,
                gridColumn: span > 1 ? `span ${span}` : undefined
              }}
            >
              <TerminalPane
                session={s}
                active={s.id === activeId}
                zoomed={s.id === zoom}
                fontFamily={fontFamily}
                fontSize={fontSize}
                onSelect={onSelect}
                onClose={onClose}
                onRestart={onRestart}
                onRename={onRename}
                onToggleZoom={toggleZoom}
                onInput={onInput}
                onBell={onBell}
              />
            </div>
          )
        })}
      </div>

      <div className="prompt-bar">
        <Icon name={broadcast ? 'broadcast' : 'terminal'} size={15} />
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
