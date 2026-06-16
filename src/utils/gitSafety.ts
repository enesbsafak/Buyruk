import path from 'node:path'

const GIT_RENAME_ARROW = /^.* -> (.*)$/

function cleanPorcelainPath(value: string): string {
  const renamed = GIT_RENAME_ARROW.exec(value)?.[1] ?? value
  return renamed.replace(/^"|"$/g, '')
}

function toGitPath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

export function relativeGitPath(repoRoot: string, filePath: string): string | null {
  const relativePath = path.relative(repoRoot, filePath)
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null
  }
  return toGitPath(relativePath)
}

export function buildSelectedCommitArgs(message: string, relativePaths: string[]): string[] {
  return ['commit', '-m', message, '--', ...relativePaths]
}

export function isSafeBranchName(name: string): boolean {
  const branch = name.trim()
  if (!branch || branch.startsWith('-')) return false
  if (branch.endsWith('/') || branch.endsWith('.') || branch.includes('//')) return false
  if (branch.includes('..') || branch.includes('@{')) return false
  if (/[\s~^:?*[\\\]\0]/.test(branch)) return false
  return branch.split('/').every((part) => part && !part.startsWith('.') && !part.endsWith('.lock'))
}

export function parseGitStatusFiles(repoRoot: string, porcelain: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue
    const code = line.slice(0, 2).trim()
    const file = cleanPorcelainPath(line.slice(3))
    files[path.join(repoRoot, file).toLowerCase()] = code
  }
  return files
}
