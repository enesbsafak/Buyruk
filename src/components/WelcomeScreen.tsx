import { Icon } from './Icon'
import { CliIcon } from './CliIcon'
import { basename } from '../utils/pathUtils'
import brandLogo from '../assets/icon.png'
import type { RecentFolder } from '../utils/persistence'
import type { TerminalType } from '../types'

interface WelcomeScreenProps {
  recents: RecentFolder[]
  onNewTerminal: (type: TerminalType) => void
  onCloneRepo: () => void
  onOpenRecent: (recent: RecentFolder) => void
}

const CLI_STARTERS: { type: TerminalType; label: string }[] = [
  { type: 'cmd', label: 'CMD' },
  { type: 'powershell', label: 'PowerShell' },
  { type: 'claude', label: 'Claude' },
  { type: 'codex', label: 'Codex' },
  { type: 'opencode', label: 'OpenCode' }
]

export function WelcomeScreen({
  recents,
  onNewTerminal,
  onCloneRepo,
  onOpenRecent
}: WelcomeScreenProps) {
  return (
    <div className="main">
      <div className="welcome">
        <div className="welcome-inner">
          <header className="welcome-head">
            <img className="welcome-logo" src={brandLogo} alt="" />
            <div>
              <h1 className="welcome-title">Buyruk</h1>
              <p className="welcome-subtitle">
                Çoklu terminal, dosya gezgini ve kod editörü. Başlamak için bir
                klasör aç ya da bir depoyu klonla.
              </p>
            </div>
          </header>

          <div className="welcome-columns">
            <section className="welcome-section">
              <h2 className="welcome-section-title">Başlangıç</h2>

              <button
                type="button"
                className="welcome-action welcome-action-primary"
                onClick={() => onNewTerminal('cmd')}
              >
                <span className="welcome-action-icon">
                  <Icon name="folder" size={18} />
                </span>
                <span className="welcome-action-body">
                  <span className="welcome-action-label">Klasör Aç</span>
                  <span className="welcome-action-hint">
                    Bir klasör seç ve terminal oturumu başlat
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="welcome-action"
                onClick={onCloneRepo}
              >
                <span className="welcome-action-icon">
                  <Icon name="download" size={18} />
                </span>
                <span className="welcome-action-body">
                  <span className="welcome-action-label">GitHub'dan Klonla</span>
                  <span className="welcome-action-hint">
                    Depo adresini gir, git clone ile indir ve aç
                  </span>
                </span>
              </button>

              <div className="welcome-starters">
                <span className="welcome-starters-label">Yeni oturum</span>
                <div className="welcome-starters-row">
                  {CLI_STARTERS.map(({ type, label }) => (
                    <button
                      type="button"
                      key={type}
                      className="welcome-starter"
                      title={`Yeni ${label}`}
                      onClick={() => onNewTerminal(type)}
                    >
                      <CliIcon type={type} size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="welcome-section">
              <h2 className="welcome-section-title">Son klasörler</h2>
              {recents.length === 0 ? (
                <p className="welcome-empty">
                  Henüz açılmış bir klasör yok. Açtığın klasörler burada listelenir.
                </p>
              ) : (
                <div className="welcome-recents">
                  {recents.map((recent) => (
                    <button
                      type="button"
                      key={recent.cwd}
                      className="welcome-recent"
                      title={recent.cwd}
                      onClick={() => onOpenRecent(recent)}
                    >
                      <CliIcon type={recent.type} size={16} />
                      <span className="welcome-recent-name">{basename(recent.cwd)}</span>
                      <span className="welcome-recent-path">{recent.cwd}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
