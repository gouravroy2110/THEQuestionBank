import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleResetToHome = () => {
    window.location.href = window.location.origin + window.location.pathname
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#181818] text-[#f3f3f3] flex flex-col items-center justify-center p-6 select-none">
          <div className="max-w-lg w-full bg-[#1e1e1e] border border-rose-500/30 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>

            <h2 className="text-lg font-bold text-[#f3f3f3] mb-1">
              Something went wrong
            </h2>
            <p className="text-xs text-[#858585] mb-4">
              An unexpected error occurred while rendering the interface.
            </p>

            {this.state.error && (
              <div className="w-full bg-[#141414] border border-[#2b2b2b] rounded-xl p-3 text-left mb-5 overflow-auto max-h-40">
                <p className="text-xs font-mono text-rose-400 font-semibold mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <pre className="text-[10px] font-mono text-[#858585] whitespace-pre-wrap">
                    {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                  </pre>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2 px-3 rounded-lg bg-[#0078d4] text-white text-xs font-medium hover:bg-[#006cbd] transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={13} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetToHome}
                className="py-2 px-3 rounded-lg border border-[#3c3c3c] bg-[#252526] text-[#cccccc] text-xs font-medium hover:bg-[#2a2d2e] transition-colors flex items-center justify-center gap-2"
              >
                <Home size={13} />
                <span>Reset to Hub</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
