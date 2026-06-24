import { useState } from 'react'
import { Icon } from '../Icon'
import { parsePostgresUrl } from '../../utils/parsePostgresUrl'
import type { DbConnectionInput, SavedDbConnection } from '../../types'

interface DbConnectFormProps {
  connections: SavedDbConnection[]
  connecting: boolean
  onConnectInline: (input: DbConnectionInput) => void
  onConnectSaved: (id: string) => void
  onSave: (input: DbConnectionInput, id?: string) => void
  onDelete: (id: string) => void
}

const EMPTY: DbConnectionInput = {
  label: '',
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '',
  ssl: false
}

export function DbConnectForm({
  connections,
  connecting,
  onConnectInline,
  onConnectSaved,
  onSave,
  onDelete
}: DbConnectFormProps) {
  const [form, setForm] = useState<DbConnectionInput>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [url, setUrl] = useState('')

  const set = <K extends keyof DbConnectionInput>(key: K, value: DbConnectionInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Paste a postgres:// URL to auto-fill the discrete fields.
  const applyUrl = (value: string) => {
    setUrl(value)
    const parsed = parsePostgresUrl(value)
    if (!parsed) return
    setForm((f) => ({
      ...f,
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      user: parsed.user,
      password: parsed.password,
      ssl: parsed.ssl,
      label: f.label || `${parsed.user}@${parsed.host}`
    }))
  }

  const startEdit = (conn: SavedDbConnection) => {
    setEditingId(conn.id)
    setUrl('')
    setForm({
      label: conn.label,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      user: conn.user,
      password: '',
      ssl: conn.ssl
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY)
    setUrl('')
  }

  return (
    <div className="db-connect">
      <div className="db-connect-inner">
        <header className="db-connect-hero">
          <span className="db-connect-hero-icon">
            <Icon name="database" size={24} />
          </span>
          <div>
            <h2>PostgreSQL Bağlantısı</h2>
            <p>
              Bir bağlantı adresi yapıştır ya da bilgileri elle gir. Şifreler bu cihazda
              şifreli saklanır.
            </p>
          </div>
        </header>

        <div className="db-connect-grid">
          <section className="db-card">
            <h3 className="db-card-title">{editingId ? 'Bağlantıyı Düzenle' : 'Yeni Bağlantı'}</h3>

            <label className="field">
              <span className="field-label">Hızlı bağlan — bağlantı adresi</span>
              <input
                className="field-input"
                value={url}
                spellCheck={false}
                placeholder="postgres://kullanici:sifre@host:5432/veritabani"
                onChange={(e) => applyUrl(e.target.value)}
              />
            </label>

            <div className="db-field-row">
              <label className="field db-grow">
                <span className="field-label">Sunucu (host)</span>
                <input className="field-input" value={form.host} onChange={(e) => set('host', e.target.value)} />
              </label>
              <label className="field db-port">
                <span className="field-label">Port</span>
                <input
                  type="number"
                  className="field-input"
                  value={form.port}
                  onChange={(e) => set('port', parseInt(e.target.value, 10) || 5432)}
                />
              </label>
            </div>

            <div className="db-field-row">
              <label className="field db-grow">
                <span className="field-label">Veritabanı</span>
                <input className="field-input" value={form.database} onChange={(e) => set('database', e.target.value)} />
              </label>
              <label className="field db-grow">
                <span className="field-label">Kullanıcı</span>
                <input className="field-input" value={form.user} onChange={(e) => set('user', e.target.value)} />
              </label>
            </div>

            <div className="db-field-row">
              <label className="field db-grow">
                <span className="field-label">
                  Şifre {editingId && <span className="field-hint-inline">(boş = değişmez)</span>}
                </span>
                <input
                  type="password"
                  className="field-input"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
              </label>
              <label className="field db-port">
                <span className="field-label">Etiket</span>
                <input
                  className="field-input"
                  value={form.label}
                  placeholder={`${form.user}@${form.host}`}
                  onChange={(e) => set('label', e.target.value)}
                />
              </label>
            </div>

            <div className="db-connect-actions">
              <label className="db-checkbox">
                <input type="checkbox" checked={form.ssl} onChange={(e) => set('ssl', e.target.checked)} />
                <span>SSL</span>
              </label>
              <span className="spacer" />
              {editingId && (
                <button type="button" className="btn btn-ghost" onClick={resetForm}>
                  Yeni
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => onSave(form, editingId ?? undefined)}>
                <Icon name="save" size={14} /> Kaydet
              </button>
              <button type="button" className="btn btn-primary" disabled={connecting} onClick={() => onConnectInline(form)}>
                <Icon name="power" size={14} /> {connecting ? 'Bağlanıyor…' : 'Bağlan'}
              </button>
            </div>
          </section>

          <section className="db-card db-saved">
            <h3 className="db-card-title">Kayıtlı Bağlantılar</h3>
            {connections.length === 0 ? (
              <div className="db-saved-empty">
                <Icon name="database" size={26} />
                <p>Henüz kayıtlı bağlantı yok.</p>
                <span>Bağlandığında otomatik olarak buraya eklenir.</span>
              </div>
            ) : (
              <ul className="db-saved-list">
                {connections.map((conn) => (
                  <li key={conn.id} className="db-saved-item">
                    <button
                      type="button"
                      className="db-saved-main"
                      disabled={connecting}
                      onClick={() => onConnectSaved(conn.id)}
                      title="Bağlan"
                    >
                      <span className="db-saved-avatar">
                        <Icon name="database" size={15} />
                      </span>
                      <span className="db-saved-text">
                        <span className="db-saved-label">{conn.label}</span>
                        <span className="db-saved-sub">
                          {conn.user}@{conn.host}:{conn.port}/{conn.database}
                        </span>
                      </span>
                    </button>
                    <button type="button" className="icon-btn" title="Düzenle" onClick={() => startEdit(conn)}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button type="button" className="icon-btn" title="Sil" onClick={() => onDelete(conn.id)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
