import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { useDialog } from '../DialogProvider'
import type { DbRowsResult, DbTable } from '../../types'

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))
const LIMIT = 100

interface DbDataGridProps {
  connectionId: string
  table: DbTable
}

interface Order {
  by: string
  dir: 'ASC' | 'DESC'
}

// A nullable text editor used for inline cell edits and for the new-row form.
function EditCell({
  value,
  onChange,
  onCommit,
  onCancel,
  autoFocus
}: {
  value: string | null
  onChange: (value: string | null) => void
  onCommit?: () => void
  onCancel?: () => void
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) {
      ref.current?.focus()
      ref.current?.select()
    }
  }, [autoFocus])
  return (
    <div className="db-edit-cell">
      <input
        ref={ref}
        className="db-edit-input"
        value={value ?? ''}
        disabled={value === null}
        placeholder={value === null ? 'NULL' : ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit?.()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel?.()
          }
        }}
        onBlur={() => onCommit?.()}
      />
      <button
        type="button"
        className={`db-null-btn ${value === null ? 'is-on' : ''}`}
        title="NULL olarak ayarla"
        // Prevent the input's blur (which would commit) from firing on toggle.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(value === null ? '' : null)}
      >
        ∅
      </button>
    </div>
  )
}

// A floating multi-line editor anchored to the double-clicked cell, so long
// values are fully visible and editable instead of being cramped into the cell.
function CellEditor({
  anchor,
  columnName,
  value,
  busy,
  onChange,
  onCommit,
  onCancel
}: {
  anchor: DOMRect
  columnName: string
  value: string | null
  busy: boolean
  onChange: (value: string | null) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const popRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Place the popover under the cell, clamped inside the viewport.
  useLayoutEffect(() => {
    const pop = popRef.current
    if (!pop) return
    const w = pop.offsetWidth
    const h = pop.offsetHeight
    const margin = 10
    let left = anchor.left
    let top = anchor.bottom + 4
    if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin
    if (left < margin) left = margin
    if (top + h > window.innerHeight - margin) top = Math.max(margin, anchor.top - h - 4)
    setPos({ left, top })
  }, [anchor])

  useEffect(() => {
    taRef.current?.focus()
    taRef.current?.select()
  }, [])

  return (
    <>
      <div className="db-cell-editor-backdrop" onMouseDown={onCancel} />
      <div
        ref={popRef}
        className="db-cell-editor"
        style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      >
        <div className="db-cell-editor-head">
          <span className="db-cell-editor-col">{columnName}</span>
        </div>
        <textarea
          ref={taRef}
          className="db-cell-editor-input"
          value={value ?? ''}
          disabled={value === null}
          placeholder={value === null ? 'NULL' : ''}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              onCommit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onCancel()
            }
          }}
        />
        <div className="db-cell-editor-actions">
          <label className="db-checkbox" title="Hücreyi NULL yap">
            <input type="checkbox" checked={value === null} onChange={() => onChange(value === null ? '' : null)} />
            <span>NULL</span>
          </label>
          <span className="db-cell-editor-hint">Ctrl+Enter kaydet · Esc iptal</span>
          <button type="button" className="btn btn-ghost btn-small" onMouseDown={(e) => e.preventDefault()} onClick={onCancel}>
            İptal
          </button>
          <button type="button" className="btn btn-primary btn-small" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={onCommit}>
            Kaydet
          </button>
        </div>
      </div>
    </>
  )
}

