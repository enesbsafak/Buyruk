import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadExpandedDirs, saveExpandedDirs } from '../utils/persistence'
import type { FileNode } from '../types'

interface DirState {
  nodes: FileNode[]
  error: string | null
  /** True while a re-read is in flight; previous nodes stay on screen. */
  refreshing: boolean
}

export interface TreeRow {
  node: FileNode
  depth: number
  expanded: boolean
  loading: boolean
  error: string | null
  hidden: boolean
}

interface UseFileTreeOptions {
  rootPath: string
  hiddenFolders: string[]
  showHidden: boolean
  filter: string
  refreshNonce: number
}

const key = (path: string) => path.toLowerCase()

function matches(name: string, filter: string): boolean {
  return name.toLowerCase().includes(filter)
}

export function useFileTree({
  rootPath,
  hiddenFolders,
  showHidden,
  filter,
  refreshNonce
}: UseFileTreeOptions) {
  const [dirs, setDirs] = useState<Map<string, DirState>>(() => new Map())
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpandedDirs(rootPath))

  const hiddenSet = useMemo(
    () => new Set(hiddenFolders.map((folder) => folder.toLowerCase())),
    [hiddenFolders]
  )

  // Re-read one directory, keeping whatever is already on screen until the new
  // listing arrives. This is what stops the tree from blanking on every fs event.
  const load = useCallback((path: string) => {
    const id = key(path)
    setDirs((prev) => {
      const next = new Map(prev)
      const current = next.get(id)
      next.set(id, {
        nodes: current?.nodes ?? [],
        error: current?.error ?? null,
        refreshing: true
      })
      return next
    })

    window.api
      .readDir(path)
      .then((nodes) => {
        setDirs((prev) => {
          const next = new Map(prev)
          next.set(id, { nodes, error: null, refreshing: false })
          return next
        })
      })
      .catch((err: unknown) => {
        setDirs((prev) => {
          const next = new Map(prev)
          const current = next.get(id)
          next.set(id, {
            nodes: current?.nodes ?? [],
            error: err instanceof Error ? err.message : String(err),
            refreshing: false
          })
          return next
        })
      })
  }, [])

  // Root + every expanded folder is re-read on mount and on each fs change.
  // `dirs` is deliberately not a dependency — loading writes to it, which would
  // turn this into a loop.
  useEffect(() => {
    load(rootPath)
    for (const path of expanded) load(path)
  }, [expanded, load, rootPath, refreshNonce])

  // Expansion changes are event-driven, so the new set is computed here and the
  // side effects (persist, fetch) stay out of the state updater.
  const applyExpanded = useCallback(
    (next: Set<string>) => {
      setExpanded(next)
      saveExpandedDirs(rootPath, next)
    },
    [rootPath]
  )

  const expand = useCallback(
    (path: string) => {
      if (expanded.has(path)) return
      const next = new Set(expanded)
      next.add(path)
      if (!dirs.has(key(path))) load(path)
      applyExpanded(next)
    },
    [applyExpanded, dirs, expanded, load]
  )

  const collapse = useCallback(
    (path: string) => {
      if (!expanded.has(path)) return
      const next = new Set(expanded)
      next.delete(path)
      applyExpanded(next)
    },
    [applyExpanded, expanded]
  )

  const toggle = useCallback(
    (path: string) => {
      if (expanded.has(path)) collapse(path)
      else expand(path)
    },
    [collapse, expand, expanded]
  )

  const collapseAll = useCallback(() => applyExpanded(new Set()), [applyExpanded])

  const normalizedFilter = filter.trim().toLowerCase()

  // Flatten the open parts of the tree into the exact list of rendered rows.
  // Keyboard navigation, multi-select and windowing all operate on this array.
  const rows = useMemo(() => {
    const out: TreeRow[] = []

    const walk = (path: string, depth: number) => {
      const state = dirs.get(key(path))
      if (!state) return
      for (const node of state.nodes) {
        const isHidden = node.isDirectory && hiddenSet.has(node.name.toLowerCase())
        if (isHidden && !showHidden) continue

        const isExpanded = expanded.has(node.path)
        const childState = node.isDirectory ? dirs.get(key(node.path)) : undefined

        if (normalizedFilter) {
          // While filtering, a folder is kept when it matches or when something
          // inside the already-loaded subtree matches.
          if (node.isDirectory) {
            const before = out.length
            out.push({
              node,
              depth,
              expanded: isExpanded,
              loading: !!childState?.refreshing && !childState.nodes.length,
              error: childState?.error ?? null,
              hidden: isHidden
            })
            if (isExpanded) walk(node.path, depth + 1)
            const keptChildren = out.length - before > 1
            if (!keptChildren && !matches(node.name, normalizedFilter)) out.splice(before, 1)
            continue
          }
          if (!matches(node.name, normalizedFilter)) continue
        }

        out.push({
          node,
          depth,
          expanded: isExpanded,
          loading: !!childState?.refreshing && !childState.nodes.length,
          error: childState?.error ?? null,
          hidden: isHidden
        })
        if (node.isDirectory && isExpanded && !normalizedFilter) walk(node.path, depth + 1)
      }
    }

    walk(rootPath, 0)
    return out
  }, [dirs, expanded, hiddenSet, normalizedFilter, rootPath, showHidden])

  const rootState = dirs.get(key(rootPath))

  return {
    rows,
    expanded,
    toggle,
    expand,
    collapse,
    collapseAll,
    reload: load,
    rootError: rootState?.error ?? null,
    rootLoading: !rootState || (rootState.refreshing && rootState.nodes.length === 0)
  }
}
