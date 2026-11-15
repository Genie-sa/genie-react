import { useNavigate } from '@tanstack/react-router'
import { Boxes, Package, Search, Users } from 'lucide-react'
import { type KeyboardEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/endpoints'
import type { SearchResponse, SearchResult } from '../api/types'
import { Spinner } from '../components/ui/feedback'
import { cn } from '../lib/cn'
import { useDebouncedValue } from '../lib/use-debounced-value'

const SEARCH_DEBOUNCE_MS = 150
const MIN_TERM_LENGTH = 2
const ICONS = { order: Package, customer: Users, product: Boxes } as const

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const debouncedTerm = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    if (debouncedTerm.length < MIN_TERM_LENGTH) {
      setResponse(null)
      return
    }
    setLoading(true)
    api
      .search(debouncedTerm)
      .then((result) => {
        setResponse(result)
        setActiveIndex(0)
      })
      .catch(() => setResponse({ query: debouncedTerm, results: [] }))
      .finally(() => setLoading(false))
  }, [debouncedTerm])

  const results = response?.results ?? []

  const open = (result: SearchResult) => {
    onClose()
    if (result.type === 'order')
      void navigate({ to: '/orders/$orderId', params: { orderId: result.id } })
    else if (result.type === 'customer')
      void navigate({ to: '/customers/$customerId', params: { customerId: result.id } })
    else void navigate({ to: '/inventory', search: { q: result.title } })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') onClose()
    if (event.key === 'ArrowDown')
      setActiveIndex((index) => Math.min(results.length - 1, index + 1))
    if (event.key === 'ArrowUp') setActiveIndex((index) => Math.max(0, index - 1))
    const active = results[activeIndex]
    if (event.key === 'Enter' && active) open(active)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 pt-[15vh]">
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Search"
        className="relative w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <Search className="size-4 text-slate-400" />
          <input
            autoFocus
            aria-label="Search everything"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search orders, customers, products…"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
          {loading && <Spinner className="size-4" />}
        </div>
        <ul aria-label="Search results" className="max-h-80 overflow-y-auto py-2">
          {debouncedTerm.length < MIN_TERM_LENGTH && (
            <li className="px-4 py-6 text-center text-sm text-slate-400">
              Type at least two characters
            </li>
          )}
          {response && results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-400">
              No matches for “{response.query}”
            </li>
          )}
          {results.map((result, index) => {
            const Icon = ICONS[result.type]
            return (
              <li key={`${result.type}:${result.id}`}>
                <button
                  type="button"
                  onClick={() => open(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                    index === activeIndex && 'bg-indigo-50 dark:bg-indigo-950',
                  )}
                >
                  <Icon className="size-4 text-slate-400" />
                  <span className="font-medium">{result.title}</span>
                  <span className="truncate text-slate-500">{result.subtitle}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
