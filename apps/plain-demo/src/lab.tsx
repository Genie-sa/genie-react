import {
  Component,
  createContext,
  lazy,
  memo,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

const ThemeContext = createContext<string>('light')

interface MemoChildProps {
  label: string
  config: { theme: string }
}

const MemoChildWithUnstableProp = memo(function MemoChildWithUnstableProp({
  label,
  config,
}: MemoChildProps): ReactElement {
  return (
    <p data-testid="memo-child">
      {label} · {config.theme}
    </p>
  )
})

function EffectCounter(): ReactElement {
  const [count, setCount] = useState(0)
  const commitCountRef = useRef(0)

  useEffect((): void => {
    commitCountRef.current += 1
  })

  useEffect((): void => {
    document.title = `Genie Lab · count ${count}`
  }, [count])

  return (
    <section>
      <button data-testid="increment" onClick={(): void => setCount((value) => value + 1)}>
        increment {count}
      </button>
      <MemoChildWithUnstableProp label="stable-label" config={{ theme: 'dark' }} />
    </section>
  )
}

function ThemedLabel(): ReactElement {
  const theme = useContext(ThemeContext)
  return <span data-testid="themed-label">theme: {theme}</span>
}

function Bomb({ explode }: { explode: boolean }): ReactElement {
  if (explode) throw new Error('boom from Bomb')
  return <p data-testid="bomb">bomb is safe</p>
}

class LabErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  render(): ReactNode {
    if (this.state.error) return <p data-testid="boundary">caught: {this.state.error.message}</p>
    return this.props.children
  }
}

function BombPanel(): ReactElement {
  const [explode, setExplode] = useState(false)
  return (
    <section>
      <button data-testid="throw" onClick={(): void => setExplode(true)}>
        throw
      </button>
      <LabErrorBoundary>
        <Bomb explode={explode} />
      </LabErrorBoundary>
    </section>
  )
}

function LoadedSlowChild(): ReactElement {
  return <p data-testid="slow-child">slow child loaded</p>
}

const SlowChild = lazy(
  (): Promise<{ default: ComponentType }> =>
    new Promise((resolve) => {
      setTimeout(() => resolve({ default: LoadedSlowChild }), 6000)
    }),
)

function SuspensePanel(): ReactElement {
  const [show, setShow] = useState(false)
  return (
    <section>
      <button data-testid="load-slow" onClick={(): void => setShow(true)}>
        load slow
      </button>
      <Suspense fallback={<p data-testid="suspense-fallback">loading slow child…</p>}>
        {show ? <SlowChild /> : null}
      </Suspense>
    </section>
  )
}

function Disposable(): ReactElement {
  useEffect((): void => undefined, [])
  return <p data-testid="disposable">disposable mounted</p>
}

function UnmountPanel(): ReactElement {
  const [mounted, setMounted] = useState(true)
  return (
    <section>
      <button data-testid="toggle-mount" onClick={(): void => setMounted((value) => !value)}>
        toggle mount
      </button>
      {mounted ? <Disposable /> : null}
    </section>
  )
}

let greetingFetches = 0

async function fetchGreeting(): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 200))
  greetingFetches += 1
  return `greeting #${greetingFetches}`
}

function QueryDemo(): ReactElement {
  const { data, isFetching } = useQuery({ queryKey: ['greeting'], queryFn: fetchGreeting })
  return (
    <p data-testid="greeting">
      {data ?? 'loading'}
      {isFetching ? ' (fetching)' : ''}
    </p>
  )
}

let mutationRuns = 0

async function runMutation(input: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 150))
  mutationRuns += 1
  return `mutation ${input} #${mutationRuns}`
}

function MutationDemo(): ReactElement {
  const mutation = useMutation({ mutationFn: runMutation })
  return (
    <section>
      <button data-testid="mutate" onClick={(): void => mutation.mutate('ping')}>
        mutate
      </button>
      <p data-testid="mutation-result">{mutation.data ?? 'no mutation yet'}</p>
    </section>
  )
}

export function App(): ReactElement {
  const [theme, setTheme] = useState('light')
  return (
    <ThemeContext.Provider value={theme}>
      <main>
        <h1>Genie Plain Demo Lab</h1>
        <button
          data-testid="toggle-theme"
          onClick={(): void => setTheme((value) => (value === 'light' ? 'dark' : 'light'))}
        >
          toggle theme
        </button>
        <ThemedLabel />
        <EffectCounter />
        <BombPanel />
        <SuspensePanel />
        <UnmountPanel />
        <QueryDemo />
        <MutationDemo />
      </main>
    </ThemeContext.Provider>
  )
}
