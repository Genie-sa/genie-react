import { RefreshCw } from 'lucide-react'
import { usePreferences } from '../../app/preferences'
import { cn } from '../../lib/cn'
import { useNow } from '../../lib/use-now'

const TICK_MS = 1_000

export function SyncStatus({
  label,
  updatedAt,
  fetching,
  onRefresh,
}: {
  label: string
  updatedAt: number
  fetching: boolean
  onRefresh: () => void
}) {
  const now = useNow(TICK_MS)
  const { formatRelative } = usePreferences()
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span aria-live="polite">
        {updatedAt === 0
          ? 'Not synced yet'
          : `Updated ${formatRelative(updatedAt, Math.max(now, updatedAt))}`}
      </span>
      <button
        type="button"
        aria-label={label}
        onClick={onRefresh}
        className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <RefreshCw className={cn('size-3.5', fetching && 'animate-spin')} />
      </button>
    </div>
  )
}
