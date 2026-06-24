import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useDatabase } from '../hooks/useDatabase'
import { DbConnectForm } from './db/DbConnectForm'
import { DbDataGrid } from './db/DbDataGrid'
import { DbStructure } from './db/DbStructure'
import { DbSqlConsole } from './db/DbSqlConsole'
import { DbCreateTable } from './db/DbCreateTable'

type DbView = 'data' | 'structure' | 'sql'

interface DatabasePanelProps {
  open: boolean
  onClose: () => void
}

export function DatabasePanel({ open, onClose }: DatabasePanelProps) {
  const db = useDatabase(open)
  const [view, setView] = useState<DbView>('data')
  const [creatingTable, setCreatingTable] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Let inputs handle their own Escape (cancel cell edit, etc.) without
      // tearing down the whole panel.
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (creatingTable) setCreatingTable(false)
      else onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, creatingTable, onClose])

  if (!open) return null

  const { active, schemas, schema, tables, selected } = db
  const tableKey = selected ? `${selected.schema}.${selected.name}` : ''

  return (
    <div className="modal-overlay db-overlay" role="presentation" onMouseDown={onClose}>
      <div className="db-panel" role="presentation" onMouseDown={(e) => e.stopPropagation()}>
        <header className="db-panel-head">
          <div className="db-panel-title">
            <Icon name="database" size={17} /> Veritabanı
          </div>
          {active && (
            <span className="db-conn-info">
              {active.user}@{active.host}/{active.database}
              {active.serverVersion && ` · pg ${active.serverVersion}`}
            </span>
          )}
          <span className="spacer" />
          {active && (
            <button type="button" className="btn btn-ghost" onClick={() => void db.disconnect()}>
              <Icon name="power" size={14} /> Bağlantıyı Kapat
            </button>
          )}
          <button type="button" className="icon-btn" title="Kapat" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>

        {!active ? (
          <DbConnectForm
            connections={db.connections}
            connecting={db.connecting}
            onConnectInline={(input) => void db.connectInline(input)}
            onConnectSaved={(id) => void db.connectSaved(id)}
            onSave={(input, id) => void db.saveConnection(input, id)}
            onDelete={(id) => void db.deleteConnection(id)}
          />
        ) : (
          <div className="db-workspace">
            <aside className="db-tree">
              <div className="db-tree-head">
                <select
                  className="field-input db-schema-select"
                  value={schema ?? ''}
                  onChange={(e) => {
                    db.setSchema(e.target.value)
                    db.setSelected(null)
                  }}
                >
                  {schemas.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button type="button" className="icon-btn" title="Yeni tablo" onClick={() => setCreatingTable(true)}>
                  <Icon name="plus" size={15} />
                </button>
              </div>
              <ul className="db-table-list">
                {tables.length === 0 ? (
                  <li className="db-empty db-tree-empty">Tablo yok</li>
                ) : (
                  tables.map((t) => (
                    <li key={`${t.schema}.${t.name}`}>
                      <button
                        type="button"
                        className={`db-table-item ${
                          selected?.name === t.name && selected?.schema === t.schema ? 'is-active' : ''
                        }`}
                        onClick={() => {
                          db.setSelected(t)
                          setView('data')
                        }}
                      >
                        <Icon name="table" size={14} />
                        <span className="db-table-name">{t.name}</span>
                        {t.kind === 'view' && <span className="db-table-badge">view</span>}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </aside>

            <section className="db-main">
              <div className="db-tabs">
                <button
                  type="button"
                  className={`db-tab ${view === 'data' ? 'is-active' : ''}`}
                  disabled={!selected}
                  onClick={() => setView('data')}
                >
                  Veri
                </button>
                <button
                  type="button"
                  className={`db-tab ${view === 'structure' ? 'is-active' : ''}`}
                  disabled={!selected}
                  onClick={() => setView('structure')}
                >
                  Yapı
                </button>
                <button
                  type="button"
                  className={`db-tab ${view === 'sql' ? 'is-active' : ''}`}
                  onClick={() => setView('sql')}
                >
                  <Icon name="play" size={12} /> SQL
                </button>
              </div>

              <div className="db-view">
                {view === 'sql' ? (
                  <DbSqlConsole
                    connectionId={active.connectionId}
                    schema={schema}
                    onChanged={() => void db.refreshTables()}
                  />
                ) : !selected ? (
                  <p className="db-empty db-view-empty">Soldan bir tablo seç.</p>
                ) : view === 'data' ? (
                  <DbDataGrid key={tableKey} connectionId={active.connectionId} table={selected} />
                ) : (
                  <DbStructure
                    key={tableKey}
                    connectionId={active.connectionId}
                    table={selected}
                    onTreeChanged={() => void db.refreshTables()}
                    onTableRemoved={() => db.setSelected(null)}
                  />
                )}
              </div>
            </section>
          </div>
        )}

        {creatingTable && active && schema && (
          <DbCreateTable
            connectionId={active.connectionId}
            schema={schema}
            onClose={() => setCreatingTable(false)}
            onCreated={() => void db.refreshTables()}
          />
        )}
      </div>
    </div>
  )
}
