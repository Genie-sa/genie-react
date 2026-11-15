import type { OrderStatus, OrderSummary } from '../../api/types'

export type ReportMetric = 'revenue' | 'orders' | 'units'
export type ReportGrouping = 'week' | 'region' | 'status' | 'priority'

export interface ReportRow {
  key: string
  value: number
}

const EXCLUDED_FROM_REVENUE: ReadonlySet<OrderStatus> = new Set(['cancelled'])

function weekKey(iso: string): string {
  const date = new Date(iso)
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day)
  return date.toISOString().slice(0, 10)
}

function metricValue(order: OrderSummary, metric: ReportMetric): number {
  if (metric === 'orders') return 1
  if (metric === 'units') return order.itemCount
  return EXCLUDED_FROM_REVENUE.has(order.status) ? 0 : order.total
}

export function buildReport(
  orders: readonly OrderSummary[],
  metric: ReportMetric,
  grouping: ReportGrouping,
): ReportRow[] {
  const totals = new Map<string, number>()
  for (const order of orders) {
    const key = grouping === 'week' ? weekKey(order.placedAt) : order[grouping]
    totals.set(key, (totals.get(key) ?? 0) + metricValue(order, metric))
  }
  const rows = [...totals].map(([key, value]) => ({ key, value: Math.round(value * 100) / 100 }))
  return grouping === 'week'
    ? rows.sort((a, b) => a.key.localeCompare(b.key))
    : rows.sort((a, b) => b.value - a.value)
}
