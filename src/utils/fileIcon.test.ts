import { describe, expect, it } from 'vitest'
import { fileIcon } from './fileIcon'

describe('fileIcon', () => {
  it('maps known code extensions', () => {
    expect(fileIcon('App.tsx')).toEqual({ icon: 'code', tone: 'ts' })
    expect(fileIcon('main.py')).toEqual({ icon: 'code', tone: 'py' })
  })

  it('is case insensitive', () => {
    expect(fileIcon('README.MD').icon).toBe('file-text')
    expect(fileIcon('Styles.CSS').tone).toBe('css')
  })

  it('prefers whole-name matches over the extension', () => {
    expect(fileIcon('package.json').tone).toBe('npm')
    expect(fileIcon('tsconfig.json').tone).toBe('ts')
    expect(fileIcon('other.json').tone).toBe('data')
  })

  it('treats dotfiles as config', () => {
    expect(fileIcon('.eslintrc')).toEqual({ icon: 'settings', tone: 'muted' })
    expect(fileIcon('.gitignore').tone).toBe('git')
  })

  it('falls back for unknown and extensionless names', () => {
    expect(fileIcon('notes.qqq')).toEqual({ icon: 'file', tone: 'muted' })
    expect(fileIcon('Makefile')).toEqual({ icon: 'file', tone: 'muted' })
  })
})
