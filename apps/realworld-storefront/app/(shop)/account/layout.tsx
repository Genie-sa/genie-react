import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AccountNav } from '../../../components/account/account-nav'
import { SignOutButton } from '../../../components/account/sign-out-button'
import { currentUser } from '../../../lib/server/session'

export default async function AccountLayout({
  children,
}: {
  children: ReactNode
}): Promise<ReactNode> {
  const user = await currentUser()
  if (!user) redirect('/login?next=/account')
  return (
    <div className="account">
      <aside>
        <p>
          Signed in as <strong>{user.name}</strong>
        </p>
        <AccountNav />
        <SignOutButton />
      </aside>
      <div>{children}</div>
    </div>
  )
}
