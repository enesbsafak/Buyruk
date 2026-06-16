import { useReducer } from 'react'
import { DEFAULT_SETTINGS } from '../hooks/useSettings'
import { useDialog } from './DialogProvider'
import { CliIcon } from './CliIcon'
import type { UseAccounts } from '../hooks/useAccounts'
import type { CliKind, Settings, ThemeName } from '../types'

interface SettingsModalProps {
  open: boolean
  settings: Settings
  accounts: UseAccounts
  onAddAccount: (type: CliKind) => void
  onSave: (settings: Settings) => void
  onClose: () => void
}

const ACCOUNT_KINDS: { type: CliKind; label: string }[] = [
  { type: 'claude', label: 'Claude' },
  { type: 'codex', label: 'Codex' },
  { type: 'opencode', label: 'OpenCode' }
]

export function SettingsModal({
  open,
  settings,
  accounts,
  onAddAccount,
  onSave,
  onClose
}: SettingsModalProps) {
  if (!open) return null

  return (
    <SettingsModalContent
      key={JSON.stringify(settings)}
      settings={settings}
      accounts={accounts}
      onAddAccount={onAddAccount}
      onSave={onSave}
      onClose={onClose}
    />
  )
}

interface AccountsSectionProps {
  accounts: UseAccounts
  onAddAccount: (type: CliKind) => void
  onClose: () => void
}

