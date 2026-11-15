import { channel } from 'node:diagnostics_channel'

/** Milestones of one CLI process, in order; `scripts/cli-probe.mjs` subscribes to time them, and nothing is published while no one listens. */
export type CliPhase =
  | 'cli:start'
  | 'cli:parsed'
  | 'connect:start'
  | 'token:start'
  | 'token:end'
  | 'connect:resolved'
  | 'socket:open'
  | 'hub:ready'
  | 'call:sent'
  | 'call:answered'

const phases = channel('genie-react:cli-phase')

export function markPhase(phase: CliPhase): void {
  if (phases.hasSubscribers) phases.publish(phase)
}
