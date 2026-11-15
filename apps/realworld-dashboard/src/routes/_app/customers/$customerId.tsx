import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '../../../components/route-feedback'
import { CustomerDetailPage } from '../../../features/customers/customer-detail-page'
import { customerQuery } from '../../../features/customers/customer-queries'

export const Route = createFileRoute('/_app/customers/$customerId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(customerQuery(params.customerId)),
  errorComponent: RouteError,
  component: CustomerDetailPage,
})
