import { describe, expect, it } from 'vitest'
import { hasDirtyFiles, hasDirtyFilesInPaths, sessionHasDirtyFiles } from './dirtyFiles'
import type { OpenFile, SessionRuntime } from '../types'

const file = (path: string, content: string, savedContent = content, patch: Partial<OpenFile> = {}): OpenFile => ({
  path,
  name: path.split(/[\\/]/).pop() ?? path,
  content,
  savedContent,
  language: 'typescript',
  isBinary: false,
  isImage: false,
  ...patch
})

const session = (openFiles: OpenFile[]): SessionRuntime => ({
  id: 's1',
  type: 'cmd',
  title: 'CMD',
  cwd: 'C:\\repo',
  createdAt: 1,
  isActive: true,
  status: 'running',
  gen: 0,
  openFiles,
  activeFilePath: openFiles[0]?.path ?? null
})

describe('dirtyFiles', () => {
  it('detects dirty editable files but ignores readonly, binary and image tabs', () => {
    expect(sessionHasDirtyFiles(session([file('C:\\repo\\a.ts', 'changed', 'saved')]))).toBe(true)
    expect(sessionHasDirtyFiles(session([file('C:\\repo\\a.diff', 'changed', 'saved', { readOnly: true })]))).toBe(false)
    expect(sessionHasDirtyFiles(session([file('C:\\repo\\image.png', 'changed', 'saved', { isImage: true })]))).toBe(false)
    expect(sessionHasDirtyFiles(session([file('C:\\repo\\bin.exe', 'changed', 'saved', { isBinary: true })]))).toBe(false)
  })

  it('detects dirty files in selected git paths case-insensitively', () => {
    const sessions = [session([file('C:\\repo\\src\\App.tsx', 'changed', 'saved')])]

    expect(hasDirtyFilesInPaths(sessions, ['c:\\repo\\src\\app.tsx'])).toBe(true)
    expect(hasDirtyFilesInPaths(sessions, ['C:\\repo\\src\\other.ts'])).toBe(false)
  })

  it('detects dirty files across sessions', () => {
    expect(hasDirtyFiles([session([file('C:\\repo\\a.ts', 'changed', 'saved')])])).toBe(true)
    expect(hasDirtyFiles([session([file('C:\\repo\\a.ts', 'saved')])])).toBe(false)
  })
})
