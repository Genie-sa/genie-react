import { createFileRoute, Link } from '@tanstack/react-router'
import { GenieToolError, useGenieTool } from 'genie-react'
import { useState, type ReactNode } from 'react'
import { z } from 'zod'

export const Route = createFileRoute('/checkout')({ component: CheckoutWizard })

const STEPS = ['cart', 'shipping', 'payment', 'done'] as const
type Step = (typeof STEPS)[number]

const COUPONS: Record<string, number> = { SAVE10: 10, SAVE25: 25 }
const CART_TOTAL = 120

function CheckoutWizard(): ReactNode {
  const [step, setStep] = useState<Step>('cart')
  const [coupon, setCoupon] = useState<string | null>(null)
  const [couponInput, setCouponInput] = useState('')

  const discount = coupon ? COUPONS[coupon] : 0
  const total = CART_TOTAL - discount

  const applyCoupon = (code: string): { coupon: string; discount: number; total: number } => {
    const normalized = code.trim().toUpperCase()
    const value = COUPONS[normalized]
    if (value === undefined) {
      throw new GenieToolError(`coupon "${normalized}" does not exist`, {
        code: 'INVALID_COUPON',
        hint: 'valid demo coupons: SAVE10, SAVE25',
      })
    }
    setCoupon(normalized)
    return { coupon: normalized, discount: value, total: CART_TOTAL - value }
  }

  useGenieTool({
    name: 'checkout_state',
    group: 'checkout',
    kind: 'query',
    description:
      'Current checkout wizard state: the active step, applied coupon, discount, and order total.',
    handler: () => ({ step, coupon, discount, total, steps: STEPS }),
  })

  useGenieTool({
    name: 'checkout_goto',
    group: 'checkout',
    kind: 'action',
    idempotent: true,
    description:
      'Jumps the checkout wizard straight to a step, skipping the forms in between. Use to test a late step without driving the whole flow.',
    input: z.object({ step: z.enum(STEPS) }),
    handler: ({ step: next }) => {
      setStep(next)
      return { step: next }
    },
  })

  useGenieTool({
    name: 'apply_coupon',
    group: 'checkout',
    kind: 'action',
    description:
      'Applies a coupon code to the order like the payment-step form would. Unknown codes fail with the valid demo codes listed.',
    input: z.object({ code: z.string().min(1) }),
    handler: ({ code }) => applyCoupon(code),
  })

  const stepIndex = STEPS.indexOf(step)

  return (
    <main style={{ padding: '2rem', maxWidth: 480 }}>
      <h1>Checkout</h1>
      <p data-testid="wizard-step">
        step {stepIndex + 1}/{STEPS.length}: <strong>{step}</strong>
      </p>

      {step === 'cart' && <p>1 × mechanical keyboard — ${CART_TOTAL}</p>}
      {step === 'shipping' && <p>shipping form goes here</p>}
      {step === 'payment' && (
        <p>
          <input
            placeholder="coupon code"
            value={couponInput}
            onChange={(event) => setCouponInput(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              try {
                applyCoupon(couponInput)
              } catch {
                setCoupon(null)
              }
            }}
          >
            apply
          </button>
        </p>
      )}
      {step === 'done' && <p>order placed 🎉</p>}

      <p data-testid="order-total">
        total: <strong>${total}</strong>
        {coupon && ` (${coupon} −$${discount})`}
      </p>

      <p>
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStep(STEPS[stepIndex - 1] ?? 'cart')}
        >
          back
        </button>{' '}
        <button
          type="button"
          disabled={stepIndex === STEPS.length - 1}
          onClick={() => setStep(STEPS[stepIndex + 1] ?? 'done')}
        >
          next
        </button>
      </p>
      <Link to="/">← home</Link>
    </main>
  )
}
