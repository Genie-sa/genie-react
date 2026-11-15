import { Component, type ErrorInfo, type ReactNode } from 'react'
import { track } from '../../lib/telemetry'

interface WidgetBoundaryProps {
  name: string
  fallback?: ReactNode
  children: ReactNode
}

interface WidgetBoundaryState {
  failed: boolean
}

export class WidgetBoundary extends Component<WidgetBoundaryProps, WidgetBoundaryState> {
  state: WidgetBoundaryState = { failed: false }

  static getDerivedStateFromError(): WidgetBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    track('widget_error', {
      widget: this.props.name,
      message: error.message,
      stack: info.componentStack?.slice(0, 500) ?? '',
    })
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}
