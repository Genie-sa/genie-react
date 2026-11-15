import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-slate-500"
    >
      <span>
        {first}–{last} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  )
}
