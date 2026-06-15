import { useCallback, useId, useRef, useState } from 'react'
import '@xterm/xterm/css/xterm.css'
import {
  TerminalExitOverlay,
  TerminalFollowButton,
  TerminalPaneHeader,
  TerminalScrollRail,
  TerminalSearchBar
} from './TerminalPaneControls'
import {
  INITIAL_TERMINAL_SCROLL,
  useXtermSession,
  type TerminalScrollState
} from '../hooks/useXtermSession'
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

function sameScrollState(a: TerminalScrollState, b: TerminalScrollState) {
  return a.viewportY === b.viewportY && a.baseY === b.baseY && a.rows === b.rows
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
  const terminalBodyId = useId()
  const hostRef = useRef<HTMLDivElement>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [scrollState, setScrollState] = useState(INITIAL_TERMINAL_SCROLL)

  const handleScrollStateChange = useCallback((next: TerminalScrollState) => {
    setScrollState((prev) => (sameScrollState(prev, next) ? prev : next))
  }, [])

  const openSearch = useCallback(() => {
    setShowSearch(true)
  }, [])

  const { searchRef, focusTerminal, scrollToBottom, scrollToLine } = useXtermSession({
    hostRef,
    session,
    fontFamily,
    fontSize,
    zoomed,
    onInput,
    onBell,
    onOpenSearch: openSearch,
    onScrollStateChange: handleScrollStateChange
  })

  const closeSearch = useCallback(() => {
    setShowSearch(false)
    focusTerminal()
  }, [focusTerminal])

  const changeSearchTerm = useCallback(
    (value: string) => {
      setSearchTerm(value)
      if (value) searchRef.current?.findNext(value, { incremental: true })
    },
    [searchRef]
  )

  const exited = session.status === 'exited'

  return (
    <section
      className={`terminal-pane ${active ? 'is-active' : ''} ${exited ? 'is-exited' : ''}`}
      aria-label={`Terminal ${session.title}`}
      onPointerDown={() => onSelect(session.id)}
    >
      <TerminalPaneHeader
        session={session}
        exited={exited}
        showSearch={showSearch}
        zoomed={zoomed}
        onRename={onRename}
        onRestart={onRestart}
        onToggleZoom={onToggleZoom}
        onClose={onClose}
        onToggleSearch={() => setShowSearch((visible) => !visible)}
      />

      {showSearch && (
        <TerminalSearchBar
          searchTerm={searchTerm}
          searchRef={searchRef}
          onSearchTermChange={changeSearchTerm}
          onClose={closeSearch}
        />
      )}

      <div className="xterm-shell">
        <div id={terminalBodyId} className="xterm-host" ref={hostRef} />
        <TerminalScrollRail
          controlsId={terminalBodyId}
          scrollState={scrollState}
          onScrollToLine={scrollToLine}
        />
        {!scrollState.atBottom && !exited && <TerminalFollowButton onClick={scrollToBottom} />}
      </div>

      {exited && <TerminalExitOverlay session={session} onRestart={onRestart} />}
    </section>
  )
}
