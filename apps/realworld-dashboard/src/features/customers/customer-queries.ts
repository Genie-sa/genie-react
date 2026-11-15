import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CustomerListParams } from '../../api/endpoints'
import { api } from '../../api/endpoints'
import type { CustomerUpdate } from '../../api/types'
import { toast } from '../../app/toasts'

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  orders: (id: string) => [...customerKeys.detail(id), 'orders'] as const,
}

export const customersListQuery = (params: CustomerListParams) =>
  queryOptions({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => api.customers(params, signal),
  })

export const customerQuery = (id: string) =>
  queryOptions({
    queryKey: customerKeys.detail(id),
    queryFn: ({ signal }) => api.customer(id, signal),
  })

export const customerOrdersQuery = (id: string) =>
  queryOptions({
    queryKey: customerKeys.orders(id),
    queryFn: ({ signal }) => api.customerOrders(id, signal),
  })

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: CustomerUpdate }) =>
      api.updateCustomer(id, update),
    onSuccess: (customer) => {
      void queryClient.invalidateQueries({ queryKey: ['customers', customer.id] })
      toast.success(`${customer.name} saved`)
    },
    onError: (error) => toast.error('Could not save customer', error.message),
  })
}
