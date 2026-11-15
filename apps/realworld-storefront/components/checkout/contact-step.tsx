'use client'

import type { ReactNode } from 'react'
import { COUNTRIES, type ContactValues, type FieldErrors } from '../../lib/checkout-schema'
import { TextField } from './text-field'

export function ContactStep({
  values,
  errors,
  onChange,
}: {
  values: ContactValues
  errors: FieldErrors<ContactValues>
  onChange: (field: keyof ContactValues, value: string) => void
}): ReactNode {
  return (
    <fieldset className="checkout-step">
      <legend>Contact and address</legend>
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        error={errors.email}
        onChange={(event) => onChange('email', event.target.value)}
      />
      <TextField
        label="Full name"
        name="fullName"
        autoComplete="name"
        value={values.fullName}
        error={errors.fullName}
        onChange={(event) => onChange('fullName', event.target.value)}
      />
      <TextField
        label="Street address"
        name="street"
        autoComplete="street-address"
        value={values.street}
        error={errors.street}
        onChange={(event) => onChange('street', event.target.value)}
      />
      <div className="field-row">
        <TextField
          label="City"
          name="city"
          autoComplete="address-level2"
          value={values.city}
          error={errors.city}
          onChange={(event) => onChange('city', event.target.value)}
        />
        <TextField
          label="Postal code"
          name="postalCode"
          autoComplete="postal-code"
          value={values.postalCode}
          error={errors.postalCode}
          onChange={(event) => onChange('postalCode', event.target.value)}
        />
      </div>
      <label className="field">
        <span>Country</span>
        <select
          name="country"
          value={values.country}
          onChange={(event) => onChange('country', event.target.value)}
        >
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}
