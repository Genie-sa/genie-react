import type { IssueSort, SortField } from '../../store/issues'

const COLUMNS: { field: SortField | null; label: string }[] = [
  { field: null, label: '' },
  { field: 'key', label: 'Key' },
  { field: 'title', label: 'Title' },
  { field: 'status', label: 'Status' },
  { field: 'priority', label: 'Priority' },
  { field: null, label: 'Assignee' },
  { field: 'updatedAt', label: 'Updated' },
]

export function IssueTableHeader({
  sort,
  onSort,
}: {
  sort: IssueSort
  onSort: (field: SortField) => void
}) {
  return (
    <thead>
      <tr>
        {COLUMNS.map((column, index) => {
          const field = column.field
          const direction = sort.field === field ? sort.direction : null
          return (
            <th
              key={index}
              aria-sort={
                direction === null ? 'none' : direction === 'asc' ? 'ascending' : 'descending'
              }
            >
              {field ? (
                <button type="button" className="sort-button" onClick={() => onSort(field)}>
                  {column.label}
                  {direction && (direction === 'asc' ? ' ▲' : ' ▼')}
                </button>
              ) : (
                column.label
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
