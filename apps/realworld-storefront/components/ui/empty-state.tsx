import Link from 'next/link'
import type { ReactNode } from 'react'

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: { href: string; label: string }
}): ReactNode {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {action ? (
        <Link className="button" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
