import type { ReactNode } from 'react'
import type { ProductImage as ProductImageData } from '../../lib/data/types'

function PatternShape({ image }: { image: ProductImageData }): ReactNode {
  const ink = `hsl(${image.hue} 35% 30% / 0.35)`
  switch (image.pattern) {
    case 'stripes':
      return (
        <path d="M0 10 L10 0 M-2 2 L2 -2 M8 12 L12 8" stroke={ink} strokeWidth="2" fill="none" />
      )
    case 'dots':
      return <circle cx="5" cy="5" r="1.6" fill={ink} />
    case 'grid':
      return <path d="M10 0 L0 0 0 10" stroke={ink} strokeWidth="1" fill="none" />
    case 'waves':
      return <path d="M0 5 Q2.5 2 5 5 T10 5" stroke={ink} strokeWidth="1.2" fill="none" />
  }
}

export function ProductImage({
  image,
  label,
  size = 'card',
}: {
  image: ProductImageData
  label: string
  size?: 'thumb' | 'card' | 'hero'
}): ReactNode {
  const patternId = `pattern-${image.id}-${size}`
  return (
    <svg
      className={`product-image product-image-${size}`}
      viewBox="0 0 120 150"
      role="img"
      aria-label={`${label}, ${image.color}, ${image.angle} view`}
    >
      <defs>
        <pattern id={patternId} width="10" height="10" patternUnits="userSpaceOnUse">
          <PatternShape image={image} />
        </pattern>
      </defs>
      <rect width="120" height="150" fill={`hsl(${image.hue} 45% 86%)`} />
      <rect width="120" height="150" fill={`url(#${patternId})`} />
      <rect x="30" y="35" width="60" height="80" rx="10" fill={`hsl(${image.hue} 40% 55%)`} />
    </svg>
  )
}
