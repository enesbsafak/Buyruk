// Pure Windows-friendly path helpers. The renderer can't use Node's `path`
// (contextIsolation), so we implement the small subset we need. These handle
// both '\\' and '/' separators.

function stripTrailingSeparators(p: string): string {
  return p.replace(/[\\/]+$/, '')
}

export function basename(p: string): string {
  const normalized = stripTrailingSeparators(p)
  const idx = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
  return idx === -1 ? normalized : normalized.slice(idx + 1)
}

export function dirname(p: string): string {
  const normalized = stripTrailingSeparators(p)
  const idx = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'))
  if (idx === -1) return normalized
  return normalized.slice(0, idx) || normalized
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('\\')
    .replace(/[\\/]+/g, '\\')
}
