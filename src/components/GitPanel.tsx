import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { basename } from '../utils/pathUtils'
import { buildSelectedGitPaths, toggleDeselectedGitPath } from '../utils/gitSelection'
import type { GitBranches, GitChange, GitCommit, GitOverview } from '../types'

interface GitPanelProps {
  overview: GitOverview
  root: string | null
  onRefresh: () => void
  onFetch: () => void
  onPush: () => void
  onPull: () => void
  onCommit: (message: string, paths: string[]) => Promise<boolean>
  onCheckoutBranch: (name: string) => void
  onCreateBranch: () => void
  onOpenFileDiff: (change: GitChange) => void
  onOpenCommitDiff: (commit: GitCommit) => void
  onClose?: () => void
}

type GitTab = 'changes' | 'history'

function changeKind(change: GitChange): { label: string; cls: string } {
  if (change.untracked) return { label: 'U', cls: 'git-new' }
  if (change.status.includes('D')) return { label: 'D', cls: 'git-del' }
  if (change.status.includes('A')) return { label: 'A', cls: 'git-new' }
  if (change.status.includes('R')) return { label: 'R', cls: 'git-mod' }
  return { label: 'M', cls: 'git-mod' }
}

// Branch picker: lists local branches, lets you switch, or create a new one.
function BranchMenu({
  root,
  current,
  refreshKey,
  onCheckout,
  onCreate
}: {
  root: string | null
  current: string
  refreshKey: number
  onCheckout: (name: string) => void
  onCreate: () => void
}) {
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<GitBranches>({ current, branches: [] })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!root) return
    let cancelled = false
    window.api
      .gitBranches(root)
      .then((b) => !cancelled && setBranches(b))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [root, refreshKey, open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="dropdown git-branch" ref={ref}>
      <button
        type="button"
        className="git-branch-btn"
        title="Branch değiştir"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="git-diff" size={13} />
        <span className="git-branch-name">{current || 'HEAD'}</span>
        <Icon name="chevron" size={11} />
      </button>
      {open && (
        <div className="dropdown-panel git-branch-panel">
          {branches.branches.length === 0 && (
            <div className="account-panel-empty">Branch bulunamadı</div>
          )}
          {branches.branches.map((name) => (
            <button
              type="button"
              key={name}
              className="dropdown-item account-item"
              onClick={() => {
                setOpen(false)
                if (name !== current) onCheckout(name)
              }}
            >
              <span className="account-item-check">
                {name === current ? <Icon name="save" size={13} /> : null}
              </span>
              <span className="dropdown-item-name">{name}</span>
            </button>
          ))}
          <div className="account-panel-sep" />
          <button
            type="button"
            className="dropdown-item account-item account-item-add"
            onClick={() => {
              setOpen(false)
              onCreate()
            }}
          >
            <span className="account-item-check">
              <Icon name="folder-plus" size={13} />
            </span>
            <span className="dropdown-item-name">Yeni branch</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function GitPanel({
  overview,
  root,
  onRefresh,
  onFetch,
  onPush,
  onPull,
  onCommit,
  onCheckoutBranch,
  onCreateBranch,
  onOpenFileDiff,
  onOpenCommitDiff,
  onClose
}: GitPanelProps) {
  const [tab, setTab] = useState<GitTab>('changes')
  const [message, setMessage] = useState('')
  const [deselectedPaths, setDeselectedPaths] = useState<Set<string>>(new Set())
  const [committing, setCommitting] = useState(false)

  const toggle = (absolutePath: string) => {
    setDeselectedPaths((prev) => toggleDeselectedGitPath(prev, absolutePath))
  }

  const selectedPaths = buildSelectedGitPaths(overview.changes, deselectedPaths)
  const canCommit = message.trim().length > 0 && selectedPaths.length > 0 && !committing

  const handleCommit = async () => {
    if (!canCommit) return
    setCommitting(true)
    const ok = await onCommit(message.trim(), selectedPaths)
    setCommitting(false)
    if (ok) setMessage('')
  }

  if (!overview.isRepo) {
    return (
      <aside className="git-panel git-dock" aria-label="Git paneli">
        <div className="git-panel-head">
          <div className="git-title">
            <Icon name="git-diff" size={15} />
            <span>Git</span>
          </div>
          <div className="git-actions">
            <button type="button" className="icon-btn" title="Yenile" onClick={onRefresh}>
              <Icon name="refresh" size={14} />
            </button>
            {onClose && (
              <button type="button" className="icon-btn" title="Kapat" onClick={onClose}>
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="git-empty git-empty-pad">Bu klasör bir Git deposu değil.</div>
      </aside>
    )
  }

  return (
    <aside className="git-panel git-dock" aria-label="Git paneli">
      <div className="git-panel-head">
        <BranchMenu
          root={root}
          current={overview.branch}
          refreshKey={overview.lastUpdated}
          onCheckout={onCheckoutBranch}
          onCreate={onCreateBranch}
        />
        <div className="git-actions">
          <button
            type="button"
            className="icon-btn git-sync-btn"
            title="Pull (çek)"
            onClick={onPull}
          >
            <Icon name="download" size={14} />
            {overview.behind > 0 && <span className="git-sync-count">{overview.behind}</span>}
          </button>
          <button
            type="button"
            className="icon-btn git-sync-btn"
            title="Push (gönder)"
            onClick={onPush}
          >
            <Icon name="git-diff" size={14} />
            {overview.ahead > 0 && <span className="git-sync-count">{overview.ahead}</span>}
          </button>
          <button type="button" className="icon-btn" title="Fetch" onClick={onFetch}>
            <Icon name="refresh" size={14} />
          </button>
          {onClose && (
            <button type="button" className="icon-btn" title="Kapat" onClick={onClose}>
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="git-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'changes'}
          className={`git-tab ${tab === 'changes' ? 'is-active' : ''}`}
          onClick={() => setTab('changes')}
        >
          Değişimler
          {overview.changes.length > 0 && (
            <span className="git-tab-count">{overview.changes.length}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={`git-tab ${tab === 'history' ? 'is-active' : ''}`}
          onClick={() => setTab('history')}
        >
          Geçmiş
        </button>
      </div>

      {tab === 'changes' ? (
        <div className="git-panel-body">
          <div className="git-commit-box">
            <textarea
              className="git-commit-input"
              aria-label="Commit mesajı"
              placeholder="Commit mesajı…"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleCommit()
              }}
            />
            <button
              type="button"
              className="btn btn-primary git-commit-submit"
              disabled={!canCommit}
              onClick={handleCommit}
            >
              <Icon name="save" size={13} />
              {committing
                ? 'Commit…'
                : `Commit${selectedPaths.length ? ` (${selectedPaths.length})` : ''}`}
            </button>
          </div>

          <div className="git-list">
            {overview.changes.length === 0 && (
              <div className="git-empty git-empty-pad">Temiz çalışma ağacı</div>
            )}
            {overview.changes.map((change) => {
              const kind = changeKind(change)
              return (
                <div className="git-row git-change-row" key={`${change.status}:${change.path}`}>
                  <input
                    type="checkbox"
                    className="git-check"
                    checked={!deselectedPaths.has(change.absolutePath)}
                    onChange={() => toggle(change.absolutePath)}
                    title="Commit'e dahil et"
                    aria-label={`${change.path} commit'e dahil et`}
                  />
                  <span className={`git-badge ${kind.cls}`}>{kind.label}</span>
                  <button
                    type="button"
                    className="git-row-main git-row-open"
                    title={`${change.path}\nFarkı aç`}
                    onClick={() => onOpenFileDiff(change)}
                  >
                    <span className="git-row-name">{basename(change.path)}</span>
                    <span className="git-row-path">{change.path}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="git-panel-body">
          <div className="git-list">
            {overview.recentCommits.length === 0 && (
              <div className="git-empty git-empty-pad">Commit kaydı yok</div>
            )}
            {overview.recentCommits.map((commit) => (
              <button
                type="button"
                className="git-commit git-commit-btn"
                key={commit.hash}
                title={`${commit.subject}\nDiff'i aç`}
                onClick={() => onOpenCommitDiff(commit)}
              >
                <span className="git-hash">{commit.hash}</span>
                <span className="git-commit-main">
                  <span className="git-commit-subject">{commit.subject}</span>
                  <span className="git-commit-meta">
                    {commit.author} · {commit.relativeDate}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {overview.remoteActivity.length > 0 && (
            <div className="git-section git-remote-section">
              <div className="git-section-title">
                <span>Remote hareketleri</span>
              </div>
              <div className="git-list">
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
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
