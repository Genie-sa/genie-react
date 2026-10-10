import { useQuery } from '@tanstack/react-query'
import { api, type Profile } from '../../api'

function formatLocation(profile: Profile): string {
  const address = profile.address as NonNullable<Profile['address']>
  return `${address.city}, ${address.country}`
}

export function ProfileDetails() {
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: api.profile })
  if (!profile) return <p>Loading profile…</p>
  return (
    <dl>
      <dt>Name</dt>
      <dd>{profile.name}</dd>
      <dt>Email</dt>
      <dd>{profile.email}</dd>
      <dt>Location</dt>
      <dd>{formatLocation(profile)}</dd>
    </dl>
  )
}
