import Link from 'next/link'
import type { ReactNode } from 'react'
import { currentUser } from '../../lib/server/session'

export async function AccountLink(): Promise<ReactNode> {
  const user = await currentUser()
  return (
    <Link href={user ? '/account' : '/login'} className="account-link">
      {user ? user.name.split(' ')[0] : 'Sign in'}
    </Link>
  )
}
