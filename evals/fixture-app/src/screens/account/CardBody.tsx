import { Component, type ReactNode } from 'react'

interface CardBodyState {
  failed: boolean
}

export class CardBody extends Component<{ children: ReactNode }, CardBodyState> {
  state: CardBodyState = { failed: false }

  static getDerivedStateFromError(): CardBodyState {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
