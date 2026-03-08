import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--bg-base)' }}>
          <div className="glass-card p-8 max-w-md text-center">
            <h2 className="font-display text-xl font-bold mb-3" style={{ color: 'var(--pace-interval)' }}>
              Coś poszło nie tak
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              {this.state.error?.message || 'Nieznany błąd'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Odśwież stronę
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
