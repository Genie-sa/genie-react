import { useMemo } from 'react'

export interface LinePoint {
  label: string
  value: number
}

const WIDTH = 640
const HEIGHT = 200
const PADDING = { top: 12, right: 12, bottom: 24, left: 44 }

export function LineChart({
  points,
  formatValue,
  label,
}: {
  points: readonly LinePoint[]
  formatValue: (value: number) => string
  label: string
}) {
  const geometry = useMemo(() => {
    const max = Math.max(1, ...points.map((point) => point.value))
    const innerWidth = WIDTH - PADDING.left - PADDING.right
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom
    const step = points.length > 1 ? innerWidth / (points.length - 1) : 0
    const coordinates = points.map((point, index) => ({
      x: PADDING.left + index * step,
      y: PADDING.top + innerHeight - (point.value / max) * innerHeight,
    }))
    return {
      max,
      path: coordinates
        .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
        .join(' '),
      area: `M${PADDING.left},${PADDING.top + innerHeight} ${coordinates.map(({ x, y }) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${PADDING.left + innerWidth},${PADDING.top + innerHeight} Z`,
      gridlines: [0, 0.5, 1].map((ratio) => ({
        y: PADDING.top + innerHeight - ratio * innerHeight,
        value: max * ratio,
      })),
    }
  }, [points])

  const firstLabel = points[0]?.label
  const lastLabel = points.at(-1)?.label
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-48 w-full">
      {geometry.gridlines.map((line) => (
        <g key={line.y}>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={line.y}
            y2={line.y}
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          <text
            x={PADDING.left - 6}
            y={line.y + 4}
            textAnchor="end"
            className="fill-slate-400 text-[10px]"
          >
            {formatValue(line.value)}
          </text>
        </g>
      ))}
      <path d={geometry.area} className="fill-indigo-500/10" />
      <path d={geometry.path} fill="none" strokeWidth={2} className="stroke-indigo-500" />
      {firstLabel && (
        <text x={PADDING.left} y={HEIGHT - 6} className="fill-slate-400 text-[10px]">
          {firstLabel}
        </text>
      )}
      {lastLabel && (
        <text
          x={WIDTH - PADDING.right}
          y={HEIGHT - 6}
          textAnchor="end"
          className="fill-slate-400 text-[10px]"
        >
          {lastLabel}
        </text>
      )}
    </svg>
  )
}
