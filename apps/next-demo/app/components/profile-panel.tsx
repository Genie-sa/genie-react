'use client'

import { memo, useState } from 'react'

interface Profile {
  name: string
  theme: string
}

const ProfileCard = memo(function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <p data-testid="profile">
      {profile.name} · {profile.theme} theme
    </p>
  )
})

export function ProfilePanel() {
  const [refreshes, setRefreshes] = useState(0)
  return (
    <section>
      <h2>Profile</h2>
      {/* Inline object prop is intentionally unstable so Genie's render tracker flags it. */}
      <ProfileCard profile={{ name: 'Ada Lovelace', theme: 'dark' }} />
      <p>Refreshed {refreshes} times</p>
      <button type="button" onClick={() => setRefreshes((value) => value + 1)}>
        Refresh profile
      </button>
    </section>
  )
}
