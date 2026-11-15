import type { ReactNode } from 'react'

export function RailSkeleton({ title, count = 4 }: { title: string; count?: number }): ReactNode {
  return (
    <section className="rail" aria-busy="true" aria-label={`${title} loading`}>
      <h2 className="section-title">{title}</h2>
      <div className="rail-track">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="card-skeleton" />
        ))}
      </div>
    </section>
  )
}

export function GridSkeleton({ count = 12 }: { count?: number }): ReactNode {
  return (
    <div className="product-grid" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card-skeleton" />
      ))}
    </div>
  )
}

export function TextSkeleton({ lines = 3 }: { lines?: number }): ReactNode {
  return (
    <div className="text-skeleton" aria-busy="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  )
}
