import type { ReactNode } from 'react'
import { GridSkeleton } from '../../components/ui/skeletons'

export default function Loading(): ReactNode {
  return <GridSkeleton count={8} />
}
