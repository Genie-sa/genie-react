'use client'

import { type PointerEvent, type ReactNode, useState } from 'react'
import type { ProductImage as ProductImageData } from '../../lib/data/types'
import { ProductImage } from '../ui/product-image'

const ZOOM_LEVELS = [1.5, 2, 3] as const

export function ImageZoom({
  image,
  productName,
  onClose,
}: {
  image: ProductImageData
  productName: string
  onClose: () => void
}): ReactNode {
  const [levelIndex, setLevelIndex] = useState(0)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })

  const trackPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setOrigin({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    })
  }

  return (
    <div className="zoom-overlay" role="dialog" aria-label={`Zoomed ${productName}`}>
      <div
        className="zoom-stage"
        onPointerMove={trackPointer}
        style={{
          transform: `scale(${ZOOM_LEVELS[levelIndex]})`,
          transformOrigin: `${origin.x}% ${origin.y}%`,
        }}
      >
        <ProductImage image={image} label={productName} size="hero" />
      </div>
      <div className="zoom-controls">
        <button
          type="button"
          onClick={() => setLevelIndex((index) => (index + 1) % ZOOM_LEVELS.length)}
        >
          Zoom {ZOOM_LEVELS[levelIndex]}×
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
