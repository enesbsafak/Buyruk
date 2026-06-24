import type { DbResultSet } from '../../types'

export function dbCellText(value: string | null): string {
  return value === null ? '' : value
}

// Read-only renderer for a generic result set (SQL console output).
export function DbResultTable({ result }: { result: DbResultSet }) {
  if (result.columns.length === 0) {
    return (
      <div className="db-result-info">
        {result.command || 'OK'} · {result.rowCount} satır · {result.durationMs} ms
      </div>
    )
  }

  return (
    <div className="db-grid-wrap">
      <table className="db-grid">
        <thead>
          <tr>
            <th className="db-grid-rownum">#</th>
            {result.columns.map((col, i) => (
              <th key={i}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, r) => (
            <tr key={r}>
              <td className="db-grid-rownum">{r + 1}</td>
              {row.map((cell, c) => (
                <td key={c} className={cell === null ? 'db-cell-null' : undefined}>
                  {cell === null ? 'NULL' : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
