import { createFileRoute } from '@tanstack/react-router'
import { Component, useState, type ReactNode } from 'react'

export const Route = createFileRoute('/error')({ component: ErrorPage })

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div data-testid="error-ui" className="rounded bg-red-100 p-4">
          <p>Caught: {this.state.error.message}</p>
          <button data-testid="reset" onClick={() => this.setState({ error: null })}>
            Reset
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function Bomb() {
  const [armed, setArmed] = useState(false)
  if (armed) throw new Error('boom from /error')
  return (
    <button data-testid="throw" className="rounded bg-red-600 px-4 py-2 text-white" onClick={() => setArmed(true)}>
      Throw
    </button>
  )
}

function ErrorPage() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Error Lab</h1>
      <Boundary>
        <Bomb />
      </Boundary>
    </div>
  )
}
