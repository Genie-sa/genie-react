import { useQuery } from '@tanstack/react-query'
import { usePreferences } from '../../app/preferences'
import { BarList } from '../../components/charts/bar-list'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/feedback'
import { revenueByRegionQuery } from './dashboard-queries'

export function RevenueByRegionCard() {
  const { formatCompactMoney } = usePreferences()
  const { data } = useQuery(revenueByRegionQuery())
  return (
    <Card>
      <CardHeader title="Revenue by region" description="Last 30 days" />
      <CardBody>
        {!data ? (
          <Skeleton className="h-40" />
        ) : (
          <BarList
            formatValue={formatCompactMoney}
            data={data.map((entry) => ({ label: entry.region, value: entry.revenue }))}
          />
        )}
      </CardBody>
    </Card>
  )
}
