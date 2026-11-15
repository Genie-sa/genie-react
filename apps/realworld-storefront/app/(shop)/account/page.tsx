import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Price } from '../../../components/ui/price'
import { getAccountProfile } from '../../../lib/data/accounts'
import { formatDate } from '../../../lib/locale'
import { currentLocale, currentUser } from '../../../lib/server/session'

export const metadata: Metadata = { title: 'Account' }

export default async function AccountPage(): Promise<ReactNode> {
  const user = await currentUser()
  if (!user) redirect('/login?next=/account')
  const [profile, locale] = await Promise.all([getAccountProfile(user.id), currentLocale()])
  if (!profile) redirect('/login?next=/account')
  return (
    <section>
      <h1>Hello, {user.name.split(' ')[0]}</h1>
      <dl className="account-stats">
        <div>
          <dt>Member since</dt>
          <dd>{formatDate(profile.user.memberSince, locale)}</dd>
        </div>
        <div>
          <dt>Membership</dt>
          <dd>{profile.user.tier === 'plus' ? 'Fernhill Plus' : 'Standard'}</dd>
        </div>
        <div>
          <dt>Orders</dt>
          <dd>{profile.orderCount}</dd>
        </div>
        <div>
          <dt>Lifetime spend</dt>
          <dd>
            <Price cents={profile.lifetimeCents} />
          </dd>
        </div>
      </dl>
    </section>
  )
}