// Manage linked CLI accounts: set the default, rename, remove, or link a new one.
// Account operations apply immediately (independent of the Save button below).
function AccountsSection({ accounts, onAddAccount, onClose }: AccountsSectionProps) {
  const dialog = useDialog()

  const handleRename = async (id: string, current: string) => {
    const label = await dialog.prompt({
      title: 'Hesabı Yeniden Adlandır',
      label: 'Yeni etiket',
      defaultValue: current,
      confirmText: 'Kaydet'
    })
    if (label) await accounts.rename(id, label)
  }

  const handleRemove = async (id: string, label: string) => {
    const ok = await dialog.confirm({
      title: 'Hesabı Sil',
      message: `"${label}" hesabının kayıtlı giriş bilgileri silinecek. Emin misin?`,
      danger: true,
      confirmText: 'Sil'
    })
    if (ok) await accounts.remove(id)
  }

  return (
    <div className="field">
      <span className="field-label">Bağlı hesaplar</span>
      <span className="field-hint">
        Her CLI için birden fazla hesap bağlayabilirsin. Hesap bağladığında giriş
        yapman için bir terminal açılır; giriş bilgileri o hesaba özel saklanır.
      </span>

      {ACCOUNT_KINDS.map(({ type, label }) => {
        const list = accounts.accountsByType(type)
        const activeId = accounts.activeByType[type]
        return (
          <div className="account-group" key={type}>
            <div className="account-group-head">
              <CliIcon type={type} size={15} />
              <span className="account-group-title">{label}</span>
              <button
                type="button"
                className="btn btn-ghost account-add-btn"
                onClick={() => {
                  onClose()
                  onAddAccount(type)
                }}
              >
                + Hesap Bağla
              </button>
            </div>
            {list.length === 0 ? (
              <div className="account-group-empty">Bağlı hesap yok.</div>
            ) : (
              <ul className="account-list">
                {list.map((a) => (
                  <li className="account-row" key={a.id}>
                    <span className="account-row-label">{a.label}</span>
                    {a.id === activeId ? (
                      <span className="account-row-badge">varsayılan</span>
                    ) : (
                      <button
                        type="button"
                        className="account-row-action"
                        onClick={() => accounts.setActive(type, a.id)}
                      >
                        Varsayılan yap
                      </button>
                    )}
                    <button
                      type="button"
                      className="account-row-action"
                      onClick={() => handleRename(a.id, a.label)}
                    >
                      Yeniden adlandır
                    </button>
                    <button
                      type="button"
                      className="account-row-action account-row-danger"
                      onClick={() => handleRemove(a.id, a.label)}
                    >
                      Sil
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

type SettingsAction =
  | { type: 'set'; key: keyof Settings; value: Settings[keyof Settings] }
  | { type: 'reset' }

const cloneSettings = (settings: Settings): Settings => ({
  ...settings,
  hiddenFolders: [...settings.hiddenFolders]
})

function settingsReducer(draft: Settings, action: SettingsAction): Settings {
  switch (action.type) {
    case 'set':
      return { ...draft, [action.key]: action.value }
    case 'reset':
      return cloneSettings(DEFAULT_SETTINGS)
  }
}

function SettingsModalContent({
  settings,
  accounts,
  onAddAccount,
  onSave,
  onClose
}: Omit<SettingsModalProps, 'open'>) {
  const [draft, dispatch] = useReducer(settingsReducer, settings, cloneSettings)

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    dispatch({ type: 'set', key, value })

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="presentation" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Ayarlar</h2>

        <label className="field">
          <span className="field-label">CMD komutu</span>
          <input
            className="field-input"
            value={draft.cmdCommand}
            onChange={(e) => set('cmdCommand', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">PowerShell komutu</span>
          <input
            className="field-input"
            value={draft.powershellCommand}
            onChange={(e) => set('powershellCommand', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Claude komutu</span>
          <input
            className="field-input"
            value={draft.claudeCommand}
            onChange={(e) => set('claudeCommand', e.target.value)}
            placeholder="claude"
          />
        </label>

        <label className="field">
          <span className="field-label">Codex komutu</span>
          <input
            className="field-input"
            value={draft.codexCommand}
            onChange={(e) => set('codexCommand', e.target.value)}
            placeholder="codex"
          />
        </label>

        <label className="field">
          <span className="field-label">OpenCode komutu</span>
          <input
            className="field-input"
            value={draft.opencodeCommand}
            onChange={(e) => set('opencodeCommand', e.target.value)}
            placeholder="opencode"
          />
        </label>

        <AccountsSection accounts={accounts} onAddAccount={onAddAccount} onClose={onClose} />

        <label className="field">
          <span className="field-label">Varsayılan proje klasörü</span>
          <div className="field-with-button">
            <input
              className="field-input"
              value={draft.defaultProjectDir}
              onChange={(e) => set('defaultProjectDir', e.target.value)}
              placeholder="Örn. C:\Users\sen\Projeler"
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                const dir = await window.api.selectFolder(draft.defaultProjectDir || undefined)
                if (dir) set('defaultProjectDir', dir)
              }}
            >
              Gözat
            </button>
          </div>
          <span className="field-hint">
            Klasör seç ve klonla pencereleri buradan açılır. Boş bırakılırsa sistem
            varsayılanı (Belgeler) kullanılır.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Terminal fontu (Nerd Font önerilir)</span>
          <input
            className="field-input"
            value={draft.terminalFont}
            onChange={(e) => set('terminalFont', e.target.value)}
            placeholder='"JetBrainsMono NF", Consolas, monospace'
          />
        </label>

        <label className="field">
          <span className="field-label">Terminal font boyutu (px)</span>
          <input
            type="number"
            min={8}
            max={32}
            className="field-input"
            value={draft.terminalFontSize}
            onChange={(e) =>
              set('terminalFontSize', Math.max(8, Math.min(32, parseInt(e.target.value, 10) || 13)))
            }
          />
        </label>

        <label className="field">
          <span className="field-label">Tema</span>
          <select
            className="field-input"
            value={draft.theme}
            onChange={(e) => set('theme', e.target.value as ThemeName)}
          >
            <option value="dark">Koyu</option>
            <option value="light">Açık</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Gizlenecek klasörler (virgülle ayır)</span>
          <input
            className="field-input"
            value={draft.hiddenFolders.join(',')}
            onChange={(e) =>
              set(
                'hiddenFolders',
                e.target.value
                  .split(',')
                  .flatMap((s) => {
                    const folder = s.trim()
                    return folder ? [folder] : []
                  })
              )
            }
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'reset' })}>
            Varsayılana Dön
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            İptal
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)}>
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}
