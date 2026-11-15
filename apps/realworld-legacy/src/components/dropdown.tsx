import { Component, createRef, type ReactNode } from 'react'

export interface DropdownRenderProps {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

interface DropdownProps {
  children: (props: DropdownRenderProps) => ReactNode
  onOpenChange?: (isOpen: boolean) => void
}

interface DropdownState {
  isOpen: boolean
}

export class Dropdown extends Component<DropdownProps, DropdownState> {
  state: DropdownState = { isOpen: false }
  private readonly container = createRef<HTMLDivElement>()

  componentDidMount() {
    document.addEventListener('mousedown', this.handleDocumentClick)
  }

  componentDidUpdate(_prevProps: DropdownProps, prevState: DropdownState) {
    if (prevState.isOpen !== this.state.isOpen) this.props.onOpenChange?.(this.state.isOpen)
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleDocumentClick)
  }

  handleDocumentClick = (event: MouseEvent) => {
    if (this.state.isOpen && !this.container.current?.contains(event.target as Node)) this.close()
  }

  toggle = () => this.setState((state) => ({ isOpen: !state.isOpen }))

  close = () => this.setState({ isOpen: false })

  render() {
    return (
      <div className="dropdown" ref={this.container}>
        {this.props.children({ isOpen: this.state.isOpen, toggle: this.toggle, close: this.close })}
      </div>
    )
  }
}
