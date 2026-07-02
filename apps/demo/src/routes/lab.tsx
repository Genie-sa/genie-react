import {
  Component,
  Suspense,
  createContext,
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { cartDevtoolsClient } from "../lib/cart-devtools"
import type { CartItem } from "../lib/cart-devtools"
import { useMetricsDevtools } from "../lib/metrics-devtools"

export const Route = createFileRoute("/lab")({ component: LabPage })

const ThemeContext = createContext("light")
ThemeContext.displayName = "ThemeContext"

interface LabErrorBoundaryState {
  hasError: boolean
}

class LabErrorBoundary extends Component<{ children: ReactNode }, LabErrorBoundaryState> {
  state: LabErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): LabErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return <p data-testid="lab-error">lab-error</p>
    return this.props.children
  }
}

const StatBadge = memo(function StatBadge({
  stats,
  onPing,
}: {
  stats: { count: number }
  onPing: () => void
}) {
  return (
    <button type="button" data-testid="lab-stat" onClick={onPing}>
      stat:{stats.count}
    </button>
  )
})

function Counter() {
  const [count, setCount] = useState(0)
  const clicksRef = useRef(0)

  useEffect(() => {
    document.title = `Lab · count ${count}`
  }, [count])

  return (
    <p data-testid="lab-counter">
      count:{count}
      <button
        type="button"
        onClick={() => {
          clicksRef.current += 1
          setCount((value) => value + 1)
        }}
      >
        increment
      </button>
      <StatBadge stats={{ count }} onPing={() => undefined} />
    </p>
  )
}

function ThemeLabel() {
  const theme = useContext(ThemeContext)
  return <p data-testid="lab-theme">theme:{theme}</p>
}

function SuspenseContent() {
  return <p data-testid="lab-suspense">lab-content</p>
}

function Bomb(): never {
  throw new Error("lab-bomb")
}

function ErrorZone() {
  const [armed, setArmed] = useState(false)
  return (
    <div data-testid="lab-error-zone" className="flex items-center gap-2">
      <button type="button" onClick={() => setArmed(true)}>
        explode
      </button>
      <LabErrorBoundary>
        {armed ? <Bomb /> : <span data-testid="lab-calm">calm</span>}
      </LabErrorBoundary>
    </div>
  )
}

const SLOW_MS = 25000
let slowPromise: Promise<void> | null = null
let slowDone = false

function SlowContent() {
  if (!slowDone) {
    slowPromise ??= new Promise((resolve) =>
      setTimeout(() => {
        slowDone = true
        resolve()
      }, SLOW_MS),
    )
    throw slowPromise
  }
  return <span data-testid="lab-slow">slow-loaded</span>
}

function SuspenseZone() {
  const [showSlow, setShowSlow] = useState(false)
  return (
    <div data-testid="lab-suspense-zone" className="flex items-center gap-2">
      <button type="button" onClick={() => setShowSlow(true)}>
        load slow
      </button>
      <Suspense fallback={<span data-testid="lab-slow-fallback">slow-loading</span>}>
        {showSlow ? <SlowContent /> : <span data-testid="lab-slow-idle">slow-idle</span>}
      </Suspense>
    </div>
  )
}

function CartWidget() {
  const [items, setItems] = useState<Array<CartItem>>([])
  const nextIdRef = useRef(1)

  useEffect(() => {
    cartDevtoolsClient.emit("cart-updated", { items: [], total: 0 })
  }, [])

  const syncCart = (next: Array<CartItem>) => {
    setItems(next)
    cartDevtoolsClient.emit("cart-updated", {
      items: next,
      total: next.reduce((sum, item) => sum + item.price, 0),
    })
  }

  const addItem = (name: string, price: number) => {
    const id = `item-${nextIdRef.current}`
    nextIdRef.current += 1
    syncCart([...items, { id, name, price }])
  }

  return (
    <div data-testid="lab-cart" className="flex items-center gap-2">
      <span>cart:{items.length}</span>
      <button type="button" onClick={() => addItem("Tea", 4)}>
        add tea
      </button>
      <button type="button" onClick={() => addItem("Coffee", 6)}>
        add coffee
      </button>
      <button type="button" onClick={() => syncCart(items.slice(0, -1))}>
        remove last
      </button>
    </div>
  )
}

function LabPage() {
  useMetricsDevtools()

  return (
    <div className="flex min-h-svh flex-col gap-2 p-6 text-sm leading-loose">
      <h1 className="font-medium">Lab</h1>
      <ThemeContext.Provider value="light">
        <LabErrorBoundary>
          <Suspense fallback={<p data-testid="lab-fallback">lab-loading</p>}>
            <SuspenseContent />
          </Suspense>
          <Counter />
          <ThemeLabel />
          <CartWidget />
        </LabErrorBoundary>
        <ErrorZone />
        <SuspenseZone />
      </ThemeContext.Provider>
    </div>
  )
}
