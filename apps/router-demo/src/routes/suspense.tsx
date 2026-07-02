import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

export const Route = createFileRoute('/suspense')({ component: SuspensePage })

const LazyPanel = lazy(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  return {
    default: function LazyPanel() {
      return (
        <p data-testid="lazy-content" className="text-lg">
          Lazy content loaded
        </p>
      )
    },
  }
})

function SuspensePage() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Suspense Lab</h1>
      <Suspense fallback={<p data-testid="suspense-fallback">Loading lazy panel…</p>}>
        <LazyPanel />
      </Suspense>
    </div>
  )
}
