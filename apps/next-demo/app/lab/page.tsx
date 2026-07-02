'use client'

import Link from 'next/link'
import { Component, createContext, Suspense, useContext, useState, type ReactNode } from 'react'

const ThemeContext = createContext('light')

function ThemedBadge() {
  const theme = useContext(ThemeContext)
  return <p data-testid="themed-badge">Active theme: {theme}</p>
}

function ThemeSection() {
  return (
    <ThemeContext.Provider value="midnight">
      <section>
        <h2>Theme context</h2>
        <ThemedBadge />
      </section>
    </ThemeContext.Provider>
  )
}

class DemoErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  render(): ReactNode {
    if (this.state.error) {
      return <p data-testid="boundary-caught">Boundary caught: {this.state.error.message}</p>
    }
    return this.props.children
  }
}

function Bomb({ armed }: { armed: boolean }) {
  if (armed) throw new Error('Bomb detonated')
  return <p data-testid="bomb">Bomb is safe</p>
}

function BombSection() {
  const [armed, setArmed] = useState(false)
  return (
    <section>
      <h2>Error boundary</h2>
      <DemoErrorBoundary>
        <Bomb armed={armed} />
      </DemoErrorBoundary>
      <button type="button" onClick={() => setArmed(true)}>
        Detonate bomb
      </button>
    </section>
  )
}

function ReadyContent() {
  return <p data-testid="ready-content">Suspense child ready</p>
}

function SuspenseSection() {
  return (
    <section>
      <h2>Suspense fallback</h2>
      <Suspense fallback={<p data-testid="suspense-fallback">Loading suspense child…</p>}>
        <ReadyContent />
      </Suspense>
    </section>
  )
}

const pendingForever = new Promise<never>(() => {})

function HoldSuspender({ hold }: { hold: boolean }) {
  if (hold) throw pendingForever
  return <p data-testid="hold-content">Hold content ready</p>
}

function HoldSection() {
  const [hold, setHold] = useState(false)
  return (
    <section>
      <h2>Real suspension</h2>
      <Suspense fallback={<p data-testid="hold-fallback">Holding…</p>}>
        <HoldSuspender hold={hold} />
      </Suspense>
      <button type="button" onClick={() => setHold(true)}>
        Suspend for real
      </button>
    </section>
  )
}

export default function LabPage() {
  return (
    <main>
      <h1>Genie Lab</h1>
      <Link href="/" data-testid="to-home">
        Back to home
      </Link>
      <ThemeSection />
      <BombSection />
      <SuspenseSection />
      <HoldSection />
    </main>
  )
}
