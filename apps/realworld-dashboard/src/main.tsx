import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from './app/auth'
import { queryClient } from './app/query-client'
import { RouteError } from './components/route-feedback'
import { routeTree } from './routeTree.gen'
import './styles.css'

const router = createRouter({
  routeTree,
  context: { queryClient, auth: undefined! },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: RouteError,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  const auth = useAuth()
  useEffect(() => {
    void router.invalidate()
  }, [auth.session])
  return <RouterProvider router={router} context={{ auth }} />
}

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
