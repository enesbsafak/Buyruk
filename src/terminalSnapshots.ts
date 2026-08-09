// Each mounted terminal pane registers a snapshot function here. On shutdown the
// app collects them so the next launch can replay what was on screen. Serializing
// is only done at that moment — never on every render.

type SnapshotFn = () => string

const providers = new Map<string, SnapshotFn>()

export const terminalSnapshots = {
  register(id: string, fn: SnapshotFn): () => void {
    providers.set(id, fn)
    return () => {
      if (providers.get(id) === fn) providers.delete(id)
    }
  },

  capture(id: string): string {
    try {
      return providers.get(id)?.() ?? ''
    } catch {
      return ''
    }
  }
}
