import { describe, it, expect, beforeEach } from 'vitest'
import { pushRecent, loadRecents } from './persistence'

const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v))
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0
} as Storage

beforeEach(() => store.clear())

describe('pushRecent', () => {
  it('adds new folders to the front', () => {
    pushRecent('C:\\a', 'cmd')
    const list = pushRecent('C:\\b', 'powershell')
    expect(list[0].cwd).toBe('C:\\b')
    expect(list[1].cwd).toBe('C:\\a')
  })

  it('dedups by path (case-insensitive) and moves it to the front', () => {
    pushRecent('C:\\a', 'cmd')
    pushRecent('C:\\b', 'cmd')
    const list = pushRecent('c:\\A', 'claude')
    expect(list.filter((r) => r.cwd.toLowerCase() === 'c:\\a')).toHaveLength(1)
    expect(list[0].cwd).toBe('c:\\A')
    expect(list[0].type).toBe('claude')
  })

  it('caps the list at 8 entries', () => {
    for (let i = 0; i < 12; i++) pushRecent('C:\\dir' + i, 'cmd')
    expect(loadRecents()).toHaveLength(8)
  })
})
