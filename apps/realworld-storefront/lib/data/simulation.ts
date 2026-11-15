import { OPERATION_LATENCY_MS, type Operation } from '../dev-contract'
import { storeState } from './state'

export type { Operation }

export interface FaultRule {
  mode: 'fail' | 'slow'
  latencyMs: number | null
  remaining: number | null
}

export class SimulatedFailure extends Error {
  constructor(readonly operation: Operation) {
    super(`${operation} is unavailable right now`)
    this.name = 'SimulatedFailure'
  }
}

function latencyScale(): number {
  const raw = Number(process.env.STOREFRONT_LATENCY_SCALE ?? '1')
  return Number.isFinite(raw) && raw >= 0 ? raw : 1
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function consumeFault(operation: Operation): FaultRule | null {
  const { faults } = storeState()
  const rule = faults.get(operation)
  if (!rule) return null
  if (rule.remaining !== null) {
    if (rule.remaining <= 1) faults.delete(operation)
    else faults.set(operation, { ...rule, remaining: rule.remaining - 1 })
  }
  return rule
}

export async function simulate(operation: Operation, baseLatencyMs?: number): Promise<void> {
  const fault = consumeFault(operation)
  const latency =
    fault?.mode === 'slow' && fault.latencyMs !== null
      ? fault.latencyMs
      : (baseLatencyMs ?? OPERATION_LATENCY_MS[operation]) * latencyScale()
  await wait(latency)
  if (fault?.mode === 'fail') throw new SimulatedFailure(operation)
}

export function setFault(operation: Operation, rule: FaultRule): void {
  storeState().faults.set(operation, rule)
}

export function clearFault(operation: Operation): void {
  storeState().faults.delete(operation)
}

export function listFaults(): Array<FaultRule & { operation: Operation }> {
  return [...storeState().faults].map(([operation, rule]) => ({ operation, ...rule }))
}
