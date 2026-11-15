import type { ReactNode } from 'react'

export function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  )
}
