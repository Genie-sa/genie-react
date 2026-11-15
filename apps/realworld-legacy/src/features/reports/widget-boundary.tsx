import { Component, type ErrorInfo, type ReactNode } from 'react'

interface WidgetBoundaryProps {
  name: string
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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`${this.props.name} widget failed to render`, error, info.componentStack)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
