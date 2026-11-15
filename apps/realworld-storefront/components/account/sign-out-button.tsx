import type { ReactNode } from 'react'
import { signOut } from '../../lib/actions/auth'

export function SignOutButton(): ReactNode {
  return (
    <form action={signOut}>
      <button type="submit" className="link-button">
        Sign out
      </button>
    </form>
  )
}
