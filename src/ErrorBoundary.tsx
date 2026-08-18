import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode; onError?: (error: Error) => void }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SystemischesBrett]', error, info.componentStack)
    this.props.onError?.(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div
        style={{
          minHeight: '100%',
          padding: 24,
          background: '#0d1b2a',
          color: '#e0e6ed',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <strong>SystemischesBrett konnte nicht geladen werden.</strong>
        <p style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>{this.state.error.message}</p>
      </div>
    )
  }
}
