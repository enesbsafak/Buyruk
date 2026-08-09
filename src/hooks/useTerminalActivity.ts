import { useCallback, useEffect, useRef, useState } from 'react'
import { useLatestRef } from './useLatestRef'

export type TerminalActivity = 'busy' | 'idle'

const TICK_MS = 400
/** Output has to stay quiet this long before a job counts as finished. */
const SETTLE_MS = 1600
/**
 * Bytes per tick that count as real work. AI CLIs repaint their status line and
 * spinner even while idle, so a low-volume trickle must not read as "busy".
 */
const LOUD_BYTES = 400
/** Only report a finished job if it actually ran for a while. */
const NOTIFY_AFTER_BUSY_MS = 8000

interface UseTerminalActivityOptions {
  /** Called once a terminal that had been busy for a while goes quiet. */
  onSettled: (id: string, busyMs: number) => void
}

interface BusyState {
  startedAt: number
  lastLoudAt: number
  bytesThisTick: number
}

/**
 * Tracks which terminals are working on something.
 *
 * A terminal becomes busy when you submit a line, never on its own — otherwise
 * a chatty TUI would look busy forever. It settles once its output drops to a
 * trickle for a while.
 */
export function useTerminalActivity({ onSettled }: UseTerminalActivityOptions) {
  const [activity, setActivity] = useState<Record<string, TerminalActivity>>({})
  const busy = useRef(new Map<string, BusyState>())
  const settledRef = useLatestRef(onSettled)

  /** Something was submitted to this terminal — start watching it. */
  const markSubmitted = useCallback((id: string) => {
    const now = Date.now()
    const current = busy.current.get(id)
    if (current) {
      current.lastLoudAt = now
      return
    }
    busy.current.set(id, { startedAt: now, lastLoudAt: now, bytesThisTick: 0 })
    setActivity((prev) => (prev[id] === 'busy' ? prev : { ...prev, [id]: 'busy' }))
  }, [])

  const markOutput = useCallback((id: string, bytes: number) => {
    const current = busy.current.get(id)
    if (current) current.bytesThisTick += bytes
  }, [])

  const forgetTerminal = useCallback((id: string) => {
    busy.current.delete(id)
    setActivity((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      const finished: { id: string; busyMs: number }[] = []

      for (const [id, state] of busy.current) {
        if (state.bytesThisTick >= LOUD_BYTES) state.lastLoudAt = now
        state.bytesThisTick = 0
        if (now - state.lastLoudAt < SETTLE_MS) continue
        busy.current.delete(id)
        finished.push({ id, busyMs: state.lastLoudAt - state.startedAt })
      }

      if (finished.length > 0) {
        setActivity((prev) => {
          const next = { ...prev }
          for (const { id } of finished) delete next[id]
          return next
        })
        for (const { id, busyMs } of finished) {
          if (busyMs >= NOTIFY_AFTER_BUSY_MS) settledRef.current(id, busyMs)
        }
      }
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [settledRef])

  return { activity, markSubmitted, markOutput, forgetTerminal }
}
