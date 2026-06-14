import { useMemo, useState } from 'react'
import { Icon, type IconName } from './Icon'

export interface Command {
  id: string
  label: string
  hint?: string
  icon?: IconName
  run: () => void
}

interface CommandPaletteProps {
  commands: Command[]
  onClose: () => void
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [query, commands])

  const run = (cmd: Command | undefined) => {
    if (!cmd) return
    onClose()
    cmd.run()
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="quickopen" role="presentation" onMouseDown={(e) => e.stopPropagation()}>
        <div className="quickopen-input">
          <Icon name="bolt" size={15} />
          <input
            aria-label="Komut ara"
            value={query}
            placeholder="Komut ara…"
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(i + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') {
                run(results[index])
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
          />
        </div>
        <div className="quickopen-list">
          {results.length === 0 && <div className="quickopen-empty">Komut yok</div>}
          {results.map((c, i) => (
            <button
              type="button"
              key={c.id}
              className={`quickopen-item ${i === index ? 'is-active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(c)}
            >
              <Icon name={c.icon ?? 'bolt'} size={14} />
              <span className="qo-name">{c.label}</span>
              {c.hint && <span className="qo-path">{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
