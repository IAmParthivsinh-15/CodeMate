import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Changing this value resets the boundary (e.g. the current route). */
  resetKey?: string
}

interface State {
  error: Error | null
}

/** Top-level error boundary: a crash in one page never blanks the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    // A stale chunk after a deploy shows up as a failed dynamic import.
    const chunk = /dynamically imported module|Loading chunk|Failed to fetch/i.test(this.state.error.message)
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
        <div className="text-3xl text-danger" aria-hidden="true">
          ⚠
        </div>
        <h1 className="text-lg font-semibold">{chunk ? 'A new version is available' : 'This page crashed'}</h1>
        <p className="text-sm text-muted">
          {chunk ? 'Reload to get the latest version of CodeMate.' : 'An unexpected error occurred. You can try again or go back home.'}
        </p>
        {!chunk && <pre className="max-w-full overflow-x-auto rounded bg-surface-2 p-2 text-xs text-muted">{this.state.error.message}</pre>}
        <div className="flex gap-2">
          <button
            type="button"
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg"
            onClick={() => (chunk ? window.location.reload() : this.setState({ error: null }))}
          >
            {chunk ? 'Reload' : 'Try again'}
          </button>
          <a href="/" className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm">
            Home
          </a>
        </div>
      </div>
    )
  }
}
