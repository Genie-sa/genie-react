import type { ReactNode } from 'react'

export function WidgetFrame({
  title,
  summary,
  children,
}: {
  title: string
  summary?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="widget" aria-label={title}>
      <header className="widget__header">
        <h2>{title}</h2>
        {summary && <span className="widget__summary">{summary}</span>}
      </header>
      {children}
    </section>
  )
}
