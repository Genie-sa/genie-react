import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createContext, memo, useContext, useEffect, useState, type CSSProperties } from 'react'

const ThemeContext = createContext('light')

export const Route = createFileRoute('/')({ component: Home })

function emitLabEvent(count: number): void {
  window.dispatchEvent(
    new CustomEvent('tanstack-devtools-global', {
      detail: { type: 'lab-bus:click', payload: { count } },
    }),
  )
}

function Home() {
  const [count, setCount] = useState(0)
  const [text, setText] = useState('')

  useEffect(() => {
    document.title = `lab ${count}:${text.length}`
  }, [count, text])

  const increment = () => {
    const next = count + 1
    emitLabEvent(next)
    setCount(next)
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-4xl font-bold">Genie Router Lab</h1>
      <Counter count={count} onIncrement={increment} />
      <input
        data-testid="typebox"
        className="block rounded border px-3 py-2"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="type here"
      />
      <MemoBadge label={`typed ${text.length} chars`} style={{ padding: 4 }} />
      <ThemeContext.Provider value="light">
        <ThemeLabel />
      </ThemeContext.Provider>
      <QueryPanel />
    </div>
  )
}

function ThemeLabel() {
  const theme = useContext(ThemeContext)
  return <p data-testid="theme">theme: {theme}</p>
}

let fetchCount = 0

async function fetchGreeting(): Promise<{ greeting: string; fetchCount: number }> {
  fetchCount += 1
  await new Promise((resolve) => setTimeout(resolve, 300))
  return { greeting: 'hello from queryFn', fetchCount }
}

function QueryPanel() {
  const greeting = useQuery({ queryKey: ['greeting'], queryFn: fetchGreeting })
  const shout = useMutation({
    mutationFn: async (word: string) => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      return `${word.toUpperCase()}!`
    },
  })

  return (
    <div className="space-y-2 rounded border p-4">
      <p data-testid="query-data">
        {greeting.isPending
          ? 'query pending…'
          : `${greeting.data?.greeting} (fetch #${greeting.data?.fetchCount})`}
      </p>
      <p data-testid="query-fetching">{greeting.isFetching ? 'FETCHING' : 'idle'}</p>
      <button
        data-testid="mutate"
        className="rounded bg-emerald-600 px-4 py-2 text-white"
        onClick={() => shout.mutate('genie')}
      >
        Shout
      </button>
      <p data-testid="mutation-result">{shout.data ?? 'no mutation yet'}</p>
    </div>
  )
}

function Counter({ count, onIncrement }: { count: number; onIncrement: () => void }) {
  return (
    <button
      data-testid="counter"
      className="rounded bg-blue-600 px-4 py-2 text-white"
      onClick={onIncrement}
    >
      Count: {count}
    </button>
  )
}

const MemoBadge = memo(function MemoBadge({
  label,
  style,
}: {
  label: string
  style: CSSProperties
}) {
  return (
    <p data-testid="badge" style={style}>
      {label}
    </p>
  )
})
