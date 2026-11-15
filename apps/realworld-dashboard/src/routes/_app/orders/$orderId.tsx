import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '../../../components/route-feedback'
import { OrderDetailPage } from '../../../features/orders/order-detail-page'
import { orderDetailSearchSchema } from '../../../features/orders/order-detail-search'
import { orderQuery, orderShipmentsQuery } from '../../../features/orders/order-queries'

export const Route = createFileRoute('/_app/orders/$orderId')({
  validateSearch: orderDetailSearchSchema,
  loader: async ({ context: { queryClient }, params: { orderId } }) => {
    await queryClient.ensureQueryData(orderQuery(orderId))
    await queryClient.ensureQueryData(orderShipmentsQuery(orderId))
  },
  errorComponent: RouteError,
  component: OrderDetailPage,
})
