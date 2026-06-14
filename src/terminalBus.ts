// A tiny per-terminal event bus. The single global `onTerminalData` listener in
// App pushes data here; each TerminalPane subscribes by id. Data that arrives
// before a pane has mounted is buffered and flushed on subscription, so no early
// terminal output is ever lost.

type DataListener = (data: string) => void

const listeners = new Map<string, DataListener>()
const buffers = new Map<string, string[]>()

export const terminalBus = {
  push(id: string, data: string): void {
    const listener = listeners.get(id)
    if (listener) {
      listener(data)
      return
    }
    const buffer = buffers.get(id) ?? []
    buffer.push(data)
    buffers.set(id, buffer)
  },

  subscribe(id: string, listener: DataListener): () => void {
    listeners.set(id, listener)
    const buffered = buffers.get(id)
    if (buffered) {
      buffered.forEach(listener)
      buffers.delete(id)
    }
    return () => {
      if (listeners.get(id) === listener) listeners.delete(id)
    }
  },

  clear(id: string): void {
    listeners.delete(id)
    buffers.delete(id)
  }
}
