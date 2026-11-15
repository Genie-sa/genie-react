import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>
}
