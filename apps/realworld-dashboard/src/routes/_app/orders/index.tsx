import { createFileRoute } from '@tanstack/react-router'
import { ordersSearchSchema } from '../../../features/orders/order-filters'
import { ordersListQuery } from '../../../features/orders/order-queries'
import { OrdersPage } from '../../../features/orders/orders-page'

export const Route = createFileRoute('/_app/orders/')({
  validateSearch: ordersSearchSchema,
  loaderDeps: ({ search }) => ({ status: search.status, region: search.region }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(ordersListQuery(deps)),
  component: OrdersPage,
})
