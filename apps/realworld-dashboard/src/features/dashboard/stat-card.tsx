import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { memo } from 'react'
import { usePreferences } from '../../app/preferences'
import { Sparkline } from '../../components/charts/sparkline'
import { Skeleton } from '../../components/ui/feedback'
import { cn } from '../../lib/cn'

export type StatFormat = 'money' | 'number' | 'percent'

export interface StatCardProps {
  label: string
  value: number | undefined
  delta: number | undefined
  format: StatFormat
  trend?: readonly number[]
  invertDelta?: boolean
}

export const StatCard = memo(function StatCard({
  label,
  value,
  delta,
  format,
  trend,
  invertDelta = false,
}: StatCardProps) {
  const { formatCompactMoney, formatNumber, formatPercent } = usePreferences()
  const formatValue = { money: formatCompactMoney, number: formatNumber, percent: formatPercent }[
    format
  ]
  const positive = (delta ?? 0) >= 0
  const good = invertDelta ? !positive : positive
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      {value === undefined ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="text-2xl font-semibold tabular-nums">{formatValue(value)}</p>
          {trend && trend.length > 1 && <Sparkline values={trend} tone={good ? 'up' : 'down'} />}
        </div>
      )}
      {delta !== undefined && (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-xs font-medium',
            good ? 'text-emerald-600' : 'text-rose-600',
          )}
        >
          {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {format === 'percent' ? `${Math.abs(delta)} pts` : `${Math.abs(delta)}%`} vs previous 30
          days
        </p>
      )}
    </div>
  )
})
