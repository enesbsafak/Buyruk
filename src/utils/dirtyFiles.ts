import type { OpenFile, SessionRuntime } from '../types'

export function isDirtyEditableFile(file: OpenFile): boolean {
  return !file.readOnly && !file.isBinary && !file.isImage && file.content !== file.savedContent
}

export function sessionHasDirtyFiles(session: SessionRuntime): boolean {
  return session.openFiles.some(isDirtyEditableFile)
}

export function hasDirtyFiles(sessions: SessionRuntime[]): boolean {
  return sessions.some(sessionHasDirtyFiles)
}

export function hasDirtyFilesInPaths(sessions: SessionRuntime[], paths: string[]): boolean {
  const selected = new Set(paths.map((item) => item.toLowerCase()))
  if (selected.size === 0) return false
  return sessions.some((session) =>
    session.openFiles.some(
      (file) => selected.has(file.path.toLowerCase()) && isDirtyEditableFile(file)
    )
  )
}
