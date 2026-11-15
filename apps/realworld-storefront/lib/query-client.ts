import { isServer, QueryClient } from '@tanstack/react-query'

const ONE_MINUTE_MS = 60_000

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: ONE_MINUTE_MS, retry: 1 } },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (isServer) return createQueryClient()
  browserQueryClient ??= createQueryClient()
  return browserQueryClient
}
