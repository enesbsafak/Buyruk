import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { basename } from '../utils/pathUtils'
import { fuzzyScore } from '../utils/fuzzy'

interface QuickOpenProps {
  root: string
  hidden: string[]
  onPick: (path: string) => void
  onClose: () => void
}

function relativeOf(root: string, f: string): string {
  return f.toLowerCase().startsWith(root.toLowerCase())
    ? f.slice(root.length).replace(/^[\\/]/, '')
    : f
}

export function QuickOpen({ root, hidden, onPick, onClose }: QuickOpenProps) {
  const [files, setFiles] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.api
      .listFiles(root, hidden)
      .then((f) => !cancelled && setFiles(f))
      .catch(() => !cancelled && setFiles([]))
    return () => {
      cancelled = true
    }
  }, [root, hidden])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return files.slice(0, 200)
    const scored: { p: string; s: number }[] = []
    for (const f of files) {
      const s = fuzzyScore(q, basename(f).toLowerCase(), f.toLowerCase())
      if (s >= 0) scored.push({ p: f, s })
    }
    scored.sort((a, b) => b.s - a.s)
    return scored.slice(0, 200).map((x) => x.p)
  }, [query, files])

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="quickopen" role="presentation" onMouseDown={(e) => e.stopPropagation()}>
        <div className="quickopen-input">
          <Icon name="search" size={15} />
          <input
            aria-label="Dosya ara"
            value={query}
            placeholder="Dosya ara… (Ctrl+P)"
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
                const f = results[index]
                if (f) {
                  onPick(f)
                  onClose()
                }
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
          />
          <span className="quickopen-count">{results.length}</span>
        </div>
        <div className="quickopen-list">
          {results.length === 0 && <div className="quickopen-empty">Eşleşme yok</div>}
          {results.map((f, i) => (
            <button
              type="button"
              key={f}
              className={`quickopen-item ${i === index ? 'is-active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                onPick(f)
                onClose()
              }}
            >
              <Icon name="file" size={14} />
              <span className="qo-name">{basename(f)}</span>
              <span className="qo-path">{relativeOf(root, f)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
