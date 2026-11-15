import type { TrendPoint } from '../../api/types'
import { usePreferences } from '../../app/preferences'
import { LineChart } from '../../components/charts/line-chart'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/feedback'
import { Select } from '../../components/ui/form-controls'

export type TrendRange = 30 | 90

export function OrdersTrendCard({
  range,
  onRangeChange,
  points,
}: {
  range: TrendRange
  onRangeChange: (range: TrendRange) => void
  points: readonly TrendPoint[] | undefined
}) {
  const { formatNumber, formatDate } = usePreferences()
  return (
    <Card>
      <CardHeader
        title="Orders per day"
        actions={
          <Select
            aria-label="Trend range"
            value={range}
            onChange={(event) => onRangeChange(Number(event.target.value) as TrendRange)}
            className="h-8 w-32 text-xs"
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </Select>
        }
      />
      <CardBody>
        {!points ? (
          <Skeleton className="h-48" />
        ) : (
          <LineChart
            label="Orders per day"
            formatValue={(value) => formatNumber(Math.round(value))}
            points={points.map((point) => ({ label: formatDate(point.date), value: point.orders }))}
          />
        )}
      </CardBody>
    </Card>
  )
}
