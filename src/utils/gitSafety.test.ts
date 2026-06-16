import { describe, expect, it } from 'vitest'
import {
  buildSelectedCommitArgs,
  isSafeBranchName,
  parseGitStatusFiles
} from './gitSafety'

describe('gitSafety', () => {
  it('builds a commit command scoped to the selected paths', () => {
    expect(buildSelectedCommitArgs('fix selected files', ['src/a.ts', 'docs/readme.md'])).toEqual([
      'commit',
      '-m',
      'fix selected files',
      '--',
      'src/a.ts',
      'docs/readme.md'
    ])
  })

  it('rejects checkout names that could be interpreted as git options', () => {
    expect(isSafeBranchName('-f')).toBe(false)
    expect(isSafeBranchName('--detach')).toBe(false)
    expect(isSafeBranchName('feature/safe-branch')).toBe(true)
  })

  it('maps porcelain files relative to the repo root, not the opened subdirectory', () => {
    const files = parseGitStatusFiles('C:\\repo', ' M src/App.ts\n?? packages/ui/new.ts\n')

    expect(files['c:\\repo\\src\\app.ts']).toBe('M')
    expect(files['c:\\repo\\packages\\ui\\new.ts']).toBe('??')
  })
})
