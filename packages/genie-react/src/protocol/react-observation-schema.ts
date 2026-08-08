import { z } from 'zod'

export const DEFAULT_RENDER_OBSERVATION_BUDGET = {
  fiberLimit: 250,
  operationLimit: 20_000,
  timeLimitMs: 8,
  targetOperationReserve: 4_000,
  targetTimeReserveMs: 4,
  adaptive: true,
} as const

export const renderObservationBudgetInputSchema = z
  .object({
    fiberLimit: z.number().int().min(50).max(20_000).default(250),
    operationLimit: z.number().int().min(1_000).max(2_000_000).default(20_000),
    timeLimitMs: z.number().min(1).max(500).default(8),
    targetOperationReserve: z.number().int().min(100).max(500_000).default(4_000),
    targetTimeReserveMs: z.number().min(0.5).max(250).default(4),
    adaptive: z.boolean().default(true),
  })
  .default(DEFAULT_RENDER_OBSERVATION_BUDGET)
