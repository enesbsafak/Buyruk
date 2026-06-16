import type { GitChange } from '../types'

export function buildSelectedGitPaths(
  changes: GitChange[],
  deselectedPaths: ReadonlySet<string>
): string[] {
  const selectedPaths: string[] = []
  for (const change of changes) {
    if (!deselectedPaths.has(change.absolutePath)) selectedPaths.push(change.absolutePath)
  }
  return selectedPaths
}

export function toggleDeselectedGitPath(
  deselectedPaths: ReadonlySet<string>,
  absolutePath: string
): Set<string> {
  const next = new Set(deselectedPaths)
  if (next.has(absolutePath)) next.delete(absolutePath)
  else next.add(absolutePath)
  return next
}
