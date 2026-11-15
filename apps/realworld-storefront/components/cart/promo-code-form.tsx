'use client'

import { type ReactNode, useActionState } from 'react'
import { applyPromo, type PromoFormState } from '../../lib/actions/cart'

const INITIAL_STATE: PromoFormState = { status: 'idle', message: '' }

export function PromoCodeForm({ appliedCode }: { appliedCode: string | null }): ReactNode {
  const [state, formAction, isPending] = useActionState(applyPromo, INITIAL_STATE)
  return (
    <form action={formAction} className="inline-form promo-form">
      <label htmlFor="promo-code" className="visually-hidden">
        Promo code
      </label>
      <input
        id="promo-code"
        name="code"
        placeholder={appliedCode ?? 'Promo code'}
        autoComplete="off"
      />
      <button type="submit" className="button button-ghost" disabled={isPending}>
        {isPending ? 'Checking…' : 'Apply'}
      </button>
      {state.message ? (
        <p role={state.status === 'rejected' ? 'alert' : 'status'}>{state.message}</p>
      ) : null}
    </form>
  )
}
