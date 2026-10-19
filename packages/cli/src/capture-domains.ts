import type { CaptureDomain as ProtocolCaptureDomain } from 'genie-react/protocol'

/** Mirrors the protocol's capture domains so help and argument parsing avoid loading its schemas; capture-domains.test.ts guards drift. */
export const CAPTURE_DOMAINS = [
  'react',
  'effects',
  'query',
  'router',
  'memory',
  'performance',
] as const satisfies readonly ProtocolCaptureDomain[]

export type CaptureDomain = (typeof CAPTURE_DOMAINS)[number]
