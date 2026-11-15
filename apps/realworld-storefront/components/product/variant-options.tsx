'use client'

import type { ReactNode } from 'react'
import type { ColorOption, Variant } from '../../lib/data/types'

export function ColorOptions({
  colors,
  selected,
  onSelect,
}: {
  colors: ColorOption[]
  selected: string
  onSelect: (color: string) => void
}): ReactNode {
  return (
    <fieldset className="color-options">
      <legend>
        Colour: <strong>{selected}</strong>
      </legend>
      {colors.map((color) => (
        <button
          type="button"
          key={color.name}
          className="swatch-button"
          aria-label={color.name}
          aria-pressed={color.name === selected}
          style={{ background: color.hex }}
          onClick={() => onSelect(color.name)}
        />
      ))}
    </fieldset>
  )
}

export function SizeOptions({
  variants,
  selected,
  onSelect,
}: {
  variants: Variant[]
  selected: string | null
  onSelect: (size: string) => void
}): ReactNode {
  if (variants.length === 1 && variants[0]?.size === 'One size') return null
  return (
    <fieldset className="size-options">
      <legend>Size</legend>
      {variants.map((variant) => (
        <button
          type="button"
          key={variant.id}
          className="chip"
          aria-pressed={variant.size === selected}
          disabled={variant.stock === 0}
          onClick={() => onSelect(variant.size)}
        >
          {variant.size}
        </button>
      ))}
    </fieldset>
  )
}
