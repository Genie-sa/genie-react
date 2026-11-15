'use client'

import { type ReactNode, useActionState, useState } from 'react'
import type { z } from 'zod'
import { type PlaceOrderState, submitOrder } from '../../lib/actions/checkout'
import {
  type CheckoutValues,
  contactSchema,
  deliverySchema,
  type FieldErrors,
  fieldErrors,
  paymentSchema,
} from '../../lib/checkout-schema'
import type { CartView, ShippingQuote } from '../../lib/data/types'
import { CheckoutProgress } from './checkout-progress'
import { ContactStep } from './contact-step'
import { DeliveryStep } from './delivery-step'
import { PaymentStep } from './payment-step'
import { ReviewStep } from './review-step'

const STEP_SCHEMAS: readonly z.ZodType[] = [contactSchema, deliverySchema, paymentSchema]
const REVIEW_STEP = STEP_SCHEMAS.length

const INITIAL_ORDER_STATE: PlaceOrderState = { formError: null, fieldErrors: {} }

export function CheckoutFlow({ cart, email }: { cart: CartView; email: string }): ReactNode {
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<CheckoutValues>({
    email,
    fullName: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'US',
    shippingMethod: '' as CheckoutValues['shippingMethod'],
    instructions: '',
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
  })
  const [errors, setErrors] = useState<FieldErrors<CheckoutValues>>({})
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [orderState, placeOrder, isPlacing] = useActionState(submitOrder, INITIAL_ORDER_STATE)

  const update = (field: keyof CheckoutValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
  }

  const advance = () => {
    const schema = STEP_SCHEMAS[step]
    const result = schema?.safeParse(values)
    if (result && !result.success) {
      setErrors(fieldErrors(result.error) as FieldErrors<CheckoutValues>)
      return
    }
    setErrors({})
    setStep((current) => current + 1)
  }

  const visibleErrors = { ...errors, ...orderState.fieldErrors }

  return (
    <div className="checkout-flow">
      <CheckoutProgress current={step} />
      {step === 0 ? <ContactStep values={values} errors={visibleErrors} onChange={update} /> : null}
      {step === 1 ? (
        <DeliveryStep
          values={values}
          errors={visibleErrors}
          onChange={update}
          onQuoteSelected={setQuote}
        />
      ) : null}
      {step === 2 ? <PaymentStep values={values} errors={visibleErrors} onChange={update} /> : null}
      {step === REVIEW_STEP ? <ReviewStep values={values} cart={cart} quote={quote} /> : null}
      {orderState.formError ? (
        <p role="alert" className="notice">
          {orderState.formError}
        </p>
      ) : null}
      <div className="checkout-actions">
        {step > 0 ? (
          <button type="button" className="button button-ghost" onClick={() => setStep(step - 1)}>
            Back
          </button>
        ) : null}
        {step < REVIEW_STEP ? (
          <button type="button" className="button" onClick={advance}>
            Continue
          </button>
        ) : (
          <form action={placeOrder}>
            {Object.entries(values).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className="button" disabled={isPlacing}>
              {isPlacing ? 'Placing order…' : 'Place order'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
