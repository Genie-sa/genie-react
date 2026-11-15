import type { ReactNode } from 'react'
import { TextSkeleton } from '../../../../components/ui/skeletons'

export default function ProductLoading(): ReactNode {
  return (
    <div className="product-layout" aria-busy="true">
      <div className="card-skeleton card-skeleton-hero" />
      <TextSkeleton lines={8} />
    </div>
  )
}
