import type { ReactNode } from 'react'

export const CHECKOUT_STEPS = ['Contact', 'Delivery', 'Payment', 'Review'] as const

export function CheckoutProgress({ current }: { current: number }): ReactNode {
  return (
    <ol className="checkout-progress" aria-label="Checkout steps">
      {CHECKOUT_STEPS.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? 'step' : undefined}
          data-complete={index < current ? '' : undefined}
        >
          {step}
        </li>
      ))}
    </ol>
  )
}
