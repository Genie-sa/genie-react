'use client'

import { type ReactNode, useState } from 'react'
import { catalogHref, toggleValue } from '../../lib/catalog-params'
import type { CatalogQuery, ColorOption } from '../../lib/data/types'
import { useCatalogNavigation } from './catalog-navigation'

const COLLAPSED_COLOR_COUNT = 5
const PRICE_CAPS = [50, 100, 200, 300] as const

export function FilterPanel({
  query,
  colors,
  sizes,
}: {
  query: CatalogQuery
  colors: ColorOption[]
  sizes: string[]
}): ReactNode {
  const { navigate } = useCatalogNavigation()
  const [showAllColors, setShowAllColors] = useState(false)
  const visibleColors = showAllColors ? colors : colors.slice(0, COLLAPSED_COLOR_COUNT)

  return (
    <aside className="filter-panel" aria-label="Filters">
      <fieldset>
        <legend>Colour</legend>
        {visibleColors.map((color) => (
          <label key={color.name} className="check">
            <input
              type="checkbox"
              checked={query.colors.includes(color.name)}
              onChange={() =>
                navigate(catalogHref(query, { colors: toggleValue(query.colors, color.name) }))
              }
            />
            <span className="swatch" style={{ background: color.hex }} aria-hidden="true" />
            {color.name}
          </label>
        ))}
        {colors.length > COLLAPSED_COLOR_COUNT ? (
          <button
            type="button"
            className="link-button"
            onClick={() => setShowAllColors((value) => !value)}
          >
            {showAllColors ? 'Show fewer colours' : `Show all ${colors.length} colours`}
          </button>
        ) : null}
      </fieldset>
      {sizes.length > 1 ? (
        <fieldset>
          <legend>Size</legend>
          <div className="size-options">
            {sizes.map((size) => (
              <label key={size} className="chip">
                <input
                  type="checkbox"
                  checked={query.sizes.includes(size)}
                  onChange={() =>
                    navigate(catalogHref(query, { sizes: toggleValue(query.sizes, size) }))
                  }
                />
                {size}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <fieldset>
        <legend>Price</legend>
        {PRICE_CAPS.map((cap) => (
          <label key={cap} className="check">
            <input
              type="radio"
              name="maxPrice"
              checked={query.maxPriceCents === cap * 100}
              onChange={() => navigate(catalogHref(query, { maxPriceCents: cap * 100 }))}
            />
            Up to {cap}
          </label>
        ))}
        {query.maxPriceCents !== null ? (
          <button
            type="button"
            className="link-button"
            onClick={() => navigate(catalogHref(query, { maxPriceCents: null }))}
          >
            Any price
          </button>
        ) : null}
      </fieldset>
      <label className="check">
        <input
          type="checkbox"
          checked={query.inStockOnly}
          onChange={() => navigate(catalogHref(query, { inStockOnly: !query.inStockOnly }))}
        />
        In stock only
      </label>
    </aside>
  )
}
