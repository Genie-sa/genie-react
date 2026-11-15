import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useAuth } from '../../app/auth'
import { CarrierPerformanceCard } from './carrier-performance-card'
import { dashboardSummaryQuery, ordersTrendQuery } from './dashboard-queries'
import { LowStockCard } from './low-stock-card'
import { OrdersTrendCard, type TrendRange } from './orders-trend-card'
import { RecentActivityCard } from './recent-activity-card'
import { RevenueByRegionCard } from './revenue-by-region-card'
import { StatCard } from './stat-card'
import { StatusBreakdownCard } from './status-breakdown-card'
import { WidgetBoundary } from './widget-boundary'

export function DashboardPage() {
  const { session } = useAuth()
  const [range, setRange] = useState<TrendRange>(30)
  const summary = useQuery(dashboardSummaryQuery())
  const trend = useQuery(ordersTrendQuery(range))

  const sparklines = useMemo(() => {
    const points = trend.data?.slice(-14) ?? []
    return {
      orders: points.map((point) => point.orders),
      revenue: points.map((point) => point.revenue),
    }
  }, [trend.data])

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Good morning, {session?.user.name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">Fulfillment overview across all regions</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (30d)"
          value={summary.data?.revenue}
          delta={summary.data?.revenueDelta}
          format="money"
          trend={sparklines.revenue}
        />
        <StatCard
          label="Orders (30d)"
          value={summary.data?.orders}
          delta={summary.data?.ordersDelta}
          format="number"
          trend={sparklines.orders}
        />
        <StatCard
          label="Fulfillment rate"
          value={summary.data?.fulfillmentRate}
          delta={summary.data?.fulfillmentDelta}
          format="percent"
        />
        <StatCard
          label="Open backlog"
          value={summary.data?.backlog}
          delta={summary.data?.backlogDelta}
          format="number"
          invertDelta
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <OrdersTrendCard range={range} onRangeChange={setRange} points={trend.data} />
        </div>
        <RevenueByRegionCard />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <StatusBreakdownCard />
        <WidgetBoundary name="carrier-performance">
          <CarrierPerformanceCard />
        </WidgetBoundary>
        <LowStockCard />
      </div>
      <RecentActivityCard />
    </div>
  )
}
