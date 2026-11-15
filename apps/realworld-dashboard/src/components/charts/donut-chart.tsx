const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export interface DonutSegment {
  label: string
  value: number
  color: string
}

export function DonutChart({
  segments,
  centerLabel,
}: {
  segments: readonly DonutSegment[]
  centerLabel: string
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  let offset = 0
  return (
    <div className="flex items-center gap-6">
      <svg
        viewBox="0 0 128 128"
        role="img"
        aria-label={centerLabel}
        className="size-32 shrink-0 -rotate-90"
      >
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          strokeWidth="14"
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        {segments.map((segment) => {
          const length = total === 0 ? 0 : (segment.value / total) * CIRCUMFERENCE
          const circle = (
            <circle
              key={segment.label}
              cx="64"
              cy="64"
              r={RADIUS}
              fill="none"
              strokeWidth="14"
              stroke={segment.color}
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={-offset}
            />
          )
          offset += length
          return circle
        })}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-slate-600 dark:text-slate-300">{segment.label}</span>
            <span className="ml-auto pl-4 tabular-nums font-medium">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
