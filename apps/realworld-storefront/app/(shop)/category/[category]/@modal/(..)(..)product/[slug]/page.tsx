import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { QuickView } from '../../../../../../../components/product/quick-view'
import { RouteModal } from '../../../../../../../components/ui/modal'
import { getProduct } from '../../../../../../../lib/data/catalog'

export default async function QuickViewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<ReactNode> {
  const product = await getProduct((await params).slug)
  if (!product) notFound()
  return (
    <RouteModal title={`Quick view: ${product.name}`}>
      <QuickView product={product} />
    </RouteModal>
  )
}
