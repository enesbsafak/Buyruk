export interface LineRange {
  start: number
  end: number
}

// Builds the text typed into an AI CLI when you send it a file. Paths with
// spaces are quoted, and a selection becomes a `path:12-40` suffix, which the
// CLIs read as "look at these lines". A trailing space lets you keep typing.
export function contextReference(path: string, range?: LineRange | null): string {
  const suffix = range
    ? range.start === range.end
      ? `:${range.start}`
      : `:${Math.min(range.start, range.end)}-${Math.max(range.start, range.end)}`
    : ''
  const reference = `${path}${suffix}`
  return /\s/.test(reference) ? `"${reference}" ` : `${reference} `
}
