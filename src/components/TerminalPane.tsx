import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { Icon } from './Icon'
import { CliIcon } from './CliIcon'
import { terminalBus } from '../terminalBus'
import type { SessionRuntime } from '../types'

interface TerminalPaneProps {
  session: SessionRuntime
  active: boolean
  zoomed: boolean
  fontFamily: string
  fontSize: number
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRestart: (session: SessionRuntime) => void
  onRename: (session: SessionRuntime) => void
  onToggleZoom: (id: string) => void
  onInput: (id: string, data: string) => void
  onBell: (id: string) => void
}

export function TerminalPane({
  session,
  active,
  zoomed,
  fontFamily,
  fontSize,
  onSelect,
  onClose,
  onRestart,
  onRename,
  onToggleZoom,
  onInput,
  onBell
}: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const onInputRef = useRef(onInput)
  onInputRef.current = onInput
  const onBellRef = useRef(onBell)
  onBellRef.current = onBell

  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Recreate the terminal on id/restart/font changes.
  useEffect(() => {
    if (!hostRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily,
      fontSize,
      lineHeight: 1.2,
      scrollback: 8000,
      allowProposedApi: true,
      theme: {
        background: '#15161e',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        cursorAccent: '#15161e',
        selectionBackground: '#28344a',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5'
      }
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(search)
    term.open(hostRef.current)
    termRef.current = term
    fitRef.current = fit
    searchRef.current = search

    try {
      fit.fit()
    } catch {
      // host may have zero size initially
    }

    const onData = term.onData((data) => onInputRef.current(session.id, data))
    const onBellEvt = term.onBell(() => onBellRef.current(session.id))
    const unsubscribe = terminalBus.subscribe(session.id, (data) => term.write(data))
    window.api.resizeTerminal(session.id, term.cols, term.rows)

    // Ctrl/Cmd+F opens the in-terminal search bar.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        setShowSearch(true)
        return false
      }
      return true
    })

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit()
        window.api.resizeTerminal(session.id, term.cols, term.rows)
      } catch {
        // ignore transient resize errors
      }
    })
    resizeObserver.observe(hostRef.current)

    return () => {
      onData.dispose()
      onBellEvt.dispose()
      unsubscribe()
      resizeObserver.disconnect()
      term.dispose()
    }
  }, [fontFamily, fontSize, session.id, session.gen])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontFamily = fontFamily
    term.options.fontSize = fontSize
    try {
      fitRef.current?.fit()
      window.api.resizeTerminal(session.id, term.cols, term.rows)
    } catch {
      // ignore
    }
  }, [fontFamily, fontSize, session.id])

  // Refit when zoom state flips (size changes substantially).
  useEffect(() => {
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit()
        const term = termRef.current
        if (term) window.api.resizeTerminal(session.id, term.cols, term.rows)
      } catch {
        // ignore
      }
    })
  }, [zoomed, session.id])

  const exited = session.status === 'exited'

  return (
    <section
      className={`terminal-pane ${active ? 'is-active' : ''} ${exited ? 'is-exited' : ''}`}
      aria-label={`Terminal ${session.title}`}
      onPointerDown={() => onSelect(session.id)}
    >
      <div className="pane-head">
        <CliIcon type={session.type} size={15} />
        <span
          className="pane-title"
          title={`${session.cwd}  ·  başlığı değiştirmek için çift tıkla`}
          onDoubleClick={(e) => {
            e.stopPropagation()
            onRename(session)
          }}
        >
          {session.title}
        </span>
        {exited && <span className="pane-flag">çıkış {session.exitCode ?? '?'}</span>}
        <div className="pane-actions">
          <button
            type="button"
            className={`pane-btn ${showSearch ? 'active' : ''}`}
            title="Ara (Ctrl+F)"
            onClick={(e) => {
              e.stopPropagation()
              setShowSearch((s) => !s)
            }}
          >
            <Icon name="search" size={14} />
          </button>
          <button
            type="button"
            className="pane-btn"
            title="Yeniden başlat"
            onClick={(e) => {
              e.stopPropagation()
              onRestart(session)
            }}
          >
            <Icon name="restart" size={14} />
          </button>
          <button
            type="button"
            className="pane-btn"
            title={zoomed ? 'Küçült' : 'Büyüt'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleZoom(session.id)
            }}
          >
            <Icon name={zoomed ? 'collapse' : 'expand'} size={14} />
          </button>
          <button
            type="button"
            className="pane-btn close"
            title="Kapat"
            onClick={(e) => {
              e.stopPropagation()
              onClose(session.id)
            }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="pane-search" onMouseDown={(e) => e.stopPropagation()}>
          <Icon name="search" size={13} />
          <input
            aria-label="Terminalde ara"
            value={searchTerm}
            placeholder="Terminalde ara…"
            onChange={(e) => {
              const value = e.target.value
              setSearchTerm(value)
              if (value) searchRef.current?.findNext(value, { incremental: true })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.shiftKey) searchRef.current?.findPrevious(searchTerm)
                else searchRef.current?.findNext(searchTerm)
              }
              if (e.key === 'Escape') {
                setShowSearch(false)
                termRef.current?.focus()
              }
            }}
          />
          <button
            type="button"
            className="pane-btn"
            title="Önceki"
            onClick={() => searchRef.current?.findPrevious(searchTerm)}
          >
            <Icon name="chevron" size={13} className="rot-up" />
          </button>
          <button
            type="button"
            className="pane-btn"
            title="Sonraki"
            onClick={() => searchRef.current?.findNext(searchTerm)}
          >
            <Icon name="chevron" size={13} className="rot-down" />
          </button>
          <button
            type="button"
            className="pane-btn"
            title="Kapat"
            onClick={() => {
              setShowSearch(false)
              termRef.current?.focus()
            }}
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      )}

      <div className="xterm-host" ref={hostRef} />

      {exited && (
        <div className="pane-exit-overlay">
          <button
            type="button"
            className="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation()
              onRestart(session)
            }}
          >
            <Icon name="restart" size={14} /> Yeniden başlat
          </button>
        </div>
      )}
    </section>
  )
}
