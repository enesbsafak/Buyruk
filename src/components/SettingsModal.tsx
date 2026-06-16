import { useReducer } from 'react'
import { DEFAULT_SETTINGS } from '../hooks/useSettings'
import type { Settings, ThemeName } from '../types'

interface SettingsModalProps {
  open: boolean
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
}

export function SettingsModal({ open, settings, onSave, onClose }: SettingsModalProps) {
  if (!open) return null

  return (
    <SettingsModalContent
      key={JSON.stringify(settings)}
      settings={settings}
      onSave={onSave}
      onClose={onClose}
    />
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
