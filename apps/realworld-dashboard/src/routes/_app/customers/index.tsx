import { createFileRoute } from '@tanstack/react-router'
import { customersListQuery } from '../../../features/customers/customer-queries'
import { CustomersPage } from '../../../features/customers/customers-page'
import {
  CUSTOMERS_PAGE_SIZE,
  customersSearchSchema,
} from '../../../features/customers/customers-search'

export const Route = createFileRoute('/_app/customers/')({
  validateSearch: customersSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      customersListQuery({ ...deps, pageSize: CUSTOMERS_PAGE_SIZE }),
    ),
  component: CustomersPage,
})
