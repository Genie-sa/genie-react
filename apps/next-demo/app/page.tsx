import { Counter } from './components/counter'
import { EffectDemo } from './components/effect-demo'
import { ItemList } from './components/item-list'
import { ProfilePanel } from './components/profile-panel'

export default function Home() {
  return (
    <main>
      <h1>Genie Next.js Demo</h1>
      <Counter />
      <EffectDemo />
      <ItemList />
      <ProfilePanel />
    </main>
  )
}
