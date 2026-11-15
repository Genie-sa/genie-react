import { z } from 'zod'

export const inventorySearchSchema = z.object({
  q: z.string().max(80).default('').catch(''),
  low: z.boolean().default(false).catch(false),
  page: z.number().int().min(1).default(1).catch(1),
})
