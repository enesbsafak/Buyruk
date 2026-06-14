import { describe, it, expect } from 'vitest'
import { getLanguage, isImageFile } from './language'

describe('getLanguage', () => {
  it('maps known extensions', () => {
    expect(getLanguage('a.ts')).toBe('typescript')
    expect(getLanguage('a.tsx')).toBe('typescript')
    expect(getLanguage('a.js')).toBe('javascript')
    expect(getLanguage('a.py')).toBe('python')
    expect(getLanguage('a.json')).toBe('json')
    expect(getLanguage('a.md')).toBe('markdown')
  })
  it('is case-insensitive', () => {
    expect(getLanguage('A.TS')).toBe('typescript')
  })
  it('falls back to plaintext', () => {
    expect(getLanguage('a.unknownext')).toBe('plaintext')
    expect(getLanguage('Makefile')).toBe('plaintext')
  })
})

describe('isImageFile', () => {
  it('detects images', () => {
    expect(isImageFile('a.png')).toBe(true)
    expect(isImageFile('photo.JPG')).toBe(true)
    expect(isImageFile('icon.svg')).toBe(true)
  })
  it('rejects non-images', () => {
    expect(isImageFile('a.ts')).toBe(false)
    expect(isImageFile('a')).toBe(false)
  })
})
