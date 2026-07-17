import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

export const auditQueryKey = ['expo-tool-audit'] as const

export interface AuditQueryData {
  label: string
  revision: number
}

export const auditQueryData: AuditQueryData = {
  label: 'server-value',
  revision: 1,
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 30 * 60 * 1000,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
    mutations: { retry: false },
  },
})

queryClient.setQueryDefaults(auditQueryKey, {
  queryFn: async () => auditQueryData,
})

const rootRoute = createRootRoute()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: () => ({ page: 'home' }),
})

const detailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/details',
  loader: () => ({ page: 'details' }),
})

const routeTree = rootRoute.addChildren([indexRoute, detailsRoute])

export const router = createRouter({
  history: createMemoryHistory({ initialEntries: ['/'] }),
  routeTree,
})

router.history.subscribe(() => {
  void router.load()
})

void router.load()
