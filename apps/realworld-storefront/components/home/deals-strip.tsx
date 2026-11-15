import type { ReactNode } from 'react'
import { getDeals } from '../../lib/data/catalog'
import { DealCountdown } from './deal-countdown'
import { ProductRail } from './product-rail'

export async function DealsStrip(): Promise<ReactNode> {
  const deals = await getDeals(new Date())
  return (
    <ProductRail
      title="Winter deals"
      products={deals.products}
      testId="deals"
      aside={<DealCountdown endsAt={deals.endsAt} />}
    />
  )
}
