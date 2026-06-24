// Parse a `postgres://user:pass@host:port/database` connection string into the
// discrete fields the connection form needs. Returns null when the input isn't a
// postgres URL, so the caller can leave the form untouched.
export interface ParsedPostgresUrl {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl: boolean
}

export function parsePostgresUrl(input: string): ParsedPostgresUrl | null {
  const trimmed = input.trim()
  if (!/^postgres(ql)?:\/\//i.test(trimmed)) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const decode = (value: string): string => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  // sslmode=disable/allow keep SSL off; any other explicit mode turns it on.
  const sslmode = url.searchParams.get('sslmode')
  const ssl = sslmode != null && sslmode !== 'disable' && sslmode !== 'allow'

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database: decode(url.pathname.replace(/^\//, '')),
    user: decode(url.username),
    password: decode(url.password),
    ssl
  }
}
