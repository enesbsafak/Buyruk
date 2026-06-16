import { describe, expect, it } from 'vitest'
import { buildSelectedGitPaths, toggleDeselectedGitPath } from './gitSelection'
import type { GitChange } from '../types'

function change(absolutePath: string): GitChange {
  return {
    path: absolutePath,
    absolutePath,
    status: 'M',
    staged: false,
    unstaged: true,
    untracked: false
  }
}

describe('gitSelection', () => {
  it('includes every changed path by default and omits only explicitly deselected paths', () => {
    const changes = [change('C:\\repo\\a.ts'), change('C:\\repo\\b.ts'), change('C:\\repo\\c.ts')]
    const deselected = new Set(['C:\\repo\\b.ts', 'C:\\repo\\removed.ts'])

    expect(buildSelectedGitPaths(changes, deselected)).toEqual(['C:\\repo\\a.ts', 'C:\\repo\\c.ts'])
  })

  it('toggles paths without mutating the previous deselected set', () => {
    const previous = new Set(['C:\\repo\\a.ts'])

    const selectedAgain = toggleDeselectedGitPath(previous, 'C:\\repo\\a.ts')
    const deselected = toggleDeselectedGitPath(previous, 'C:\\repo\\b.ts')

    expect([...previous]).toEqual(['C:\\repo\\a.ts'])
    expect([...selectedAgain]).toEqual([])
    expect([...deselected]).toEqual(['C:\\repo\\a.ts', 'C:\\repo\\b.ts'])
  })
})
