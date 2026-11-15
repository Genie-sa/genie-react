import type { ReactNode } from 'react'
import { EmptyState } from '../components/ui/empty-state'

export default function NotFound(): ReactNode {
  return (
    <main className="page">
      <EmptyState
        title="Page not found"
        message="The page you were looking for has moved or never existed."
        action={{ href: '/', label: 'Back to the shop' }}
      />
    </main>
  )
}
