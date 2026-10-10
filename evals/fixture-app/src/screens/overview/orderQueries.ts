import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'

export function useOpenOrderCount() {
  return useQuery({
    queryKey: ['orders', 'open-count'],
    queryFn: api.openOrderCount,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
