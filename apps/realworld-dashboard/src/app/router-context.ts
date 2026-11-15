import type { QueryClient } from '@tanstack/react-query'
import type { AuthContextValue } from './auth'

export interface RouterContext {
  queryClient: QueryClient
  auth: AuthContextValue
}
