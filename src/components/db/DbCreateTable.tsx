import { useState } from 'react'
import { Icon } from '../Icon'
import { useDialog } from '../DialogProvider'
import type { DbColumnDef } from '../../types'

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

const blankColumn = (): DbColumnDef => ({
  name: '',
  dataType: 'text',
  nullable: true,
  default: '',
  primaryKey: false
})

interface DbCreateTableProps {
  connectionId: string
  schema: string
  onClose: () => void
  onCreated: () => void
}

export function DbCreateTable({ connectionId, schema, onClose, onCreated }: DbCreateTableProps) {
  const dialog = useDialog()
  const [name, setName] = useState('')
  const [columns, setColumns] = useState<DbColumnDef[]>([
    { name: 'id', dataType: 'serial', nullable: false, default: '', primaryKey: true }
  ])
  const [busy, setBusy] = useState(false)

  const update = (i: number, patch: Partial<DbColumnDef>) =>
    setColumns((cols) => cols.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  const create = async () => {
    if (!name.trim()) {
      dialog.notify('Tablo adı gerekli', 'error')
      return
    }
    const valid = columns.filter((c) => c.name.trim() && c.dataType.trim())
    if (valid.length === 0) {
      dialog.notify('En az bir geçerli kolon gerekli', 'error')
      return
    }
    setBusy(true)
    try {
      await window.api.db.createTable(connectionId, schema, name.trim(), valid)
      dialog.notify(`Tablo oluşturuldu: ${name.trim()}`, 'success')
      onCreated()
      onClose()
    } catch (err) {
      dialog.notify(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="modal db-create-modal" role="presentation" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Yeni Tablo · {schema}</h2>

        <label className="field">
          <span className="field-label">Tablo adı</span>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="orders" />
        </label>

        <div className="db-create-cols">
          <div className="db-create-col db-create-col-head">
            <span>Ad</span>
            <span>Tip</span>
            <span>Varsayılan</span>
            <span>Null</span>
            <span>PK</span>
            <span />
          </div>
          {columns.map((col, i) => (
            <div className="db-create-col" key={i}>
              <input className="field-input" value={col.name} placeholder="kolon" onChange={(e) => update(i, { name: e.target.value })} />
              <input className="field-input" value={col.dataType} placeholder="text" onChange={(e) => update(i, { dataType: e.target.value })} />
              <input className="field-input" value={col.default} placeholder="—" onChange={(e) => update(i, { default: e.target.value })} />
              <input type="checkbox" checked={col.nullable} onChange={(e) => update(i, { nullable: e.target.checked })} />
              <input type="checkbox" checked={col.primaryKey} onChange={(e) => update(i, { primaryKey: e.target.checked })} />
              <button type="button" className="icon-btn" title="Kolonu kaldır" onClick={() => setColumns((c) => c.filter((_, j) => j !== i))}>
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-ghost db-add-col" onClick={() => setColumns((c) => [...c, blankColumn()])}>
          <Icon name="plus" size={13} /> Kolon ekle
        </button>

        <div className="modal-actions">
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            İptal
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void create()}>
            {busy ? 'Oluşturuluyor…' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  )
}
