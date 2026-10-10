import { Component, type ReactNode } from 'react'

interface SilentBoundaryState {
  failed: boolean
}

export class SilentBoundary extends Component<{ children: ReactNode }, SilentBoundaryState> {
  state: SilentBoundaryState = { failed: false }

  static getDerivedStateFromError(): SilentBoundaryState {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
