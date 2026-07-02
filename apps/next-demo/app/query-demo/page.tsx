'use client'

import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { queryClient } from './query-client'

async function fetchGreeting(): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 120))
  return `hello #${Math.floor(Math.random() * 1000)}`
}

async function echoUppercase(text: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 120))
  return text.toUpperCase()
}

function QueryDemo() {
  const [runs, setRuns] = useState<string[]>([])
  const greeting = useQuery({ queryKey: ['greeting'], queryFn: fetchGreeting })
  const echo = useMutation({
    mutationFn: echoUppercase,
    onSuccess: (result) => setRuns((current) => [...current, result]),
  })

  return (
    <section>
      <h2>Query demo</h2>
      <p data-testid="greeting">{greeting.isPending ? 'loading…' : (greeting.data ?? 'none')}</p>
      <button type="button" onClick={() => greeting.refetch()}>
        Refetch greeting
      </button>
      <button type="button" onClick={() => echo.mutate('genie')}>
        Run mutation
      </button>
      <p data-testid="mutation-log">{runs.length ? runs.join(', ') : 'no runs'}</p>
    </section>
  )
}

export default function QueryDemoPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <main>
        <h1>Genie Query Demo</h1>
        <Link href="/" data-testid="to-home">
          Back to home
        </Link>
        <QueryDemo />
      </main>
    </QueryClientProvider>
  )
}
