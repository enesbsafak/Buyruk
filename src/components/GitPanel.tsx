import { Icon } from './Icon'
import { basename } from '../utils/pathUtils'
import type { GitChange, GitOverview } from '../types'

interface GitPanelProps {
  overview: GitOverview
  onRefresh: () => void
  onFetch: () => void
  onOpenDiff: (path: string) => void
}

function changeKind(change: GitChange): { label: string; cls: string } {
  if (change.untracked) return { label: 'U', cls: 'git-new' }
  if (change.status.includes('D')) return { label: 'D', cls: 'git-del' }
  if (change.status.includes('A')) return { label: 'A', cls: 'git-new' }
  if (change.status.includes('R')) return { label: 'R', cls: 'git-mod' }
  return { label: 'M', cls: 'git-mod' }
}

function GitMeta({ overview }: { overview: GitOverview }) {
  return (
    <div className="git-meta">
      <span title="Branch">{overview.branch || 'HEAD'}</span>
      {overview.upstream && <span title="Upstream">{overview.upstream}</span>}
      {(overview.ahead > 0 || overview.behind > 0) && (
        <span title="Ahead / behind">
          ↑{overview.ahead} ↓{overview.behind}
        </span>
      )}
      {overview.stashCount > 0 && <span title="Stash">{overview.stashCount} stash</span>}
    </div>
  )
}

export function GitPanel({ overview, onRefresh, onFetch, onOpenDiff }: GitPanelProps) {
  if (!overview.isRepo) {
    return (
      <aside className="git-panel">
        <div className="git-panel-head">
          <span className="panel-label">Git</span>
          <button type="button" className="icon-btn" title="Yenile" onClick={onRefresh}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
        <div className="git-empty">Git deposu değil</div>
      </aside>
    )
  }

  return (
    <aside className="git-panel">
      <div className="git-panel-head">
        <div className="git-title">
          <Icon name="git-diff" size={15} />
          <span>Git</span>
        </div>
        <div className="git-actions">
          <button type="button" className="btn btn-small btn-ghost" onClick={onFetch}>
            Fetch
          </button>
          <button type="button" className="icon-btn" title="Yenile" onClick={onRefresh}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      <GitMeta overview={overview} />

      <div className="git-panel-body">
        <section className="git-section">
          <div className="git-section-title">
            <span>Değişiklikler</span>
            <span className="git-count">{overview.changes.length}</span>
          </div>
          <div className="git-list">
            {overview.changes.length === 0 && <div className="git-empty">Temiz çalışma ağacı</div>}
            {overview.changes.slice(0, 12).map((change) => {
              const kind = changeKind(change)
              return (
                <button
                  type="button"
                  key={`${change.status}:${change.path}`}
                  className="git-row"
                  title={change.path}
                  onClick={() => onOpenDiff(change.absolutePath)}
                >
                  <span className={`git-badge ${kind.cls}`}>{kind.label}</span>
                  <span className="git-row-main">
                    <span className="git-row-name">{basename(change.path)}</span>
                    <span className="git-row-path">{change.path}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="git-section">
          <div className="git-section-title">
            <span>Son commitler</span>
          </div>
          <div className="git-list">
            {overview.recentCommits.map((commit) => (
              <div className="git-commit" key={commit.hash}>
                <span className="git-hash">{commit.hash}</span>
                <span className="git-commit-main">
                  <span className="git-commit-subject">{commit.subject}</span>
                  <span className="git-commit-meta">
                    {commit.author} · {commit.relativeDate}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="git-section">
          <div className="git-section-title">
            <span>Remote hareketleri</span>
          </div>
          <div className="git-list">
            {overview.remoteActivity.length === 0 && <div className="git-empty">Remote kayıt yok</div>}
            {overview.remoteActivity.map((item) => (
              <div className="git-commit" key={`${item.name}:${item.hash}`}>
                <span className="git-hash">{item.hash}</span>
                <span className="git-commit-main">
                  <span className="git-commit-subject">{item.subject}</span>
                  <span className="git-commit-meta">
                    {item.name} · {item.author} · {item.relativeDate}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
