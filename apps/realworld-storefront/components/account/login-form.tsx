'use client'

import { type ReactNode, useActionState } from 'react'
import { type SignInState, signIn } from '../../lib/actions/auth'

export function LoginForm({ next }: { next: string }): ReactNode {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(signIn, {
    error: null,
    email: '',
  })
  return (
    <form action={formAction} className="login-form">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" defaultValue={state.email} required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="button button-wide" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="muted">Demo account: ava@example.test / storefront</p>
    </form>
  )
}
