import { type ReactNode, Suspense } from 'react'
import { CategoryTiles } from '../../components/home/category-tiles'
import { DealsStrip } from '../../components/home/deals-strip'
import { EditorsPicks } from '../../components/home/editors-picks'
import { FeaturedCollection } from '../../components/home/featured-collection'
import { HeroBanner } from '../../components/home/hero-banner'
import { NewArrivals } from '../../components/home/new-arrivals'
import { NewsletterSignup } from '../../components/home/newsletter-signup'
import { RecentlyViewed } from '../../components/home/recently-viewed'
import { RailSkeleton } from '../../components/ui/skeletons'

export default function HomePage(): ReactNode {
  return (
    <>
      <HeroBanner />
      <Suspense fallback={<RailSkeleton title="Featured this week" />}>
        <FeaturedCollection />
        <EditorsPicks />
      </Suspense>
      <Suspense fallback={<RailSkeleton title="New arrivals" />}>
        <NewArrivals />
      </Suspense>
      <Suspense fallback={<RailSkeleton title="Winter deals" count={3} />}>
        <DealsStrip />
      </Suspense>
      <CategoryTiles />
      <RecentlyViewed />
      <NewsletterSignup />
    </>
  )
}
