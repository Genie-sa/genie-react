import { Genie } from 'genie-react'
import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'

import '../styles.css'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <nav className="flex gap-4 p-4">
        <Link data-testid="nav-home" to="/">
          Home
        </Link>
        <Link data-testid="nav-suspense" to="/suspense">
          Suspense
        </Link>
        <Link data-testid="nav-error" to="/error">
          Error
        </Link>
      </nav>
      <><Outlet />{import.meta.env.DEV && <Genie plugins={['lab-bus']} />}</>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}
