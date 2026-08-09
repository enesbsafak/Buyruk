import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  componentStack: string
}

// A render or effect-cleanup crash used to unmount the whole tree and leave a
// blank window. Catch it here so the failure is visible and recoverable.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? '' })
    console.error('Buyruk arayüz hatası:', error, info.componentStack)
  }

  private readonly handleReload = (): void => {
    window.location.reload()
  }

  private readonly handleCopy = (): void => {
    const { error, componentStack } = this.state
    if (!error) return
    void window.api.copyText(
      [error.message, error.stack ?? '', componentStack].filter(Boolean).join('\n\n')
    )
  }

  render(): ReactNode {
    const { error, componentStack } = this.state
    if (!error) return this.props.children

    return (
      <div className="crash-screen">
        <div className="crash-card">
          <div className="crash-icon">
            <Icon name="warning" size={26} />
          </div>
          <h1 className="crash-title">Arayüzde bir hata oluştu</h1>
          <p className="crash-text">
            Terminal süreçleri arka planda çalışmaya devam ediyor. Arayüzü yeniden
            yükleyerek kaldığın yerden devam edebilirsin.
          </p>
          <pre className="crash-detail">{error.message}</pre>
          {componentStack && (
            <details className="crash-more">
              <summary>Teknik ayrıntı</summary>
              <pre className="crash-detail">{componentStack.trim()}</pre>
            </details>
          )}
          <div className="crash-actions">
            <button type="button" className="btn btn-ghost" onClick={this.handleCopy}>
              <Icon name="copy" size={14} /> Hatayı kopyala
            </button>
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              <Icon name="restart" size={14} /> Arayüzü yeniden yükle
            </button>
          </div>
        </div>
      </div>
    )
  }
}
