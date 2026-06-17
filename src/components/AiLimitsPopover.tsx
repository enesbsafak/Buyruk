import { Icon } from './Icon'
import type { AiLimitWindow, AiLimitsOverview, AiToolLimit } from '../types'

interface AiLimitsPopoverProps {
  overview: AiLimitsOverview | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}

function formatReset(value: number | null): string {
  if (!value) return 'reset bilinmiyor'
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
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

function formatPeriod(value: number | null): string | null {
  if (!value) return null
  const minutes = Math.round(value / 60000)
  if (minutes % 10080 === 0) return `${minutes / 10080} hafta`
  if (minutes % 1440 === 0) return `${minutes / 1440} gün`
  if (minutes % 60 === 0) return `${minutes / 60} saat`
  return `${minutes} dk`
}

function statusText(status: AiToolLimit['status']): string {
  switch (status) {
    case 'ready':
      return 'hazır'
    case 'unavailable':
      return 'yok'
    case 'error':
      return 'hata'
  }
}

function sourceText(item: AiToolLimit): string {
  if (item.source === 'global') return 'Global oturum'
  return 'Oturum yok'
}

function LimitWindowRow({ window }: { window: AiLimitWindow }) {
  const period = formatPeriod(window.periodDurationMs)
  const used = Math.round(window.usedPercent)
  const remaining = Math.round(window.remainingPercent)
  return (
    <div className="ai-limit-window">
      <div className="ai-limit-window-top">
        <span>{window.label}</span>
        <strong>%{used} harcandı</strong>
      </div>
      <div className="ai-limit-bar" aria-hidden="true">
        <span style={{ width: `${window.usedPercent}%` }} />
      </div>
      <div className="ai-limit-window-meta">
        <span>%{remaining} kullanım alanı var</span>
        <span>{period ? `${period} · ` : ''}{formatReset(window.resetsAt)}</span>
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
          <div className="ai-limit-detail">{sourceText(item)}</div>
        </div>
        <span className={`ai-limit-state ${item.status}`}>{statusText(item.status)}</span>
      </div>

      {item.planType && <div className="ai-limit-plan">{item.planType}</div>}
      <div className="ai-limit-note">{item.detail}</div>

      {hasWindows ? (
        <div className="ai-limit-windows">
          {item.windows.map((window) => (
            <LimitWindowRow key={window.id} window={window} />
          ))}
        </div>
      ) : (
        <div className="ai-limit-empty">{item.detail}</div>
      )}

      {item.metrics.length > 0 && (
        <div className="ai-limit-metrics">
          {item.metrics.map((metric) => (
            <div key={metric.label} className="ai-limit-metric">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="ai-limit-updated">Son veri: {formatUpdated(item.updatedAt)}</div>
    </section>
  )
}

export function AiLimitsPopover({ overview, loading, error, onRefresh }: AiLimitsPopoverProps) {
  return (
    <section className="ai-limits-panel">
      <div className="ai-limits-head">
        <div className="ai-limits-title">
          <Icon name="bolt" size={15} />
          Limitler
        </div>
        <button type="button" className="btn btn-small btn-ghost" onClick={onRefresh} disabled={loading}>
          <Icon name="refresh" size={13} />
          Yenile
        </button>
      </div>

      {error && <div className="ai-limit-alert">{error}</div>}
      {loading && !overview && <div className="ai-limit-loading">Limitler okunuyor...</div>}

      {overview && (
        <div className="ai-limits-body">
          {overview.tools.map((item) => (
            <ToolLimitCard key={item.tool} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
