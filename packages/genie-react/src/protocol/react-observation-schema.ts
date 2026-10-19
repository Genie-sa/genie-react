import { z } from 'zod'

export const DEFAULT_RENDER_OBSERVATION_BUDGET = {
  fiberLimit: 250,
  operationLimit: 20_000,
  timeLimitMs: 8,
  targetOperationReserve: 4_000,
  targetTimeReserveMs: 4,
  adaptive: true,
} as const

export const MAXIMUM_RENDER_OBSERVATION_BUDGET = {
  fiberLimit: 20_000,
  operationLimit: 2_000_000,
  timeLimitMs: 500,
  targetOperationReserve: 500_000,
  targetTimeReserveMs: 250,
} as const

const maximum = MAXIMUM_RENDER_OBSERVATION_BUDGET

export const renderObservationBudgetInputSchema = z
  .object({
    fiberLimit: z.number().int().min(50).max(maximum.fiberLimit).default(250),
    operationLimit: z.number().int().min(1_000).max(maximum.operationLimit).default(20_000),
    timeLimitMs: z.number().min(1).max(maximum.timeLimitMs).default(8),
    targetOperationReserve: z
      .number()
      .int()
      .min(100)
      .max(maximum.targetOperationReserve)
      .default(4_000),
    targetTimeReserveMs: z.number().min(0.5).max(maximum.targetTimeReserveMs).default(4),
    adaptive: z.boolean().default(true),
  })
  .default(DEFAULT_RENDER_OBSERVATION_BUDGET)
