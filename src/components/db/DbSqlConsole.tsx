import { useState } from 'react'
import { Icon } from '../Icon'
import { DbResultTable } from './DbResultTable'
import type { DbResultSet } from '../../types'

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

interface DbSqlConsoleProps {
  connectionId: string
  schema: string | null
  // Called after a successful run so the panel can refresh its table list (DDL).
  onChanged: () => void
}

export function DbSqlConsole({ connectionId, schema, onChanged }: DbSqlConsoleProps) {
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<DbResultSet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!sql.trim() || running) return
    setRunning(true)
    setError(null)
    try {
      const prefix = schema ? `SET search_path TO ${JSON.stringify(schema)};\n` : ''
      const res = await window.api.db.runQuery(connectionId, prefix + sql)
      setResult(res)
      onChanged()
    } catch (err) {
      setError(errMsg(err))
      setResult(null)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="db-sql">
      <div className="db-sql-editor">
        <textarea
          className="db-sql-input"
          value={sql}
          spellCheck={false}
          placeholder="SELECT * FROM ...   (Ctrl+Enter ile çalıştır)"
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void run()
            }
          }}
        />
        <div className="db-sql-bar">
          <span className="db-sql-hint">{schema ? `search_path: ${schema}` : ''}</span>
          <button type="button" className="btn btn-primary" disabled={running} onClick={() => void run()}>
            <Icon name="play" size={14} /> {running ? 'Çalışıyor…' : 'Çalıştır'}
          </button>
        </div>
      </div>

      <div className="db-sql-result">
        {error ? (
          <div className="db-error">{error}</div>
        ) : result ? (
          <DbResultTable result={result} />
        ) : (
          <p className="db-empty">Sonuç burada görünecek.</p>
        )}
      </div>
    </div>
  )
}
