import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { terminalBus } from '../terminalBus'
import type { SessionRuntime } from '../types'

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
  zoomed: boolean
  onInput: (id: string, data: string) => void
  onBell: (id: string) => void
  onOpenSearch: () => void
  onScrollStateChange: (state: TerminalScrollState) => void
}

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
  zoomed,
  onInput,
  onBell,
  onOpenSearch,
  onScrollStateChange
}: UseXtermSessionOptions) {
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const lastScrollKeyRef = useRef('')
  const latestRef = useRef({
    fontFamily,
    fontSize,
    onInput,
    onBell,
    onOpenSearch,
    onScrollStateChange
  })

  latestRef.current = {
    fontFamily,
    fontSize,
    onInput,
    onBell,
    onOpenSearch,
    onScrollStateChange
  }

  const notifyScrollState = useCallback((term: Terminal, viewportY?: number) => {
    const next = getScrollState(term, viewportY)
    const key = `${next.viewportY}:${next.baseY}:${next.rows}`
    if (lastScrollKeyRef.current === key) return
    lastScrollKeyRef.current = key
    latestRef.current.onScrollStateChange(next)
  }, [])

  const fitAndResize = useCallback(() => {
    const term = termRef.current
    if (!term) return
    try {
      fitRef.current?.fit()
      window.api.resizeTerminal(session.id, term.cols, term.rows)
      notifyScrollState(term)
    } catch {
      // ignore transient resize errors
    }
  }, [notifyScrollState, session.id])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: latestRef.current.fontFamily,
      fontSize: latestRef.current.fontSize,
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
    term.open(host)
    termRef.current = term
    fitRef.current = fit
    searchRef.current = search
    lastScrollKeyRef.current = ''

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
    const unsubscribe = terminalBus.subscribe(session.id, (data) => term.write(data, syncScrollState))

    window.api.resizeTerminal(session.id, term.cols, term.rows)
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
        key === 'v'
      ) {
        const text = window.api.clipboardReadText()
        if (text) {
          term.paste(text)
          return false
        }

        if (session.type === 'claude' && window.api.clipboardHasImage()) {
          latestRef.current.onInput(session.id, '\x1bv')
          return false
        }
      }

      return true
    })

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit()
        window.api.resizeTerminal(session.id, term.cols, term.rows)
        notifyScrollState(term)
      } catch {
        // ignore transient resize errors
      }
    })
    resizeObserver.observe(host)

    return () => {
      disposed = true
      onData.dispose()
      onBellEvt.dispose()
      onScroll.dispose()
      unsubscribe()
      resizeObserver.disconnect()
      term.dispose()
    }
  }, [hostRef, notifyScrollState, session.gen, session.id, session.type])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontFamily = fontFamily
    term.options.fontSize = fontSize
    fitAndResize()
  }, [fitAndResize, fontFamily, fontSize])

  useEffect(() => {
    requestAnimationFrame(fitAndResize)
  }, [fitAndResize, zoomed])

  const focusTerminal = useCallback(() => {
    termRef.current?.focus()
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
    scrollToLine
  }
}
