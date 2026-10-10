import { CardBody } from './CardBody'
import { ProfileDetails } from './ProfileDetails'

export function AccountScreen() {
  return (
    <section>
      <h1>Account</h1>
      <article className="card" aria-label="Profile">
        <h2>Profile</h2>
        <CardBody>
          <ProfileDetails />
        </CardBody>
      </article>
      <article className="card">
        <h2>Security</h2>
        <p>Two-factor authentication is enabled.</p>
      </article>
    </section>
  )
}
