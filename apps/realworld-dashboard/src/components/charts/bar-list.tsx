export interface BarDatum {
  label: string
  value: number
}

export function BarList({
  data,
  formatValue,
}: {
  data: readonly BarDatum[]
  formatValue: (value: number) => string
}) {
  const max = Math.max(1, ...data.map((datum) => datum.value))
  return (
    <ul className="space-y-3">
      {data.map((datum) => (
        <li key={datum.label} className="text-sm">
          <div className="mb-1 flex justify-between">
            <span className="font-medium">{datum.label}</span>
            <span className="tabular-nums text-slate-500">{formatValue(datum.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-2 rounded-full bg-indigo-500"
              style={{ width: `${(datum.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
