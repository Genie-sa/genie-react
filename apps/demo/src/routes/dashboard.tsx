import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/dashboard")({ component: Dashboard })

interface Metric {
  id: number
  name: string
  region: string
  revenue: number
  delta: number
  spark: number[]
}

const REGIONS = ["NA", "EMEA", "APAC", "LATAM"]
const TEAMS = [
  "Acme",
  "Globex",
  "Initech",
  "Umbrella",
  "Soylent",
  "Hooli",
  "Vandelay",
  "Stark",
  "Wayne",
  "Wonka",
]

const EMPTY_METRICS: Metric[] = []

function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function makeMetrics(): Metric[] {
  return Array.from({ length: 50 }, (_, i) => ({
    id: i,
    name: `${TEAMS[i % TEAMS.length]} ${REGIONS[i % REGIONS.length]} #${i + 1}`,
    region: REGIONS[i % REGIONS.length],
    revenue: Math.round(5000 + seeded(i) * 95000),
    delta: Math.round((seeded(i + 7) - 0.5) * 40),
    spark: Array.from({ length: 16 }, (_, j) => Math.round(seeded(i * 31 + j) * 100)),
  }))
}

async function fetchMetrics(): Promise<Metric[]> {
  await new Promise((resolve) => setTimeout(resolve, 250))
  return makeMetrics()
}

interface Kpis {
  revenue: number
  orders: number
  at: number
}

async function fetchKpis(): Promise<Kpis> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return {
    revenue: Math.round(1_000_000 + seeded(Date.now() / 1000) * 250_000),
    orders: Math.round(8000 + seeded(Date.now() / 500) * 2000),
    at: Date.now(),
  }
}

const Sparkline = memo(function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-6 items-end gap-px">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-primary/60"
          style={{ height: `${Math.round((v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
})

const MetricRow = memo(function MetricRow({
  metric,
  selected,
  onSelect,
}: {
  metric: Metric
  selected: boolean
  onSelect: (id: number) => void
}) {
  const spark = useMemo(() => metric.spark.slice(-12), [metric.spark])
  return (
    <button
      type="button"
      onClick={() => onSelect(metric.id)}
      className={`flex w-full items-center gap-4 border-b border-border/50 px-3 py-2 text-left tabular-nums hover:bg-muted/40 ${
        metric.delta < -10 ? "opacity-60" : ""
      }`}
    >
      <span className="w-44 truncate font-medium">{metric.name}</span>
      <span className="w-16 text-muted-foreground">{metric.region}</span>
      <span className="w-24">${metric.revenue.toLocaleString()}</span>
      <span className={`w-14 ${metric.delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
        {metric.delta >= 0 ? "+" : ""}
        {metric.delta}%
      </span>
      <Sparkline values={spark} />
      {selected ? <span className="ml-auto text-xs text-primary">selected</span> : null}
    </button>
  )
})

function LiveClock() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return <span>Live for {seconds}s</span>
}

function Dashboard() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const metrics = useQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn: fetchMetrics,
  })

  const kpis = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: fetchKpis,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const rows = metrics.data ?? EMPTY_METRICS
  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter((m) => m.name.toLowerCase().includes(q))
  }, [rows, search])

  const handleSelect = useCallback((id: number) => setSelectedId(id), [])

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    [queryClient],
  )

  return (
    <div className="flex min-h-svh flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            <LiveClock /> · revenue ${kpis.data ? kpis.data.revenue.toLocaleString() : "…"} ·{" "}
            {kpis.data ? kpis.data.orders.toLocaleString() : "…"} orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>
            Refresh
          </Button>
          <Link to="/" className="inline-flex items-center text-sm underline">
            ← Home
          </Link>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter teams…"
        className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />

      <div className="rounded-lg border border-border">
        <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span className="w-44">Team</span>
          <span className="w-16">Region</span>
          <span className="w-24">Revenue</span>
          <span className="w-14">Δ</span>
          <span>Trend</span>
        </div>
        {metrics.isPending ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">Loading metrics…</p>
        ) : (
          filtered.map((metric) => (
            <MetricRow
              key={metric.id}
              metric={metric}
              selected={metric.id === selectedId}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
