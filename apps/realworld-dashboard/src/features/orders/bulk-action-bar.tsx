import { Button } from '../../components/ui/button'
import { useWorkspaceStore } from '../../stores/workspace'
import { useBulkOrderAction } from './order-queries'

export function BulkActionBar() {
  const selectedIds = useWorkspaceStore((state) => state.selectedOrderIds)
  const clearSelection = useWorkspaceStore((state) => state.clearOrderSelection)
  const bulk = useBulkOrderAction()
  if (selectedIds.size === 0) return null

  const run = (action: 'mark_shipped' | 'hold' | 'cancel') =>
    bulk.mutate({ ids: [...selectedIds], action }, { onSuccess: clearSelection })

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm dark:border-indigo-900 dark:bg-indigo-950"
    >
      <span className="font-medium">{selectedIds.size} selected</span>
      <Button size="sm" loading={bulk.isPending} onClick={() => run('mark_shipped')}>
        Mark shipped
      </Button>
      <Button size="sm" disabled={bulk.isPending} onClick={() => run('hold')}>
        Put on hold
      </Button>
      <Button size="sm" variant="danger" disabled={bulk.isPending} onClick={() => run('cancel')}>
        Cancel
      </Button>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>
        Clear selection
      </Button>
    </div>
  )
}
