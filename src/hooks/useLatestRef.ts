import { useEffect, useRef, type MutableRefObject } from 'react'

/**
 * Keeps a ref pointing at the newest value without writing to it during render.
 * Long-lived listeners — IPC subscriptions, window events, xterm handlers — read
 * through the ref, so they never have to be torn down when the value changes.
 *
 * Only read `.current` from callbacks and effects. During render it may still
 * hold the previous value by one commit, which is exactly what makes render pure.
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}
