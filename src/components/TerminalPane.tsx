import { useCallback, useEffect, useId, useRef, useState } from 'react'
import '@xterm/xterm/css/xterm.css'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { terminalSnapshots } from '../terminalSnapshots'
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
import type { SessionRuntime, ThemeName } from '../types'

interface TerminalPaneProps {
  session: SessionRuntime
  active: boolean
  zoomed: boolean
  canZoom: boolean
  fontFamily: string
  fontSize: number
  scrollback: number
  theme: ThemeName
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRestart: (session: SessionRuntime) => void
  onRename: (session: SessionRuntime) => void
  onToggleZoom: (id: string) => void
  onInput: (id: string, data: string) => void
  onBell: (id: string) => void
  onCwdChange: (id: string, cwd: string) => void
  onDragStart: () => void
  onDragEnd: () => void
}

function sameScrollState(a: TerminalScrollState, b: TerminalScrollState) {
  return a.viewportY === b.viewportY && a.baseY === b.baseY && a.rows === b.rows
}

export function TerminalPane({
  session,
  active,
  zoomed,
  canZoom,
  fontFamily,
  fontSize,
  scrollback,
  theme,
  onSelect,
  onClose,
  onRestart,
  onRename,
  onToggleZoom,
  onInput,
  onBell,
  onCwdChange,
  onDragStart,
  onDragEnd
}: TerminalPaneProps) {
  const terminalBodyId = useId()
  const hostRef = useRef<HTMLDivElement>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [scrollState, setScrollState] = useState(INITIAL_TERMINAL_SCROLL)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const handleScrollStateChange = useCallback((next: TerminalScrollState) => {
    setScrollState((prev) => (sameScrollState(prev, next) ? prev : next))
  }, [])

  const openSearch = useCallback(() => {
    setShowSearch(true)
  }, [])

  const {
    searchRef,
    focusTerminal,
    scrollToBottom,
    scrollToLine,
    hasSelection,
    copySelection,
    pasteFromClipboard,
    selectAll,
    clearTerminal,
    snapshot
  } = useXtermSession({
    hostRef,
    session,
    fontFamily,
    fontSize,
    scrollback,
    theme,
    zoomed,
    onInput,
    onBell,
    onOpenSearch: openSearch,
    onScrollStateChange: handleScrollStateChange,
    onCwdChange
  })

  useEffect(
    () => terminalSnapshots.register(session.id, snapshot),
    [session.id, snapshot]
  )

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

  const menuItems = useCallback(
    (): MenuItem[] => [
      {
        label: 'Kopyala',
        icon: 'file',
        onClick: copySelection,
        disabled: !hasSelection()
      },
      { label: 'Yapıştır', icon: 'save', onClick: pasteFromClipboard },
      { label: 'Tümünü seç', icon: 'expand', onClick: selectAll },
      { separator: true },
      { label: 'Ara', icon: 'search', onClick: openSearch },
      { label: 'Ekranı temizle', icon: 'trash', onClick: clearTerminal }
    ],
    [clearTerminal, copySelection, hasSelection, openSearch, pasteFromClipboard, selectAll]
  )

  const exited = session.status === 'exited'

  return (
    <section
      className={`terminal-pane ${active ? 'is-active' : ''} ${exited ? 'is-exited' : ''}`}
      aria-label={`Terminal ${session.title}`}
      onPointerDown={() => onSelect(session.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      <TerminalPaneHeader
        session={session}
        exited={exited}
        showSearch={showSearch}
        zoomed={zoomed}
        canZoom={canZoom}
        onRename={onRename}
        onRestart={onRestart}
        onToggleZoom={onToggleZoom}
        onClose={onClose}
        onToggleSearch={() => setShowSearch((visible) => !visible)}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
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

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />
      )}
    </section>
  )
}
