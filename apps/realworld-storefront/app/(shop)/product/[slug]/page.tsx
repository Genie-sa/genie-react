import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { type ReactNode, Suspense } from 'react'
import { Breadcrumbs } from '../../../../components/product/breadcrumbs'
import { ProductDetails } from '../../../../components/product/product-details'
import { RecordProductView } from '../../../../components/product/record-product-view'
import { RelatedProducts } from '../../../../components/product/related-products'
import { ReviewsSection } from '../../../../components/product/reviews-section'
import { SectionBoundary } from '../../../../components/ui/section-boundary'
import { RailSkeleton } from '../../../../components/ui/skeletons'
import {
  findProductBySlug,
  getInventory,
  getProduct,
  getRatingSummary,
} from '../../../../lib/data/catalog'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  return { title: findProductBySlug((await params).slug)?.name ?? 'Product' }
}

export default async function ProductPage({ params }: ProductPageProps): Promise<ReactNode> {
  const product = await getProduct((await params).slug)
  if (!product) notFound()
  const inventory = await getInventory(product.id)
  const ratings = await getRatingSummary(product.id)

  return (
    <article className="product-page">
      <Breadcrumbs product={product} />
      <ProductDetails product={product} inventory={inventory} ratings={ratings} />
      <SectionBoundary>
        <Suspense fallback={<RailSkeleton title="You may also like" />}>
          <RelatedProducts product={product} />
        </Suspense>
      </SectionBoundary>
      <ReviewsSection productId={product.id} summary={ratings} />
      <RecordProductView productId={product.id} />
    </article>
  )
}
