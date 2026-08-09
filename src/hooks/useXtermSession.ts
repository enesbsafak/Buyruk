import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { SerializeAddon } from '@xterm/addon-serialize'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { terminalBus } from '../terminalBus'
import { terminalTheme } from '../terminalTheme'
import { parseOsc7 } from '../utils/osc7'
import { useLatestRef } from './useLatestRef'
import type { SessionRuntime, ThemeName } from '../types'

export interface TerminalScrollState {
  viewportY: number
  baseY: number
  rows: number
  atBottom: boolean
}

export const INITIAL_TERMINAL_SCROLL: TerminalScrollState = {
  viewportY: 0,
  baseY: 0,
  rows: 0,
  atBottom: true
}

interface UseXtermSessionOptions {
  hostRef: RefObject<HTMLDivElement>
  session: SessionRuntime
  fontFamily: string
  fontSize: number
  scrollback: number
  theme: ThemeName
  zoomed: boolean
  onInput: (id: string, data: string) => void
  onBell: (id: string) => void
  onOpenSearch: () => void
  onScrollStateChange: (state: TerminalScrollState) => void
  onCwdChange: (id: string, cwd: string) => void
}

// Lines of scrollback kept when a session is saved for the next launch. Enough
// to see what you were doing without bloating localStorage.
const RESTORE_LINES = 600

function getScrollState(term: Terminal, viewportY = term.buffer.active.viewportY) {
  const baseY = term.buffer.active.baseY
  return {
    viewportY,
    baseY,
    rows: term.rows,
    atBottom: viewportY >= baseY
  }
}

