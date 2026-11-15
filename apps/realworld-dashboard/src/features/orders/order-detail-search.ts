import { z } from 'zod'

export const ORDER_DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'items', label: 'Items' },
  { id: 'shipments', label: 'Shipments' },
  { id: 'activity', label: 'Activity' },
] as const

export type OrderDetailTab = (typeof ORDER_DETAIL_TABS)[number]['id']

export const orderDetailSearchSchema = z.object({
  tab: z.enum(['overview', 'items', 'shipments', 'activity']).default('overview').catch('overview'),
})
