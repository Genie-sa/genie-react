import type { ReactNode } from 'react'
import type { Specification } from '../../lib/data/types'

export function SpecificationTable({
  specifications,
}: {
  specifications: Specification[]
}): ReactNode {
  return (
    <section>
      <h2>Specifications</h2>
      <dl className="spec-table">
        {specifications.map((specification) => (
          <div key={specification.label}>
            <dt>{specification.label}</dt>
            <dd>{specification.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
