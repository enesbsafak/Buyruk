import { describe, expect, it } from 'vitest'
import { contextReference } from './terminalContext'

describe('contextReference', () => {
  it('appends a trailing space so you can keep typing', () => {
    expect(contextReference('C:\\repo\\src\\App.tsx')).toBe('C:\\repo\\src\\App.tsx ')
  })

  it('adds a line range', () => {
    expect(contextReference('C:\\repo\\a.ts', { start: 12, end: 40 })).toBe('C:\\repo\\a.ts:12-40 ')
  })

  it('collapses a single-line range', () => {
    expect(contextReference('C:\\repo\\a.ts', { start: 7, end: 7 })).toBe('C:\\repo\\a.ts:7 ')
  })

  it('normalizes a reversed range', () => {
    expect(contextReference('C:\\repo\\a.ts', { start: 40, end: 12 })).toBe('C:\\repo\\a.ts:12-40 ')
  })

  it('quotes paths containing spaces', () => {
    expect(contextReference('C:\\my repo\\a.ts')).toBe('"C:\\my repo\\a.ts" ')
    expect(contextReference('C:\\my repo\\a.ts', { start: 3, end: 5 })).toBe(
      '"C:\\my repo\\a.ts:3-5" '
    )
  })

  it('ignores a null range', () => {
    expect(contextReference('C:\\repo\\a.ts', null)).toBe('C:\\repo\\a.ts ')
  })
})
