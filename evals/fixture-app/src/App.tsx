import type { ComponentType } from 'react'
import { AccountScreen } from './screens/account/AccountScreen'
import { CartScreen } from './screens/cart/CartScreen'
import { DashboardScreen } from './screens/dashboard/DashboardScreen'
import { OverviewScreen } from './screens/overview/OverviewScreen'
import { ReportsScreen } from './screens/reports/ReportsScreen'
import { SearchScreen } from './screens/search/SearchScreen'
import { TasksScreen } from './screens/tasks/TasksScreen'

const screens: Record<string, { title: string; Screen: ComponentType }> = {
  search: { title: 'Search', Screen: SearchScreen },
  dashboard: { title: 'Dashboard', Screen: DashboardScreen },
  reports: { title: 'Reports', Screen: ReportsScreen },
  tasks: { title: 'Tasks', Screen: TasksScreen },
  overview: { title: 'Overview', Screen: OverviewScreen },
  account: { title: 'Account', Screen: AccountScreen },
  cart: { title: 'Cart', Screen: CartScreen },
}

function currentScreen(): string {
  const requested = new URLSearchParams(window.location.search).get('screen')
  return requested && requested in screens ? requested : 'search'
}

export function App() {
  const active = currentScreen()
  const { Screen } = screens[active] ?? screens.search

  return (
    <div className="shell">
      <nav className="nav" aria-label="Screens">
        {Object.entries(screens).map(([key, { title }]) => (
          <a key={key} href={`?screen=${key}`} aria-current={key === active ? 'page' : undefined}>
            {title}
          </a>
        ))}
      </nav>
      <main className="content">
        <Screen />
      </main>
    </div>
  )
}
