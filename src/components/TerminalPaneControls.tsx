import { useRef, type RefObject } from 'react'
import type { SearchAddon } from '@xterm/addon-search'
import { Icon } from './Icon'
import { CliIcon } from './CliIcon'
import type { TerminalScrollState } from '../hooks/useXtermSession'
import type { SessionRuntime } from '../types'

interface TerminalPaneHeaderProps {
  session: SessionRuntime
  exited: boolean
  showSearch: boolean
  zoomed: boolean
  onRename: (session: SessionRuntime) => void
  onRestart: (session: SessionRuntime) => void
  onToggleZoom: (id: string) => void
  onClose: (id: string) => void
  onToggleSearch: () => void
}

export function TerminalPaneHeader({
  session,
  exited,
  showSearch,
  zoomed,
  onRename,
  onRestart,
  onToggleZoom,
  onClose,
  onToggleSearch
}: TerminalPaneHeaderProps) {
  return (
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
            onToggleSearch()
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
  )
}

interface TerminalSearchBarProps {
  searchTerm: string
  searchRef: RefObject<SearchAddon | null>
  onSearchTermChange: (value: string) => void
  onClose: () => void
}

export function TerminalSearchBar({
  searchTerm,
  searchRef,
  onSearchTermChange,
  onClose
}: TerminalSearchBarProps) {
  return (
    <div className="pane-search" onMouseDown={(e) => e.stopPropagation()}>
      <Icon name="search" size={13} />
      <input
        aria-label="Terminalde ara"
        value={searchTerm}
        placeholder="Terminalde ara…"
        onChange={(e) => onSearchTermChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (e.shiftKey) searchRef.current?.findPrevious(searchTerm)
            else searchRef.current?.findNext(searchTerm)
          }
          if (e.key === 'Escape') onClose()
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
      <button type="button" className="pane-btn" title="Kapat" onClick={onClose}>
        <Icon name="close" size={13} />
      </button>
    </div>
  )
}

interface TerminalScrollRailProps {
  controlsId: string
  scrollState: TerminalScrollState
  onScrollToLine: (line: number) => void
}

export function TerminalScrollRail({
  controlsId,
  scrollState,
  onScrollToLine
}: TerminalScrollRailProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const dragOffsetRef = useRef(0)
  const scrollable = scrollState.baseY > 0

  if (!scrollable) return null

  const totalRows = scrollState.baseY + scrollState.rows
  const thumbHeight = Math.max(14, Math.min(88, (scrollState.rows / totalRows) * 100))
  const travel = Math.max(0, 100 - thumbHeight)
  const thumbTop = Math.min(travel, (scrollState.viewportY / scrollState.baseY) * travel)

  const dragTo = (clientY: number) => {
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    const thumbPixels = rect.height * (thumbHeight / 100)
    const availablePixels = Math.max(1, rect.height - thumbPixels)
    const y = clientY - rect.top - dragOffsetRef.current
    const ratio = Math.max(0, Math.min(1, y / availablePixels))
    onScrollToLine(ratio * scrollState.baseY)
  }

  return (
    <div
      ref={railRef}
      className="pane-scroll-rail"
      role="scrollbar"
      aria-label="Terminal kaydırma"
      aria-controls={controlsId}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={scrollState.baseY}
      aria-valuenow={scrollState.viewportY}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        pointerIdRef.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)

        const thumb = thumbRef.current
        const thumbRect = thumb?.getBoundingClientRect()
        const target = e.target as Node
        dragOffsetRef.current =
          thumb && thumbRect && thumb.contains(target)
            ? e.clientY - thumbRect.top
            : (railRef.current?.clientHeight ?? 0) * (thumbHeight / 200)
        dragTo(e.clientY)
      }}
      onPointerMove={(e) => {
        if (pointerIdRef.current !== e.pointerId) return
        e.preventDefault()
        e.stopPropagation()
        dragTo(e.clientY)
      }}
      onPointerUp={(e) => {
        if (pointerIdRef.current !== e.pointerId) return
        e.preventDefault()
        e.stopPropagation()
        pointerIdRef.current = null
        dragOffsetRef.current = 0
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
    >
      <div
        ref={thumbRef}
        className="pane-scroll-thumb"
        style={{
          top: `${thumbTop}%`,
          height: `${thumbHeight}%`
        }}
      />
    </div>
  )
}

interface TerminalFollowButtonProps {
  onClick: () => void
}

export function TerminalFollowButton({ onClick }: TerminalFollowButtonProps) {
  return (
    <button
      type="button"
      className="pane-follow"
      title="Terminalde en alta git"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <Icon name="chevron" size={13} className="rot-down" />
      <span>Güncele git</span>
    </button>
  )
}

interface TerminalExitOverlayProps {
  session: SessionRuntime
  onRestart: (session: SessionRuntime) => void
}

export function TerminalExitOverlay({ session, onRestart }: TerminalExitOverlayProps) {
  return (
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
  )
}
