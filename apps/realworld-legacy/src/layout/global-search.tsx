import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/badges'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { searchIssues } from '../store/search'
import { debounce } from '../utils/debounce'

const SEARCH_DELAY_MS = 250

export function GlobalSearch() {
  const dispatch = useAppDispatch()
  const [query, setQuery] = useState('')
  const [isOpen, setOpen] = useState(false)
  const { results, total, status } = useAppSelector((state) => state.search)

  const runSearch = useMemo(
    () => debounce(() => dispatch(searchIssues(query)), SEARCH_DELAY_MS),
    [],
  )
  useEffect(() => runSearch.cancel, [runSearch])

  return (
    <div className="global-search">
      <input
        type="search"
        aria-label="Search issues"
        placeholder="Search issues"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          runSearch()
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {isOpen && query && (
        <div className="global-search__results" role="listbox" aria-label="Search results">
          {status === 'loading' && <div className="muted">Searching…</div>}
          {results.map((issue) => (
            <Link
              key={issue.id}
              role="option"
              aria-selected={false}
              to={`/issues/${issue.key}`}
              className="global-search__result"
            >
              <span className="issue-key">{issue.key}</span>
              <span>{issue.title}</span>
              <StatusBadge status={issue.status} />
            </Link>
          ))}
          <div className="muted">{total} matching issues</div>
        </div>
      )}
    </div>
  )
}
