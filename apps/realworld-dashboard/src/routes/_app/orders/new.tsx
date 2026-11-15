import { createFileRoute } from '@tanstack/react-router'
import { CreateOrderPage } from '../../../features/orders/create-order-page'

export const Route = createFileRoute('/_app/orders/new')({
  component: CreateOrderPage,
})
