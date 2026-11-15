'use client'

import type { ReactNode } from 'react'
import type { FieldErrors, PaymentValues } from '../../lib/checkout-schema'
import { TextField } from './text-field'

export function PaymentStep({
  values,
  errors,
  onChange,
}: {
  values: PaymentValues
  errors: FieldErrors<PaymentValues>
  onChange: (field: keyof PaymentValues, value: string) => void
}): ReactNode {
  return (
    <fieldset className="checkout-step">
      <legend>Payment</legend>
      <p className="muted">
        This is a demo shop. Use 4242 4242 4242 4242, any future date and any CVC.
      </p>
      <TextField
        label="Name on card"
        name="cardName"
        autoComplete="cc-name"
        value={values.cardName}
        error={errors.cardName}
        onChange={(event) => onChange('cardName', event.target.value)}
      />
      <TextField
        label="Card number"
        name="cardNumber"
        inputMode="numeric"
        autoComplete="cc-number"
        value={values.cardNumber}
        error={errors.cardNumber}
        onChange={(event) => onChange('cardNumber', event.target.value)}
      />
      <div className="field-row">
        <TextField
          label="Expiry (MM/YY)"
          name="expiry"
          autoComplete="cc-exp"
          value={values.expiry}
          error={errors.expiry}
          onChange={(event) => onChange('expiry', event.target.value)}
        />
        <TextField
          label="CVC"
          name="cvc"
          inputMode="numeric"
          autoComplete="cc-csc"
          value={values.cvc}
          error={errors.cvc}
          onChange={(event) => onChange('cvc', event.target.value)}
        />
      </div>
    </fieldset>
  )
}
