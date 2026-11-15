interface PaginationProps {
  page: number
  pageCount: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page + 1} of {pageCount}
      </span>
      <button type="button" disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  )
}