export function DbDataGrid({ connectionId, table }: DbDataGridProps) {
  const dialog = useDialog()
  const [data, setData] = useState<DbRowsResult | null>(null)
  const [offset, setOffset] = useState(0)
  const [order, setOrder] = useState<Order | null>(null)
  const [nonce, setNonce] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null)
  const [editAnchor, setEditAnchor] = useState<DOMRect | null>(null)
  const [cellDraft, setCellDraft] = useState<string | null>(null)
  const committing = useRef(false)

  const [inserting, setInserting] = useState(false)
  const [insertDraft, setInsertDraft] = useState<(string | null)[]>([])

  useEffect(() => {
    let cancelled = false
    window.api.db
      .getRows(connectionId, table.schema, table.name, {
        limit: LIMIT,
        offset,
        orderBy: order?.by ?? null,
        orderDir: order?.dir
      })
      .then((res) => {
        if (!cancelled) {
          setData(res)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errMsg(err))
      })
    return () => {
      cancelled = true
    }
  }, [connectionId, table.schema, table.name, offset, order, nonce])

  const reload = () => setNonce((n) => n + 1)
  const canEdit = !!data && data.primaryKey.length > 0 && table.kind !== 'view'

  const toggleSort = (col: string) => {
    closeEditor()
    setOffset(0)
    setOrder((prev) =>
      prev?.by === col ? { by: col, dir: prev.dir === 'ASC' ? 'DESC' : 'ASC' } : { by: col, dir: 'ASC' }
    )
  }

  const pkObject = (row: (string | null)[]): Record<string, string | null> => {
    const pk: Record<string, string | null> = {}
    for (const col of data!.primaryKey) pk[col] = row[data!.columns.indexOf(col)]
    return pk
  }

  const closeEditor = () => {
    setEditCell(null)
    setEditAnchor(null)
  }

  const startCellEdit = (r: number, c: number, el: HTMLElement) => {
    if (!canEdit || busy) return
    setInserting(false)
    setEditCell({ r, c })
    setEditAnchor(el.getBoundingClientRect())
    setCellDraft(data!.rows[r][c])
  }

  const saveCell = async () => {
    if (!data || !editCell || committing.current) return
    const { r, c } = editCell
    const original = data.rows[r]
    if (cellDraft === original[c]) {
      closeEditor()
      return
    }
    committing.current = true
    setBusy(true)
    try {
      await window.api.db.updateRow(connectionId, table.schema, table.name, pkObject(original), {
        [data.columns[c]]: cellDraft
      })
      closeEditor()
      reload()
    } catch (err) {
      dialog.notify(`Güncellenemedi: ${errMsg(err)}`, 'error')
    } finally {
      setBusy(false)
      committing.current = false
    }
  }

  const deleteRow = async (rowIndex: number) => {
    if (!data) return
    const ok = await dialog.confirm({
      title: 'Satırı Sil',
      message: 'Bu satır kalıcı olarak silinsin mi?',
      danger: true,
      confirmText: 'Sil'
    })
    if (!ok) return
    setBusy(true)
    try {
      await window.api.db.deleteRow(connectionId, table.schema, table.name, pkObject(data.rows[rowIndex]))
      reload()
    } catch (err) {
      dialog.notify(`Silinemedi: ${errMsg(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const startInsert = () => {
    if (!data) return
    setEditCell(null)
    setInserting(true)
    setInsertDraft(data.columns.map(() => null))
  }

  const saveInsert = async () => {
    if (!data) return
    const values: Record<string, string | null> = {}
    data.columns.forEach((col, i) => {
      if (insertDraft[i] !== null) values[col] = insertDraft[i]
    })
    if (Object.keys(values).length === 0) {
      dialog.notify('En az bir alana değer gir (boş bırakılanlar varsayılan/NULL olur).', 'info')
      return
    }
    setBusy(true)
    try {
      await window.api.db.insertRow(connectionId, table.schema, table.name, values)
      setInserting(false)
      reload()
    } catch (err) {
      dialog.notify(`Eklenemedi: ${errMsg(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const to = data ? Math.min(offset + LIMIT, data.total) : 0

  return (
    <div className="db-data">
      <div className="db-data-bar">
        <span className="db-data-title">
          <Icon name="table" size={14} /> {table.schema}.{table.name}
        </span>
        {data && (
          <span className="db-data-count">
            {data.total === 0 ? '0' : `${offset + 1}–${to}`} / {data.total}
          </span>
        )}
        {canEdit && <span className="db-data-hint">çift tıkla → düzenle</span>}
        <span className="spacer" />
        {!canEdit && data && (
          <span className="db-pk-warn" title={table.kind === 'view' ? 'Görünüm' : 'Birincil anahtar yok'}>
            salt-okunur
          </span>
        )}
        <button type="button" className="btn btn-ghost btn-small" onClick={reload} title="Yenile">
          <Icon name="refresh" size={14} />
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={!canEdit || busy} onClick={startInsert}>
          <Icon name="plus" size={14} /> Yeni satır
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
          ‹
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={!data || to >= data.total} onClick={() => setOffset(offset + LIMIT)}>
          ›
        </button>
      </div>

      {error ? (
        <div className="db-error">{error}</div>
      ) : !data ? (
        <p className="db-empty db-view-empty">Yükleniyor…</p>
      ) : (
        <div className="db-grid-wrap">
          <table className="db-grid">
            <thead>
              <tr>
                <th className="db-grid-rownum">#</th>
                {data.columns.map((col) => (
                  <th key={col} className="db-grid-sortable" onClick={() => toggleSort(col)}>
                    {data.primaryKey.includes(col) && <Icon name="key" size={11} className="db-pk-ico" />}
                    {col}
                    {order?.by === col && <span className="db-sort">{order.dir === 'ASC' ? ' ▲' : ' ▼'}</span>}
                  </th>
                ))}
                {canEdit && <th className="db-grid-actions" />}
              </tr>
            </thead>
            <tbody>
              {inserting && (
                <tr className="db-row-edit">
                  <td className="db-grid-rownum">+</td>
                  {data.columns.map((col, i) => (
                    <td key={col}>
                      <EditCell
                        value={insertDraft[i]}
                        onChange={(v) => setInsertDraft((d) => d.map((x, j) => (j === i ? v : x)))}
                      />
                    </td>
                  ))}
                  <td className="db-grid-actions">
                    <button type="button" className="icon-btn" disabled={busy} title="Kaydet" onClick={() => void saveInsert()}>
                      <Icon name="save" size={14} />
                    </button>
                    <button type="button" className="icon-btn" title="İptal" onClick={() => setInserting(false)}>
                      <Icon name="close" size={14} />
                    </button>
                  </td>
                </tr>
              )}

              {data.rows.map((row, r) => (
                <tr key={r}>
                  <td className="db-grid-rownum">{offset + r + 1}</td>
                  {row.map((cellValue, c) => {
                    const isEditing = editCell?.r === r && editCell?.c === c
                    return (
                      <td
                        key={c}
                        className={`${cellValue === null ? 'db-cell-null' : ''} ${isEditing ? 'is-editing' : ''}`.trim() || undefined}
                        title={cellValue ?? 'NULL'}
                        onDoubleClick={(e) => startCellEdit(r, c, e.currentTarget)}
                      >
                        {cellValue === null ? 'NULL' : cellValue}
                      </td>
                    )
                  })}
                  {canEdit && (
                    <td className="db-grid-actions">
                      <button type="button" className="icon-btn" title="Satırı sil" disabled={busy} onClick={() => void deleteRow(r)}>
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editCell && editAnchor && data && (
        <CellEditor
          anchor={editAnchor}
          columnName={data.columns[editCell.c]}
          value={cellDraft}
          busy={busy}
          onChange={setCellDraft}
          onCommit={() => void saveCell()}
          onCancel={closeEditor}
        />
      )}
    </div>
  )
}
