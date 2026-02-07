'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 min-h-[200px]">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md w-full text-center">
            <div className="text-4xl mb-3">!</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Something went wrong
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              An unexpected error occurred. Please try again.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-400/70 mb-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <Button
              onClick={this.handleReset}
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              Try Again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
