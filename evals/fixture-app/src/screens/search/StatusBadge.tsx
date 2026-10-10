import { memo } from 'react'

export interface BadgeAppearance {
  tone: 'success' | 'warning'
  size: 'sm' | 'md'
}

const toneColors: Record<BadgeAppearance['tone'], string> = {
  success: '#dafbe1',
  warning: '#fff8c5',
}

export const StatusBadge = memo(function StatusBadge({
  label,
  appearance,
}: {
  label: string
  appearance: BadgeAppearance
}) {
  return (
    <span
      className="badge"
      style={{
        background: toneColors[appearance.tone],
        fontSize: appearance.size === 'sm' ? 12 : 14,
      }}
    >
      {label}
    </span>
  )
})
