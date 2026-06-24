import { describe, it, expect } from 'vitest'
import { parsePostgresUrl } from './parsePostgresUrl'

describe('parsePostgresUrl', () => {
  it('parses a full postgres:// url', () => {
    expect(
      parsePostgresUrl('postgres://postgres:secretpass@213.238.171.206:5324/postgres')
    ).toEqual({
      host: '213.238.171.206',
      port: 5324,
      database: 'postgres',
      user: 'postgres',
      password: 'secretpass',
      ssl: false
    })
  })

  it('accepts the postgresql:// scheme', () => {
    const result = parsePostgresUrl('postgresql://u:p@db.example.com:5432/app')
    expect(result?.host).toBe('db.example.com')
    expect(result?.database).toBe('app')
    expect(result?.user).toBe('u')
  })

  it('defaults the port to 5432 when omitted', () => {
    expect(parsePostgresUrl('postgres://u:p@host/mydb')?.port).toBe(5432)
  })

  it('enables ssl for sslmode=require', () => {
    expect(parsePostgresUrl('postgres://u:p@host:5432/db?sslmode=require')?.ssl).toBe(true)
  })

  it('keeps ssl off for sslmode=disable', () => {
    expect(parsePostgresUrl('postgres://u:p@host:5432/db?sslmode=disable')?.ssl).toBe(false)
  })

  it('decodes url-encoded credentials', () => {
    const result = parsePostgresUrl('postgres://us%40er:p%40ss%2Fword@host:5432/db')
    expect(result?.user).toBe('us@er')
    expect(result?.password).toBe('p@ss/word')
  })

  it('returns null for non-postgres input', () => {
    expect(parsePostgresUrl('mysql://u:p@host/db')).toBeNull()
    expect(parsePostgresUrl('just some text')).toBeNull()
    expect(parsePostgresUrl('')).toBeNull()
  })
})
