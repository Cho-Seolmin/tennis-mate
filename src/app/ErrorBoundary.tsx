import { Component, type ReactNode } from 'react'
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
          <ErrorMessage
            title="화면을 표시하지 못했습니다"
            message="예상하지 못한 문제가 발생했습니다. 다시 시도해 주세요."
            onRetry={this.handleReset}
          />
        </div>
      )
    }

    return this.props.children
  }
}
