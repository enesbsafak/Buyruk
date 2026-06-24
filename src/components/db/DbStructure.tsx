import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { useDialog } from '../DialogProvider'
import type { DbColumn, DbIndex, DbTable } from '../../types'

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

interface DbStructureProps {
  connectionId: string
  table: DbTable
  // Refresh the panel's table list (after drop) and clear the current selection.
  onTreeChanged: () => void
  onTableRemoved: () => void
}

export function DbStructure({ connectionId, table, onTreeChanged, onTableRemoved }: DbStructureProps) {
  const dialog = useDialog()
  const [columns, setColumns] = useState<DbColumn[]>([])
  const [indexes, setIndexes] = useState<DbIndex[]>([])
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [busy, setBusy] = useState(false)

  const [addingColumn, setAddingColumn] = useState(false)
  const [newCol, setNewCol] = useState({ name: '', dataType: 'text', nullable: true, default: '' })
  const [addingIndex, setAddingIndex] = useState(false)
  const [newIndex, setNewIndex] = useState({ name: '', columns: [] as string[], unique: false })

  useEffect(() => {
    let cancelled = false
    setError(null)
    Promise.all([
      window.api.db.getColumns(connectionId, table.schema, table.name),
      window.api.db.getIndexes(connectionId, table.schema, table.name)
    ])
      .then(([cols, idx]) => {
        if (cancelled) return
        setColumns(cols)
        setIndexes(idx)
      })
      .catch((err) => {
        if (!cancelled) setError(errMsg(err))
      })
    return () => {
      cancelled = true
    }
  }, [connectionId, table.schema, table.name, nonce])

  const reload = () => setNonce((n) => n + 1)
  const isView = table.kind === 'view'

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      dialog.notify(ok, 'success')
      reload()
    } catch (err) {
      dialog.notify(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const addColumn = () =>
    run(async () => {
      await window.api.db.addColumn(connectionId, table.schema, table.name, {
        name: newCol.name.trim(),
        dataType: newCol.dataType.trim(),
        nullable: newCol.nullable,
        default: newCol.default,
        primaryKey: false
      })
      setAddingColumn(false)
      setNewCol({ name: '', dataType: 'text', nullable: true, default: '' })
    }, 'Kolon eklendi')

  const dropColumn = async (name: string) => {
    const ok = await dialog.confirm({
      title: 'Kolonu Sil',
      message: `"${name}" kolonu ve içindeki tüm veriler silinsin mi?`,
      danger: true,
      confirmText: 'Sil'
    })
    if (ok) void run(() => window.api.db.dropColumn(connectionId, table.schema, table.name, name), 'Kolon silindi')
  }

  const addIndex = () =>
    run(async () => {
      await window.api.db.createIndex(connectionId, table.schema, table.name, {
        name: newIndex.name.trim(),
        columns: newIndex.columns,
        unique: newIndex.unique
      })
      setAddingIndex(false)
      setNewIndex({ name: '', columns: [], unique: false })
    }, 'Index oluşturuldu')

  const dropIndex = async (name: string) => {
    const ok = await dialog.confirm({
      title: 'Index Sil',
      message: `"${name}" index'i silinsin mi?`,
      danger: true,
      confirmText: 'Sil'
    })
    if (ok) void run(() => window.api.db.dropIndex(connectionId, table.schema, name), 'Index silindi')
  }

  const truncate = async () => {
    const ok = await dialog.confirm({
      title: 'Tabloyu Boşalt',
      message: `"${table.name}" tablosundaki TÜM satırlar silinsin mi? (TRUNCATE)`,
      danger: true,
      confirmText: 'Boşalt'
    })
    if (ok) void run(() => window.api.db.truncateTable(connectionId, table.schema, table.name), 'Tablo boşaltıldı')
  }

  const drop = async () => {
    const ok = await dialog.confirm({
      title: 'Tabloyu Sil',
      message: `"${table.name}" tablosu kalıcı olarak silinsin mi? (DROP TABLE)`,
      danger: true,
      confirmText: 'Tabloyu Sil'
    })
    if (!ok) return
    setBusy(true)
    try {
      await window.api.db.dropTable(connectionId, table.schema, table.name)
      dialog.notify('Tablo silindi', 'success')
      onTableRemoved()
      onTreeChanged()
    } catch (err) {
      dialog.notify(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleIndexColumn = (col: string) =>
    setNewIndex((s) => ({
      ...s,
      columns: s.columns.includes(col) ? s.columns.filter((c) => c !== col) : [...s.columns, col]
    }))

  if (error) return <div className="db-error">{error}</div>

  return (
    <div className="db-structure">
      <section className="db-struct-section">
        <div className="db-struct-head">
          <h4>Kolonlar</h4>
          {!isView && (
            <button type="button" className="btn btn-ghost" onClick={() => setAddingColumn((v) => !v)}>
              <Icon name="plus" size={13} /> Kolon Ekle
            </button>
          )}
        </div>

        {addingColumn && (
          <div className="db-ddl-form">
            <input className="field-input" placeholder="kolon adı" value={newCol.name} onChange={(e) => setNewCol({ ...newCol, name: e.target.value })} />
            <input className="field-input" placeholder="tip (örn. text, integer, varchar(50))" value={newCol.dataType} onChange={(e) => setNewCol({ ...newCol, dataType: e.target.value })} />
            <input className="field-input" placeholder="varsayılan (örn. now(), 0)" value={newCol.default} onChange={(e) => setNewCol({ ...newCol, default: e.target.value })} />
            <label className="db-checkbox">
              <input type="checkbox" checked={newCol.nullable} onChange={(e) => setNewCol({ ...newCol, nullable: e.target.checked })} />
              <span>NULL olabilir</span>
            </label>
            <button type="button" className="btn btn-primary" disabled={busy || !newCol.name.trim()} onClick={() => void addColumn()}>
              Ekle
            </button>
          </div>
        )}

        <table className="db-struct-table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Tip</th>
              <th>Null</th>
              <th>Varsayılan</th>
              {!isView && <th />}
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => (
              <tr key={col.name}>
                <td>
                  {col.isPrimaryKey && <Icon name="key" size={11} className="db-pk-ico" />}
                  {col.name}
                </td>
                <td className="db-mono">{col.dataType}</td>
                <td>{col.nullable ? 'YES' : 'NO'}</td>
                <td className="db-mono db-dim">{col.default ?? ''}</td>
                {!isView && (
                  <td className="db-grid-actions">
                    <button type="button" className="icon-btn" title="Kolonu sil" disabled={busy} onClick={() => void dropColumn(col.name)}>
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="db-struct-section">
        <div className="db-struct-head">
          <h4>Index'ler</h4>
          {!isView && (
            <button type="button" className="btn btn-ghost" onClick={() => setAddingIndex((v) => !v)}>
              <Icon name="plus" size={13} /> Index Ekle
            </button>
          )}
        </div>

        {addingIndex && (
          <div className="db-ddl-form db-ddl-form-col">
            <input className="field-input" placeholder="index adı" value={newIndex.name} onChange={(e) => setNewIndex({ ...newIndex, name: e.target.value })} />
            <div className="db-index-cols">
              {columns.map((col) => (
                <label key={col.name} className="db-checkbox">
                  <input type="checkbox" checked={newIndex.columns.includes(col.name)} onChange={() => toggleIndexColumn(col.name)} />
                  <span>{col.name}</span>
                </label>
              ))}
            </div>
            <div className="db-ddl-actions">
              <label className="db-checkbox">
                <input type="checkbox" checked={newIndex.unique} onChange={(e) => setNewIndex({ ...newIndex, unique: e.target.checked })} />
                <span>UNIQUE</span>
              </label>
              <button type="button" className="btn btn-primary" disabled={busy || !newIndex.name.trim() || newIndex.columns.length === 0} onClick={() => void addIndex()}>
                Oluştur
              </button>
            </div>
          </div>
        )}

        <table className="db-struct-table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Tür</th>
              <th>Tanım</th>
              {!isView && <th />}
            </tr>
          </thead>
          <tbody>
            {indexes.map((idx) => (
              <tr key={idx.name}>
                <td>{idx.name}</td>
                <td>{idx.isPrimary ? 'PRIMARY' : idx.isUnique ? 'UNIQUE' : ''}</td>
                <td className="db-mono db-dim">{idx.definition}</td>
                {!isView && (
                  <td className="db-grid-actions">
                    <button type="button" className="icon-btn" title="Index sil" disabled={busy || idx.isPrimary} onClick={() => void dropIndex(idx.name)}>
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {!isView && (
        <section className="db-struct-section db-danger-zone">
          <h4>Tehlikeli Bölge</h4>
          <div className="db-danger-actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void truncate()}>
              Tabloyu Boşalt (TRUNCATE)
            </button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void drop()}>
              <Icon name="trash" size={14} /> Tabloyu Sil (DROP)
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
