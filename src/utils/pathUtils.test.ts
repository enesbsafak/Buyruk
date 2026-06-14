import { describe, it, expect } from 'vitest'
import { basename, dirname, joinPath } from './pathUtils'

describe('basename', () => {
  it('handles Windows paths', () => {
    expect(basename('C:\\a\\b\\file.ts')).toBe('file.ts')
  })
  it('handles forward slashes', () => {
    expect(basename('C:/a/b/file.ts')).toBe('file.ts')
  })
  it('strips trailing separators', () => {
    expect(basename('C:\\a\\b\\')).toBe('b')
  })
  it('returns the input when no separator', () => {
    expect(basename('file.ts')).toBe('file.ts')
  })
})

describe('dirname', () => {
  it('returns the parent directory', () => {
    expect(dirname('C:\\a\\b\\file.ts')).toBe('C:\\a\\b')
  })
  it('handles trailing separators', () => {
    expect(dirname('C:\\a\\b\\')).toBe('C:\\a')
  })
})

describe('joinPath', () => {
  it('joins with backslashes', () => {
    expect(joinPath('C:\\a', 'b', 'c.ts')).toBe('C:\\a\\b\\c.ts')
  })
  it('normalizes mixed/duplicate separators', () => {
    expect(joinPath('C:\\a/', '/b', 'c')).toBe('C:\\a\\b\\c')
  })
  it('skips empty segments', () => {
    expect(joinPath('C:\\a', '', 'b')).toBe('C:\\a\\b')
  })
})
