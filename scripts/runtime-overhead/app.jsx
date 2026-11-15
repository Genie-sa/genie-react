import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import {
  createContext,
  memo,
  Profiler,
  Suspense,
  use,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { createRoot } from 'react-dom/client'

/** What React did, counted by the app itself so runs with and without Genie can be compared exactly. */
export const oracle = {
  commits: 0,
  renders: 0,
  effectRuns: 0,
  effectCleanups: 0,
  layoutEffectRuns: 0,
  layoutEffectCleanups: 0,
}

const METRIC_QUERIES = 12
const SHARED_QUERY_OBSERVERS = 4
const NAV_ITEMS = 40
const SPARK_BARS = 16
const STATUSES = ['open', 'blocked', 'review', 'done']

const ThemeContext = createContext('light')
const SessionContext = createContext(null)

function rendered() {
  oracle.renders += 1
}

function useCountedEffect(dependencies) {
  useEffect(() => {
    oracle.effectRuns += 1
    return () => {
      oracle.effectCleanups += 1
    }
  }, dependencies)
}

function useCountedLayoutEffect(dependencies) {
  useLayoutEffect(() => {
    oracle.layoutEffectRuns += 1
    return () => {
      oracle.layoutEffectCleanups += 1
    }
  }, dependencies)
}

export function createItems(count, revision) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    title: `Task ${index}`,
    status: STATUSES[(index + revision) % STATUSES.length],
    estimate: (index * 7 + revision) % 13,
    tags: [`team-${index % 9}`, `area-${index % 5}`, index % 2 === 0 ? 'frontend' : 'backend'],
    owner: {
      id: index % 50,
      name: `Owner ${index % 50}`,
      email: `owner${index % 50}@example.test`,
    },
    history: Array.from({ length: 12 }, (_, step) => ((index + step) * 31 + revision) % 97),
  }))
}

const metricValue = (index, revision) =>
  Array.from({ length: SPARK_BARS }, (_, bar) => (index * 13 + bar * 7 + revision) % 50)

function Icon({ name }) {
  rendered()
  return <i data-icon={name} />
}

const NavItem = memo(function NavItem({ index, active, onNavigate }) {
  rendered()
  return (
    <li>
      <button
        type="button"
        data-nav={index}
        aria-current={active}
        onClick={() => onNavigate(index)}
      >
        <Icon name={`nav-${index % 8}`} />
        Section {index}
      </button>
    </li>
  )
})

function Sidebar({ active, onNavigate }) {
  rendered()
  return (
    <nav>
      <ul>
        {Array.from({ length: NAV_ITEMS }, (_, index) => (
          <NavItem key={index} index={index} active={index === active} onNavigate={onNavigate} />
        ))}
      </ul>
    </nav>
  )
}

export function Clock({ tick }) {
  rendered()
  const theme = useContext(ThemeContext)
  return (
    <time data-clock data-theme={theme}>
      {tick}
    </time>
  )
}

function UserMenu() {
  rendered()
  const session = useContext(SessionContext)
  useCountedEffect([session.user.id])
  return <span data-user>{session.user.name}</span>
}

function SearchBox({ value, onChange }) {
  rendered()
  return <input data-search value={value} onChange={(event) => onChange(event.target.value)} />
}

function Header({ tick, filter, onFilter, onRefresh }) {
  rendered()
  return (
    <header>
      <Clock tick={tick} />
      <SearchBox value={filter} onChange={onFilter} />
      <button type="button" data-refresh onClick={onRefresh}>
        Refresh
      </button>
      <UserMenu />
    </header>
  )
}

function Bar({ value }) {
  rendered()
  return <span style={{ height: value }} />
}

function Sparkline({ values }) {
  rendered()
  return (
    <div data-sparkline>
      {values.map((value, index) => (
        <Bar key={index} value={value} />
      ))}
    </div>
  )
}

function MetricWidget({ index }) {
  rendered()
  const query = useQuery({ queryKey: ['metric', index], queryFn: () => metricValue(index, 0) })
  useCountedEffect([query.dataUpdatedAt])
  return (
    <section data-metric={index}>
      <h3>Metric {index}</h3>
      {query.data ? <Sparkline values={query.data} /> : <p>Loading</p>}
    </section>
  )
}

function SummaryWidget({ slot }) {
  rendered()
  const query = useQuery({
    queryKey: ['summary'],
    queryFn: () => ({ open: 1, done: 0, revision: 0 }),
  })
  return (
    <output data-summary={slot}>
      {query.data ? `${query.data.open}/${query.data.done}/${query.data.revision}` : '…'}
    </output>
  )
}

function ReleaseNotes({ notes }) {
  rendered()
  const text = use(notes)
  return <aside data-notes>{text}</aside>
}

