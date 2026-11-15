import { z } from 'zod'
import { CUSTOMER_TIERS, type CustomerTier } from '../../api/types'

export const CUSTOMERS_PAGE_SIZE = 25

export const customersSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  q: z.string().max(80).default('').catch(''),
  tier: z
    .enum(CUSTOMER_TIERS as [CustomerTier, ...CustomerTier[]])
    .optional()
    .catch(undefined),
})
