import { useEffect, useState } from 'react'
import type { FileNode } from '../types'

interface DirState {
  nodes: FileNode[] | null
  error: string | null
}

interface LoadedDirState extends DirState {
  key: string
}

// Lazily reads a single directory's children. Re-reads whenever `path` or the
// shared `refreshNonce` changes. Each expanded folder uses its own instance,
// giving the tree lazy, on-demand loading.
export function useFileTree(path: string, refreshNonce: number): DirState {
  const stateKey = `${path}\0${refreshNonce}`
  const [state, setState] = useState<LoadedDirState>({ key: '', nodes: null, error: null })

  useEffect(() => {
    let cancelled = false
    window.api
      .readDir(path)
      .then((nodes) => {
        if (!cancelled) setState({ key: stateKey, nodes, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setState({ key: stateKey, nodes: null, error: message })
        }
      })
    return () => {
      cancelled = true
    }
  }, [path, stateKey])

  return state.key === stateKey ? state : { nodes: null, error: null }
}
