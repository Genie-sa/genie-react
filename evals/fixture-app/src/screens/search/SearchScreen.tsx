import { memo, useState } from 'react'
import { StatusBadge } from './StatusBadge'

const incidents = [
  'Checkout latency above SLO',
  'Search index lagging',
  'Webhook retries exhausted',
  'Disk usage above 80% on db-2',
  'Certificate expires in 7 days',
]

const ResultCount = memo(function ResultCount({ count }: { count: number }) {
  return <p>{count} matching incidents</p>
})

export function SearchScreen() {
  const [query, setQuery] = useState('')
  const matches = incidents.filter((incident) =>
    incident.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <section className="card">
      <div className="row">
        <h1>Incidents</h1>
        <StatusBadge label="Pager on call" appearance={{ tone: 'success', size: 'sm' }} />
      </div>
      <label>
        Filter incidents{' '}
        <input
          aria-label="Filter incidents"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ResultCount count={matches.length} />
      <ul>
        {matches.map((incident) => (
          <li key={incident}>{incident}</li>
        ))}
      </ul>
    </section>
  )
}
