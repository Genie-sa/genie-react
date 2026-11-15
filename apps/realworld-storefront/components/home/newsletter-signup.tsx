'use client'

import { type ReactNode, useActionState } from 'react'
import { type NewsletterState, subscribe } from '../../lib/actions/newsletter'

const INITIAL_STATE: NewsletterState = { status: 'idle', message: '' }

export function NewsletterSignup(): ReactNode {
  const [state, formAction, isPending] = useActionState(subscribe, INITIAL_STATE)
  return (
    <section className="newsletter">
      <h2>One letter a month</h2>
      <p className="muted">New runs, repair stories and early access to restocks.</p>
      {state.status === 'subscribed' ? (
        <p role="status">{state.message}</p>
      ) : (
        <form action={formAction} className="inline-form">
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            aria-label="Email"
          />
          <button type="submit" className="button" disabled={isPending}>
            {isPending ? 'Subscribing…' : 'Subscribe'}
          </button>
          {state.status === 'invalid' ? <p role="alert">{state.message}</p> : null}
        </form>
      )}
    </section>
  )
}
