import { describe, it, expect } from 'vitest'
import { fuzzyScore } from './fuzzy'

describe('fuzzyScore', () => {
  it('ranks name substring highest', () => {
    const name = fuzzyScore('app', 'app.tsx', 'src/app.tsx')
    const path = fuzzyScore('src', 'app.tsx', 'src/app.tsx')
    expect(name).toBeGreaterThan(path)
  })

  it('prefers earlier name matches', () => {
    expect(fuzzyScore('a', 'app', 'app')).toBeGreaterThan(fuzzyScore('p', 'app', 'app'))
  })

  it('matches subsequence in name', () => {
    expect(fuzzyScore('atx', 'app.tsx', 'src/app.tsx')).toBe(200)
  })

  it('matches subsequence only in full path', () => {
    expect(fuzzyScore('srcindex', 'index.ts', 'src/index.ts')).toBe(100)
  })

  it('returns -1 when no match', () => {
    expect(fuzzyScore('zzz', 'app.tsx', 'src/app.tsx')).toBe(-1)
  })
})