export function useXtermSession({
  hostRef,
  session,
  fontFamily,
  fontSize,
  scrollback,
  theme,
  zoomed,
  onInput,
  onBell,
  onOpenSearch,
  onScrollStateChange,
  onCwdChange
}: UseXtermSessionOptions) {
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const serializeRef = useRef<SerializeAddon | null>(null)
  const lastScrollKeyRef = useRef('')
  const lastScrollStateRef = useRef(INITIAL_TERMINAL_SCROLL)
  // Last dimensions actually sent to the pty, so dragging a split divider only
  // costs an IPC round-trip when the character grid really changes.
  const lastSizeRef = useRef({ cols: 0, rows: 0 })
  const latestRef = useLatestRef({
    fontFamily,
    fontSize,
    scrollback,
    theme,
    onInput,
    onBell,
    onOpenSearch,
    onScrollStateChange,
    onCwdChange
  })

  const pushSize = useCallback(
    (term: Terminal) => {
      const last = lastSizeRef.current
      if (last.cols === term.cols && last.rows === term.rows) return
      lastSizeRef.current = { cols: term.cols, rows: term.rows }
      window.api.resizeTerminal(session.id, term.cols, term.rows)
    },
    [session.id]
  )

  const notifyScrollState = useCallback((term: Terminal, viewportY?: number) => {
    const next = getScrollState(term, viewportY)
    const key = `${next.viewportY}:${next.baseY}:${next.rows}`
    lastScrollStateRef.current = next
    if (lastScrollKeyRef.current === key) return
    lastScrollKeyRef.current = key
    latestRef.current.onScrollStateChange(next)
  }, [])

  const fitAndResize = useCallback((followBottom = false) => {
    const term = termRef.current
    if (!term) return
    try {
      const shouldFollowBottom = followBottom || lastScrollStateRef.current.atBottom
      fitRef.current?.fit()
      pushSize(term)
      if (shouldFollowBottom) term.scrollToBottom()
      notifyScrollState(term)
    } catch {
      // ignore transient resize errors
    }
  }, [notifyScrollState, pushSize])

  const pasteFromClipboard = useCallback(() => {
    const term = termRef.current
    if (!term) return
    const text = window.api.clipboardReadText()
    if (text) {
      term.paste(text)
      term.focus()
      return
    }
    // Claude Code accepts images pasted through its own Esc-v handshake.
    if (session.type === 'claude' && window.api.clipboardHasImage()) {
      latestRef.current.onInput(session.id, '\x1bv')
    }
    term.focus()
  }, [session.id, session.type])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: latestRef.current.fontFamily,
      fontSize: latestRef.current.fontSize,
      lineHeight: 1.2,
      scrollback: latestRef.current.scrollback,
      allowProposedApi: true,
      theme: terminalTheme(latestRef.current.theme)
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    const serialize = new SerializeAddon()
    const unicode11 = new Unicode11Addon()
    term.loadAddon(fit)
    term.loadAddon(search)
    term.loadAddon(serialize)
    term.loadAddon(unicode11)
    term.unicode.activeVersion = '11'
    // Links open in the system browser: the renderer itself denies window.open.
    term.loadAddon(
      new WebLinksAddon((_event, uri) => {
        void window.api.openExternal(uri).catch(() => {})
      })
    )
    term.open(host)
    termRef.current = term
    fitRef.current = fit
    searchRef.current = search
    serializeRef.current = serialize
    lastScrollKeyRef.current = ''
    lastScrollStateRef.current = INITIAL_TERMINAL_SCROLL
    lastSizeRef.current = { cols: 0, rows: 0 }

    // GPU rendering; falls back to the DOM renderer if the context is
    // unavailable or is lost later (driver reset, GPU process crash).
    // Never dispose this manually: term.dispose() disposes loaded addons, and
    // disposing twice throws while the pane is unmounting.
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch {
      // WebGL unavailable; the DOM renderer stays in place.
    }

    try {
      fit.fit()
    } catch {
      // host may have zero size initially
    }

    let disposed = false
    const syncScrollState = () => {
      if (!disposed) notifyScrollState(term)
    }
    const onData = term.onData((data) => latestRef.current.onInput(session.id, data))
    const onBellEvt = term.onBell(() => latestRef.current.onBell(session.id))
    const onScroll = term.onScroll((position) => notifyScrollState(term, position))

    // Shell integration: the shell reports its working directory via OSC 7 so the
    // file explorer can follow `cd`. Returning true marks the sequence handled.
    term.parser.registerOscHandler(7, (payload) => {
      const cwd = parseOsc7(payload)
      if (cwd) latestRef.current.onCwdChange(session.id, cwd)
      return true
    })

    // Replay the previous run's scrollback before live output starts flowing.
    if (session.gen === 0 && session.restoredScrollback) {
      term.write(
        `${session.restoredScrollback}\r\n\x1b[2m── önceki oturum burada bitti ──\x1b[0m\r\n`
      )
    }

    const unsubscribe = terminalBus.subscribe(session.id, (data) => term.write(data, syncScrollState))

    pushSize(term)
    requestAnimationFrame(syncScrollState)

    term.attachCustomKeyEventHandler((e) => {
      const hasPrimaryModifier = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (e.type === 'keydown' && hasPrimaryModifier && key === 'f') {
        latestRef.current.onOpenSearch()
        return false
      }

      if (
        e.type === 'keydown' &&
        hasPrimaryModifier &&
        !e.altKey &&
        !e.shiftKey &&
        key === 'c' &&
        term.hasSelection()
      ) {
        window.api.copyText(term.getSelection())
        term.clearSelection()
        return false
      }

      if (
        e.type === 'keydown' &&
        hasPrimaryModifier &&
        !e.altKey &&
        !e.shiftKey &&
        key === 'v'
      ) {
        pasteFromClipboard()
        return false
      }

      return true
    })

    // Coalesce resize bursts (split-divider drags fire one per frame) into a
    // single fit per animation frame.
    let resizeFrame = 0
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame) return
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0
        if (disposed) return
        try {
          fit.fit()
          pushSize(term)
          if (lastScrollStateRef.current.atBottom) term.scrollToBottom()
          notifyScrollState(term)
        } catch {
          // ignore transient resize errors
        }
      })
    })
    resizeObserver.observe(host)

    return () => {
      disposed = true
      if (resizeFrame) cancelAnimationFrame(resizeFrame)
      onData.dispose()
      onBellEvt.dispose()
      onScroll.dispose()
      unsubscribe()
      resizeObserver.disconnect()
      // Clear the refs first: a stray callback must not reach a disposed terminal.
      termRef.current = null
      fitRef.current = null
      searchRef.current = null
      serializeRef.current = null
      term.dispose()
    }
  }, [hostRef, notifyScrollState, pasteFromClipboard, pushSize, session.gen, session.id, session.type])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontFamily = fontFamily
    term.options.fontSize = fontSize
    fitAndResize()
  }, [fitAndResize, fontFamily, fontSize])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.theme = terminalTheme(theme)
  }, [theme])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.scrollback = scrollback
  }, [scrollback])

  useEffect(() => {
    requestAnimationFrame(() => fitAndResize(true))
  }, [fitAndResize, zoomed])

  const focusTerminal = useCallback(() => {
    termRef.current?.focus()
  }, [])

  const hasSelection = useCallback(() => termRef.current?.hasSelection() ?? false, [])

  const copySelection = useCallback(() => {
    const term = termRef.current
    if (!term?.hasSelection()) return
    void window.api.copyText(term.getSelection())
    term.clearSelection()
    term.focus()
  }, [])

  const selectAll = useCallback(() => {
    const term = termRef.current
    if (!term) return
    term.selectAll()
    term.focus()
  }, [])

  const clearTerminal = useCallback(() => {
    const term = termRef.current
    if (!term) return
    term.clear()
    term.focus()
    notifyScrollState(term)
  }, [notifyScrollState])

  const snapshot = useCallback((): string => {
    try {
      return serializeRef.current?.serialize({ scrollback: RESTORE_LINES }) ?? ''
    } catch {
      return ''
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    const term = termRef.current
    if (!term) return
    term.scrollToBottom()
    term.focus()
    notifyScrollState(term, term.buffer.active.baseY)
  }, [notifyScrollState])

  const scrollToLine = useCallback(
    (line: number) => {
      const term = termRef.current
      if (!term) return
      const maxLine = term.buffer.active.baseY
      const nextLine = Math.max(0, Math.min(Math.round(line), maxLine))
      term.scrollToLine(nextLine)
      term.focus()
      notifyScrollState(term, nextLine)
    },
    [notifyScrollState]
  )

  return {
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
  }
}
