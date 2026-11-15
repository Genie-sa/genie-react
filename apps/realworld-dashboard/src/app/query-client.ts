import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'

const MAX_RETRIES = 2

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < MAX_RETRIES,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export const referenceDataOptions = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
} as const

export const queryClient = createQueryClient()
