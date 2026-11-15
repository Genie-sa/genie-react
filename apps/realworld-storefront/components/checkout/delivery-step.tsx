'use client'

import type { ReactNode } from 'react'
import type { CheckoutValues, DeliveryValues, FieldErrors } from '../../lib/checkout-schema'
import type { ShippingQuote } from '../../lib/data/types'
import { ShippingOptions } from './shipping-options'

export function DeliveryStep({
  values,
  errors,
  onChange,
  onQuoteSelected,
}: {
  values: CheckoutValues
  errors: FieldErrors<DeliveryValues>
  onChange: (field: keyof DeliveryValues, value: string) => void
  onQuoteSelected: (quote: ShippingQuote) => void
}): ReactNode {
  return (
    <fieldset className="checkout-step">
      <legend>Delivery</legend>
      <ShippingOptions
        destination={{ country: values.country, postalCode: values.postalCode }}
        selected={values.shippingMethod}
        error={errors.shippingMethod}
        onSelect={(quote) => {
          onChange('shippingMethod', quote.id)
          onQuoteSelected(quote)
        }}
      />
      <label className="field">
        <span>Delivery instructions (optional)</span>
        <textarea
          name="instructions"
          rows={3}
          maxLength={200}
          value={values.instructions}
          onChange={(event) => onChange('instructions', event.target.value)}
        />
        {errors.instructions ? <span className="field-error">{errors.instructions}</span> : null}
      </label>
    </fieldset>
  )
}
