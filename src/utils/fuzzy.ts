// Score a query against a file name / full path.
// Prefer name substring > path substring > name subsequence > path subsequence.
// Returns -1 when there is no match.
export function fuzzyScore(query: string, name: string, full: string): number {
  if (name.includes(query)) return 1000 - name.indexOf(query)
  if (full.includes(query)) return 500
  let qi = 0
  for (let i = 0; i < name.length && qi < query.length; i++) {
    if (name[i] === query[qi]) qi++
  }
  if (qi === query.length) return 200
  qi = 0
  for (let i = 0; i < full.length && qi < query.length; i++) {
    if (full[i] === query[qi]) qi++
  }
  return qi === query.length ? 100 : -1
}
