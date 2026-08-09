import { useCallback, useEffect, useRef, useState } from 'react'
import { useLatestRef } from './useLatestRef'

export type TerminalActivity = 'busy' | 'idle'

// A terminal counts as busy while output keeps arriving, and settles this long
// after the last byte. Long enough to ride out the gaps in a chatty AI CLI.
const SETTLE_MS = 1200
const TICK_MS = 400

/** Only report a finished job if it actually ran for a while. */
const NOTIFY_AFTER_BUSY_MS = 8000

interface UseTerminalActivityOptions {
  /** Called once a terminal that had been busy for a while goes quiet. */
  onSettled: (id: string, busyMs: number) => void
}

/**
 * Derives a busy/idle state per terminal from the raw output stream. The stream
 * is far too chatty to drive React directly, so timestamps are collected in a
 * ref and folded into state on a slow timer.
 */
export function useTerminalActivity({ onSettled }: UseTerminalActivityOptions) {
  const [activity, setActivity] = useState<Record<string, TerminalActivity>>({})
  const lastDataAt = useRef(new Map<string, number>())
  const busySince = useRef(new Map<string, number>())
  const settledRef = useLatestRef(onSettled)

  const markActivity = useCallback((id: string) => {
    const now = Date.now()
    lastDataAt.current.set(id, now)
    if (!busySince.current.has(id)) busySince.current.set(id, now)
  }, [])

  const forgetTerminal = useCallback((id: string) => {
    lastDataAt.current.delete(id)
    busySince.current.delete(id)
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
      const settled: { id: string; busyMs: number }[] = []
      const next: Record<string, TerminalActivity> = {}

      for (const [id, at] of lastDataAt.current) {
        if (now - at < SETTLE_MS) {
          next[id] = 'busy'
          continue
        }
        next[id] = 'idle'
        const startedAt = busySince.current.get(id)
        if (startedAt !== undefined) {
          busySince.current.delete(id)
          settled.push({ id, busyMs: at - startedAt })
        }
      }

      setActivity((prev) => {
        const sameSize = Object.keys(prev).length === Object.keys(next).length
        if (sameSize && Object.keys(next).every((id) => prev[id] === next[id])) return prev
        return next
      })

      for (const { id, busyMs } of settled) {
        if (busyMs >= NOTIFY_AFTER_BUSY_MS) settledRef.current(id, busyMs)
      }
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [settledRef])

  return { activity, markActivity, forgetTerminal }
}
