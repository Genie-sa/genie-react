'use client'

import type { ReactNode } from 'react'

export function QuantityStepper({
  label,
  value,
  max,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  max: number
  disabled?: boolean
  onChange: (next: number) => void
}): ReactNode {
  return (
    <fieldset className="stepper">
      <legend className="visually-hidden">Quantity for {label}</legend>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </fieldset>
  )
}
