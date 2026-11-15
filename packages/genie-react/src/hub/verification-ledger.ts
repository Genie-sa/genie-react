import { createHash } from 'node:crypto'
import type { Verdict, VerificationLedgerView, VerifyClaim } from '../protocol'

export interface LedgerEntry {
  verificationId: string
  fingerprint: string
  /** Rerun history is kept per tab: the logical session ID, or the physical one for legacy apps. */
  scope: string
  verdict: Verdict
  reasons: string[]
  endedAt: string
  sessionId: string
  documentGeneration: number | null
  /** Fast Refresh sequence at begin and at end; a difference between runs means code changed. */
  refreshSequenceAtBegin: number | null
  refreshSequenceAtEnd: number | null
}

/** Where rerun history lives. Phase 1 keeps it in hub memory; a file store under the private runtime directory implements the same contract. */
export interface VerificationLedger {
  readonly storage: VerificationLedgerView['storage']
  append(entry: LedgerEntry): void
  history(scope: string, fingerprint: string): readonly LedgerEntry[]
}

const MAX_LEDGER_ENTRIES = 500

export class InMemoryVerificationLedger implements VerificationLedger {
  readonly storage = 'memory' as const
  private readonly entries: LedgerEntry[] = []

  append(entry: LedgerEntry): void {
    this.entries.push(entry)
    if (this.entries.length > MAX_LEDGER_ENTRIES) this.entries.shift()
  }

  history(scope: string, fingerprint: string): readonly LedgerEntry[] {
    return this.entries.filter(
      (entry) => entry.scope === scope && entry.fingerprint === fingerprint,
    )
  }
}

/** The claims, the sources they resolved to, and the page they ran on; the free-text name is left out so renaming a run keeps its history. */
export function claimFingerprint(input: {
  claims: readonly VerifyClaim[]
  targetSources: readonly (string | null)[]
  url: string | undefined
}): string {
  const page = pageOf(input.url)
  const canonical = JSON.stringify([input.claims.map(canonicalize), input.targetSources, page])
  return `cf_${createHash('sha256').update(canonical).digest('hex').slice(0, 12)}`
}

function pageOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return null
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

/** How this run relates to earlier runs of the same claims on the same tab. */
export function ledgerView(
  ledger: VerificationLedger,
  current: Omit<LedgerEntry, 'verdict' | 'reasons' | 'endedAt'>,
): VerificationLedgerView {
  const history = ledger
    .history(current.scope, current.fingerprint)
    .filter((entry) => entry.verificationId !== current.verificationId)
  const previous = history.at(-1)
  let failsOnSameCode = 0
  let boundary: LedgerEntry = { ...current, verdict: 'pass', reasons: [], endedAt: '' }
  for (const entry of [...history].reverse()) {
    if (codeChangeBetween(entry, boundary) !== 'none-observed') break
    if (entry.verdict === 'fail') failsOnSameCode += 1
    boundary = entry
  }
  return {
    fingerprint: current.fingerprint,
    scope: 'logical-session',
    storage: ledger.storage,
    attempt: history.length + 1,
    history: history.map(({ verificationId, verdict, reasons, endedAt }) => ({
      verificationId,
      verdict,
      reasons,
      endedAt,
    })),
    codeChangedSincePrevious: previous ? codeChangeBetween(previous, current) : null,
    failsOnSameCode,
  }
}

function codeChangeBetween(
  earlier: Pick<LedgerEntry, 'sessionId' | 'documentGeneration' | 'refreshSequenceAtEnd'>,
  later: Pick<LedgerEntry, 'sessionId' | 'documentGeneration' | 'refreshSequenceAtBegin'>,
): VerificationLedgerView['codeChangedSincePrevious'] {
  if (
    earlier.sessionId !== later.sessionId ||
    earlier.documentGeneration !== later.documentGeneration
  )
    return 'document-reloaded'
  if (earlier.refreshSequenceAtEnd === null || later.refreshSequenceAtBegin === null)
    return 'none-observed'
  return later.refreshSequenceAtBegin > earlier.refreshSequenceAtEnd
    ? 'fast-refresh'
    : 'none-observed'
}
