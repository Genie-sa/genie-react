import { memo } from 'react'

const WIDTH = 96
const HEIGHT = 28

export const Sparkline = memo(function Sparkline({
  values,
  tone,
}: {
  values: readonly number[]
  tone: 'up' | 'down'
}) {
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0
  const path = values
    .map(
      (value, index) =>
        `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${(HEIGHT - ((value - min) / (max - min || 1)) * HEIGHT).toFixed(1)}`,
    )
    .join(' ')
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" className="h-7 w-24">
      <path
        d={path}
        fill="none"
        strokeWidth={1.5}
        className={tone === 'up' ? 'stroke-emerald-500' : 'stroke-rose-500'}
      />
    </svg>
  )
})
