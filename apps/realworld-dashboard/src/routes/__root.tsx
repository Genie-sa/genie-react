import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Genie } from 'genie-react'
import type { RouterContext } from '../app/router-context'
import { NotFound } from '../components/route-feedback'
import { Toaster } from '../components/toaster'
import { DashboardDevTools, dashboardDevTools } from '../dev/genie-tools'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
      {import.meta.env.DEV && <Genie appName="Meridian Ops" tools={dashboardDevTools} />}
      {import.meta.env.DEV && <DashboardDevTools />}
    </>
  )
}
