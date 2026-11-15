import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { usePreferences } from '../../app/preferences'
import { BarList } from '../../components/charts/bar-list'
import { LineChart } from '../../components/charts/line-chart'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { ErrorPanel, PageSpinner } from '../../components/ui/feedback'
import { Select } from '../../components/ui/form-controls'
import { ordersListQuery } from '../orders/order-queries'
import { buildReport, type ReportGrouping, type ReportMetric } from './report-model'

const METRICS: readonly { id: ReportMetric; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'orders', label: 'Orders' },
  { id: 'units', label: 'Units shipped' },
]
const GROUPINGS: readonly { id: ReportGrouping; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'region', label: 'Region' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
]

export function ReportsPage() {
  const { formatCompactMoney, formatNumber, formatDate } = usePreferences()
  const [metric, setMetric] = useState<ReportMetric>('revenue')
  const [grouping, setGrouping] = useState<ReportGrouping>('week')
  const orders = useQuery(ordersListQuery({}))
  const rows = useMemo(
    () => (orders.data ? buildReport(orders.data.items, metric, grouping) : []),
    [orders.data, metric, grouping],
  )
  const formatValue = metric === 'revenue' ? formatCompactMoney : formatNumber

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-slate-500">
            Explore fulfillment metrics over the last 120 days
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            aria-label="Metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as ReportMetric)}
            className="w-40"
          >
            {METRICS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Group by"
            value={grouping}
            onChange={(event) => setGrouping(event.target.value as ReportGrouping)}
            className="w-36"
          >
            {GROUPINGS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                By {entry.label.toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
      </header>
      {orders.isPending ? (
        <PageSpinner />
      ) : orders.isError ? (
        <ErrorPanel
          title="Report data could not be loaded"
          message={orders.error.message}
          onRetry={() => void orders.refetch()}
        />
      ) : (
        <Card>
          <CardHeader
            title={`${METRICS.find((entry) => entry.id === metric)?.label} by ${grouping}`}
            description={`${orders.data.total.toLocaleString()} orders analysed`}
          />
          <CardBody>
            {grouping === 'week' ? (
              <LineChart
                label="Report trend"
                formatValue={formatValue}
                points={rows.map((row) => ({ label: formatDate(row.key), value: row.value }))}
              />
            ) : (
              <BarList
                formatValue={formatValue}
                data={rows.map((row) => ({ label: row.key.replace('_', ' '), value: row.value }))}
              />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