function Dashboard({ notes }) {
  rendered()
  return (
    <div data-dashboard>
      {Array.from({ length: METRIC_QUERIES }, (_, index) => (
        <MetricWidget key={index} index={index} />
      ))}
      {Array.from({ length: SHARED_QUERY_OBSERVERS }, (_, slot) => (
        <SummaryWidget key={slot} slot={slot} />
      ))}
      <Suspense fallback={<p>Loading notes</p>}>
        <ReleaseNotes notes={notes} />
      </Suspense>
    </div>
  )
}

function Cell({ children }) {
  rendered()
  return <td>{children}</td>
}

function StatusBadge({ status }) {
  rendered()
  const theme = useContext(ThemeContext)
  return <span className={`badge ${status} ${theme}`}>{status}</span>
}

function Avatar({ owner }) {
  rendered()
  return <span title={owner.email}>{owner.name.slice(0, 2)}</span>
}

function RowActions({ id }) {
  rendered()
  const [open, setOpen] = useState(false)
  return (
    <button type="button" data-row-actions={id} onClick={() => setOpen((value) => !value)}>
      {open ? 'Close' : 'More'}
    </button>
  )
}

function RowSubscription({ id, selected, status }) {
  rendered()
  useCountedEffect([id, selected, status])
  return null
}

function RowMeasure({ selected }) {
  rendered()
  useCountedLayoutEffect([selected])
  return null
}

const Row = memo(function Row({ item, selected, onSelect }) {
  rendered()
  const total = item.history.reduce((sum, value) => sum + value, 0)
  return (
    <tr data-row={item.id} aria-selected={selected} onClick={() => onSelect(item.id)}>
      <Cell>{item.title}</Cell>
      <Cell>
        <StatusBadge status={item.status} />
      </Cell>
      <Cell>
        <Avatar owner={item.owner} />
      </Cell>
      <Cell>{total}</Cell>
      <td>
        <RowActions id={item.id} />
        {item.id % 3 === 0 && (
          <RowSubscription id={item.id} selected={selected} status={item.status} />
        )}
        {item.id % 10 === 0 && <RowMeasure selected={selected} />}
      </td>
    </tr>
  )
})

function DataTable({ items, filter, selectedId, onSelect }) {
  rendered()
  const visible = useMemo(
    () => (filter ? items.filter((item) => item.title.includes(filter)) : items),
    [items, filter],
  )
  return (
    <table>
      <tbody>
        {visible.map((item) => (
          <Row key={item.id} item={item} selected={item.id === selectedId} onSelect={onSelect} />
        ))}
      </tbody>
    </table>
  )
}

function Workspace({ rows, notes, controller }) {
  rendered()
  const [tick, setTick] = useState(0)
  const [filter, setFilter] = useState('')
  const [revision, setRevision] = useState(0)
  const [selectedId, setSelectedId] = useState(-1)
  const [section, setSection] = useState(0)
  const items = useMemo(() => createItems(rows, revision), [rows, revision])
  const onRefresh = useCallback(() => setRevision((value) => value + 1), [])
  const session = useMemo(() => ({ user: { id: 7, name: 'Ada' }, section }), [section])
  controller.tick = () => setTick((value) => value + 1)
  controller.setFilter = setFilter
  controller.refresh = onRefresh
  controller.select = setSelectedId
  return (
    <ThemeContext value={tick % 50 === 49 ? 'dark' : 'light'}>
      <SessionContext value={session}>
        <Header tick={tick} filter={filter} onFilter={setFilter} onRefresh={onRefresh} />
        <Sidebar active={section} onNavigate={setSection} />
        <main>
          <Dashboard notes={notes} />
          <DataTable
            items={items}
            filter={filter}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </main>
      </SessionContext>
    </ThemeContext>
  )
}

/** Mount the fixture app; `extras` renders inside the QueryClientProvider, where `<Genie />` belongs. */
export function mountApp(container, { rows, extras }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY, refetchOnWindowFocus: false },
    },
  })
  // A fulfilled thenable renders synchronously, so startup counts never depend on when a promise settled.
  const notes = Object.assign(Promise.resolve('Release notes'), {
    status: 'fulfilled',
    value: 'Release notes',
  })
  const controller = {}
  const onRender = () => {
    oracle.commits += 1
  }
  const root = createRoot(container)
  root.render(
    <QueryClientProvider client={queryClient}>
      <Profiler id="fixture" onRender={onRender}>
        <Workspace rows={rows} notes={notes} controller={controller} />
      </Profiler>
      {extras?.(queryClient)}
    </QueryClientProvider>,
  )
  return { root, queryClient, controller, notes }
}

export { metricValue }
