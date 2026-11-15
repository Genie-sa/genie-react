import { useQuery } from '@tanstack/react-query'
import { DonutChart } from '../../components/charts/donut-chart'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/feedback'
import { ORDER_STATUS_META } from '../orders/order-status'
import { statusBreakdownQuery } from './dashboard-queries'

export function StatusBreakdownCard() {
  const { data } = useQuery(statusBreakdownQuery())
  return (
    <Card>
      <CardHeader title="Orders by status" description="All open and historical orders" />
      <CardBody>
        {!data ? (
          <Skeleton className="h-32" />
        ) : (
          <DonutChart
            centerLabel="Orders by status"
            segments={data.map((entry) => ({
              label: ORDER_STATUS_META[entry.status].label,
              value: entry.count,
              color: ORDER_STATUS_META[entry.status].color,
            }))}
          />
        )}
      </CardBody>
    </Card>
  )
}
