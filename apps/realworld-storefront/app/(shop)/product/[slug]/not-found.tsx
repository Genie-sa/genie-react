import type { ReactNode } from 'react'
import { EmptyState } from '../../../../components/ui/empty-state'

export default function ProductNotFound(): ReactNode {
  return (
    <EmptyState
      title="This product is no longer available"
      message="It may have sold out for the season. Similar pieces are in the catalogue."
      action={{ href: '/', label: 'Keep shopping' }}
    />
  )
}
