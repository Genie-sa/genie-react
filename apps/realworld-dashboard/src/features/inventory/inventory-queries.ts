import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/endpoints'
import type { StockAdjustment } from '../../api/types'
import { toast } from '../../app/toasts'

export const inventoryKeys = {
  all: ['inventory'] as const,
  list: (params: { q?: string; low?: boolean }) => [...inventoryKeys.all, 'list', params] as const,
}

export const inventoryQuery = (params: { q?: string; low?: boolean }) =>
  queryOptions({
    queryKey: inventoryKeys.list(params),
    queryFn: ({ signal }) => api.inventory(params, signal),
  })

export function useAdjustStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, adjustment }: { productId: string; adjustment: StockAdjustment }) =>
      api.adjustStock(productId, adjustment),
    onSuccess: (level) => {
      toast.success(`${level.sku} adjusted`, `${level.totalOnHand} units on hand`)
      return queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
    onError: (error) => toast.error('Stock adjustment failed', error.message),
  })
}
