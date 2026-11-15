import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { OrderListParams } from '../../api/endpoints'
import { api } from '../../api/endpoints'
import type {
  BulkOrderAction,
  ListResult,
  NewOrder,
  Order,
  OrderStatus,
  OrderSummary,
  OrderUpdate,
} from '../../api/types'
import { toast } from '../../app/toasts'

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params: OrderListParams) => [...orderKeys.lists(), params] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  shipments: (id: string) => [...orderKeys.detail(id), 'shipments'] as const,
  activity: (id: string) => [...orderKeys.detail(id), 'activity'] as const,
}

export const ordersListQuery = (params: OrderListParams) =>
  queryOptions({
    queryKey: orderKeys.list(params),
    queryFn: ({ signal }) => api.orders(params, signal),
  })

export const orderQuery = (id: string) =>
  queryOptions({ queryKey: orderKeys.detail(id), queryFn: ({ signal }) => api.order(id, signal) })

export const orderShipmentsQuery = (id: string) =>
  queryOptions({
    queryKey: orderKeys.shipments(id),
    queryFn: ({ signal }) => api.orderShipments(id, signal),
  })

export const orderActivityQuery = (id: string) =>
  queryOptions({
    queryKey: orderKeys.activity(id),
    queryFn: ({ signal }) => api.orderActivity(id, signal),
  })

type OrderList = ListResult<OrderSummary>

function toSummary(order: Order): OrderSummary {
  const {
    carrierId: _carrierId,
    lines: _lines,
    shippingAddress: _address,
    notes: _notes,
    ...summary
  } = order
  return summary
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; number: string; status: OrderStatus }) =>
      api.updateOrder(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.lists() })
      const previous = queryClient.getQueriesData<OrderList>({ queryKey: orderKeys.lists() })
      queryClient.setQueriesData<OrderList>(
        { queryKey: orderKeys.lists() },
        (current) =>
          current && {
            ...current,
            items: current.items.map((item) => (item.id === id ? { ...item, status } : item)),
          },
      )
      return { previous }
    },
    onError: (error, { number }) => {
      toast.error(`Could not update ${number}`, error.message)
    },
    onSuccess: (order) => {
      const summary = toSummary(order)
      queryClient.setQueriesData<OrderList>(
        { queryKey: orderKeys.lists() },
        (current) =>
          current && {
            ...current,
            items: current.items.map((item) => (item.id === order.id ? summary : item)),
          },
      )
      queryClient.setQueryData(orderKeys.detail(order.id), order)
      toast.success(`${order.number} updated`)
    },
  })
}

export function useUpdateOrder(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (update: OrderUpdate) => api.updateOrder(id, update),
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.detail(id), exact: true })
      const previous = queryClient.getQueryData<Order>(orderKeys.detail(id))
      if (previous)
        queryClient.setQueryData<Order>(orderKeys.detail(id), { ...previous, ...update })
      return { previous }
    },
    onError: (error, _update, context) => {
      if (context?.previous) queryClient.setQueryData(orderKeys.detail(id), context.previous)
      toast.error('Could not save order', error.message)
    },
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(id), order)
      toast.success(`${order.number} saved`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: orderKeys.lists() }),
  })
}

export function useBulkOrderAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkOrderAction }) =>
      api.bulkUpdateOrders(ids, action),
    onSuccess: ({ updated, skipped }) => {
      toast.success(
        `${updated} orders updated`,
        skipped > 0 ? `${skipped} skipped because they are closed` : undefined,
      )
    },
    onError: (error) => toast.error('Bulk update failed', error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: NewOrder) => api.createOrder(order),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order)
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      toast.success(`${order.number} created`)
    },
    onError: (error) => toast.error('Could not create order', error.message),
  })
}
