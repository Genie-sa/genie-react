'use client'

import dynamic from 'next/dynamic'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import type { ProductImage as ProductImageData } from '../../lib/data/types'
import { ProductImage } from '../ui/product-image'

const ImageZoom = dynamic(() => import('./image-zoom').then((module) => module.ImageZoom), {
  loading: () => <p className="muted">Loading zoom…</p>,
})

export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImageData[]
  productName: string
}): ReactNode {
  const [activeIndex, setActiveIndex] = useState(0)
  const [shownImages, setShownImages] = useState(images)
  const [isZoomed, setZoomed] = useState(false)

  if (shownImages !== images) {
    setShownImages(images)
    setActiveIndex(0)
  }

  const showNext = useCallback(
    () => setActiveIndex((index) => (index + 1) % images.length),
    [images],
  )
  const showPrevious = useCallback(
    () => setActiveIndex((index) => (index - 1 + images.length) % images.length),
    [images],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.key === 'ArrowRight') showNext()
      if (event.key === 'ArrowLeft') showPrevious()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showNext, showPrevious])

  const active = images[activeIndex] ?? images[0]
  if (!active) return null

  return (
    <section
      className="gallery"
      aria-roledescription="carousel"
      aria-label={`${productName} images`}
    >
      <button type="button" className="gallery-main" onClick={() => setZoomed(true)}>
        <ProductImage image={active} label={productName} size="hero" />
      </button>
      <p className="gallery-position" aria-live="polite">
        Image {activeIndex + 1} of {images.length}
      </p>
      <div className="gallery-thumbs">
        {images.map((image, index) => (
          <button
            type="button"
            key={image.id}
            aria-label={`Show ${image.angle} view`}
            aria-current={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          >
            <ProductImage image={image} label={productName} size="thumb" />
          </button>
        ))}
      </div>
      {isZoomed ? (
        <ImageZoom image={active} productName={productName} onClose={() => setZoomed(false)} />
      ) : null}
    </section>
  )
}
