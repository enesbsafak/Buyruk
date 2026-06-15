import { Icon } from './Icon'
import type { AiLimitWindow, AiLimitsOverview, AiToolLimit } from '../types'

interface AiLimitsPopoverProps {
  overview: AiLimitsOverview
  onRefresh: () => void
}

function formatTime(value: number | null): string {
  if (!value) return 'reset bilinmiyor'
  return new Date(value * 1000).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatUpdated(value: number | null): string {
  if (!value) return 'henüz yok'
  return new Date(value).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function statusLabel(status: AiToolLimit['status']): string {
  switch (status) {
    case 'ready':
      return 'hazır'
    case 'loading':
      return 'okunuyor'
    case 'unavailable':
      return 'bekliyor'
    case 'error':
      return 'hata'
  }
}

function LimitWindowRow({ window }: { window: AiLimitWindow }) {
  return (
    <div className="ai-limit-window">
      <div className="ai-limit-window-top">
        <span>{window.label}</span>
        <strong>%{Math.round(window.usedPercent)}</strong>
      </div>
      <div className="ai-limit-bar" aria-hidden="true">
        <span style={{ width: `${window.usedPercent}%` }} />
      </div>
      <div className="ai-limit-window-meta">
        <span>%{Math.round(window.remainingPercent)} kaldı</span>
        <span>{formatTime(window.resetsAt)}</span>
      </div>
    </div>
  )
}

function ToolLimitCard({ item }: { item: AiToolLimit }) {
  const hasWindows = item.windows.length > 0
  return (
    <section className={`ai-limit-card limit-${item.status}`}>
      <div className="ai-limit-card-head">
        <div>
          <div className="ai-limit-name">{item.label}</div>
          <div className="ai-limit-detail">{item.detail}</div>
        </div>
        <span className={`ai-limit-state ${item.status}`}>{statusLabel(item.status)}</span>
      </div>
      {hasWindows ? (
        <div className="ai-limit-windows">
          {item.windows.map((window) => (
            <LimitWindowRow key={window.id} window={window} />
          ))}
        </div>
      ) : (
        <div className="ai-limit-empty">{item.detail}</div>
      )}
      <div className="ai-limit-updated">Son veri: {formatUpdated(item.updatedAt)}</div>
    </section>
  )
}

export function AiLimitsPopover({ overview, onRefresh }: AiLimitsPopoverProps) {
  return (
    <section className="ai-limits-panel">
      <div className="ai-limits-head">
        <div className="ai-limits-title">
          <Icon name="bolt" size={15} />
          Limitler
        </div>
        <button type="button" className="btn btn-small btn-ghost" onClick={onRefresh}>
          <Icon name="refresh" size={13} />
          Yenile
        </button>
      </div>
      <div className="ai-limits-body">
        {overview.tools.map((item) => (
          <ToolLimitCard key={item.tool} item={item} />
        ))}
      </div>
    </section>
  )
}
