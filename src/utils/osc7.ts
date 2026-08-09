// OSC 7 reports the shell's working directory as a file URL. Shells emit it in a
// few shapes (file:///C:/x, file://host/C:/x, trailing slash, percent-encoding),
// so normalize everything back to a plain Windows path.
export function parseOsc7(payload: string): string | null {
  let url: URL
  try {
    url = new URL(payload)
  } catch {
    return null
  }
  if (url.protocol !== 'file:') return null

  let raw: string
  try {
    raw = decodeURIComponent(url.pathname)
  } catch {
    return null
  }

  const withoutLeadingSlash = /^\/[a-zA-Z]:/.test(raw) ? raw.slice(1) : raw
  const normalized = withoutLeadingSlash.replace(/\//g, '\\').replace(/\\+$/, '')
  return normalized || null
}
