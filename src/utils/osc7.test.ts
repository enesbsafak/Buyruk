import { describe, expect, it } from 'vitest'
import { parseOsc7 } from './osc7'

describe('parseOsc7', () => {
  it('reads a plain drive path', () => {
    expect(parseOsc7('file:///C:/Users/me/proj')).toBe('C:\\Users\\me\\proj')
  })

  it('decodes percent-encoded segments', () => {
    expect(parseOsc7('file:///C:/Program%20Files/app')).toBe('C:\\Program Files\\app')
  })

  it('drops a trailing slash', () => {
    expect(parseOsc7('file:///C:/repo/')).toBe('C:\\repo')
  })

  it('accepts a hostname component', () => {
    expect(parseOsc7('file://localhost/C:/repo')).toBe('C:\\repo')
  })

  it('keeps UNC-style paths that have no drive letter', () => {
    expect(parseOsc7('file:///srv/share')).toBe('\\srv\\share')
  })

  it('rejects non-file urls', () => {
    expect(parseOsc7('https://example.com')).toBeNull()
  })

  it('rejects malformed payloads', () => {
    expect(parseOsc7('not a url')).toBeNull()
    expect(parseOsc7('')).toBeNull()
  })

  it('rejects a url whose path decodes to nothing', () => {
    expect(parseOsc7('file:///')).toBeNull()
  })
})
