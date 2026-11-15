import {
  DEFAULT_RENDER_OBSERVATION_BUDGET,
  formatVerifyClaim,
  type VerifyClaim,
  type VerifyFix,
} from 'genie-react/protocol'
import { isRecord } from './guards'
import { genieCommand } from './package-manager'
import {
  blockLines,
  encodeText,
  FieldReader,
  fieldLines,
  flowText,
  proseText,
  quoteString,
  scalarText,
} from './text-output'

export interface Command {
  command: string
  argv: string[]
}

const SAFE_SESSION = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/
const VERIFICATION_ID = /^vfy_[0-9a-f-]{36}$/
const COMPONENT = /^[^\s@[\]#,'"`$\\]{1,160}$/

/** Fixed sentences for the caveats every verdict can carry; codes the CLI does not know print as bare words. */
const CAVEAT_TEXT: Record<string, string> = {
  'ui-outcome-not-observed':
    'Genie does not check what the user sees; confirm the visible result with the UI driver',
  'passed-after-failures-on-same-code':
    'this claim failed earlier on the same code; a pass after retries may be flaky',
  'overrides-active': 'overrides or simulated Query state were active during the window',
  'visibility-unobserved':
    'the app reports no visibility signal, so a hidden interval was not observed',
  'not-settled': 'the app did not settle within the timeout',
}

function sessionFlags(session: string | undefined): string[] {
  return session !== undefined && SAFE_SESSION.test(session) ? ['--session', session] : []
}

export function showCommand(
  verificationId: string,
  session: string | undefined,
  claim?: number,
): Command | undefined {
  if (!VERIFICATION_ID.test(verificationId)) return undefined
  return genieCommand([
    'verify',
    'show',
    verificationId,
    ...(claim === undefined ? [] : ['--claim', String(claim)]),
    ...sessionFlags(session),
  ])
}

export function endCommand(
  verificationId: string,
  session: string | undefined,
): Command | undefined {
  if (!VERIFICATION_ID.test(verificationId)) return undefined
  return genieCommand(['verify', 'end', verificationId, ...sessionFlags(session)])
}

interface StoredRequest {
  claims: VerifyClaim[]
  budget?: Record<string, unknown>
  settle?: { quietMs?: number; timeoutMs?: number; domains?: string[] }
  tailMs?: number
  maxDurationMs?: number
  allowOverrides?: boolean
}

function storedRequest(document: Record<string, unknown>): StoredRequest | null {
  const request = document.request
  if (!isRecord(request) || !Array.isArray(request.claims)) return null
  return request as unknown as StoredRequest
}

function budgetFlag(
  budget: Record<string, unknown> | undefined,
  extra: Record<string, number> = {},
): string[] {
  const merged = { ...(budget ?? {}), ...extra }
  const changed = Object.fromEntries(
    Object.entries(merged).filter(
      ([key, value]) =>
        (typeof value === 'number' || typeof value === 'boolean') &&
        DEFAULT_RENDER_OBSERVATION_BUDGET[key as keyof typeof DEFAULT_RENDER_OBSERVATION_BUDGET] !==
          value,
    ),
  )
  return Object.keys(changed).length === 0 ? [] : ['--budget', JSON.stringify(changed)]
}

/** The `verify begin` that repeats a verification with the fix applied: same name, claims and options, rebuilt from the stored request. */
export function beginAgainCommand(
  document: Record<string, unknown>,
  session: string | undefined,
  fix?: Pick<VerifyFix, 'budget' | 'settle'>,
): Command | undefined {
  const request = storedRequest(document)
  const name = typeof document.name === 'string' ? document.name : undefined
  if (!request || name === undefined) return undefined
  const quietMs = fix?.settle?.quietMs ?? request.settle?.quietMs
  const timeoutMs = fix?.settle?.timeoutMs ?? request.settle?.timeoutMs
  return genieCommand([
    'verify',
    'begin',
    ...sessionFlags(session),
    '--name',
    name,
    ...request.claims.flatMap((claim) => ['--claim', formatVerifyClaim(claim)]),
    ...budgetFlag(request.budget, fix?.budget),
    ...(quietMs !== undefined && quietMs !== 500 ? ['--quiet-ms', String(quietMs)] : []),
    ...(timeoutMs !== undefined && timeoutMs !== 10_000 ? ['--timeout-ms', String(timeoutMs)] : []),
    ...(request.settle?.domains ? ['--domains', request.settle.domains.join(',')] : []),
    ...(request.tailMs === undefined ? [] : ['--tail-ms', String(request.tailMs)]),
    ...(request.maxDurationMs !== undefined && request.maxDurationMs !== 300_000
      ? ['--max-duration', String(request.maxDurationMs)]
      : []),
    ...(request.allowOverrides ? ['--allow-overrides'] : []),
  ])
}

/** The runnable step that applies a refusal's fix; null when the fix is to rethink the claim. */
export function fixCommand(
  fix: VerifyFix,
  document: Record<string, unknown>,
  session: string | undefined,
): Command | undefined {
  const flags = sessionFlags(session)
  const component =
    fix.component !== undefined && COMPONENT.test(fix.component) ? fix.component : undefined
  switch (fix.action) {
    case 'begin-again':
    case 'drive-observed-tab':
      return beginAgainCommand(document, session, fix)
    case 'find-target':
      return component
        ? genieCommand([
            'call',
            'react_find_components',
            JSON.stringify({ query: component }),
            ...flags,
          ])
        : undefined
    case 'list-target-sources':
      return component
        ? genieCommand([
            'call',
            'react_component_cohort',
            JSON.stringify({ component, exact: true, appOnly: false }),
            ...flags,
          ])
        : undefined
    case 'reset-overrides':
      return genieCommand(['call', 'react_reset_overrides', '{}', ...flags])
    case 'check-setup':
      return genieCommand(['doctor', '--live', ...flags])
    case 'change-claim':
      return undefined
  }
}

/** The verdict document with the CLI-built commands: each refusal's fix and the evidence handle. */
export function withNextCommands(document: unknown, session: string | undefined): unknown {
  if (!isRecord(document) || typeof document.verificationId !== 'string') return document
  const id = document.verificationId
  const withFix = (refusal: unknown) => {
    if (!isRecord(refusal) || !isRecord(refusal.fix)) return refusal
    const next = fixCommand(refusal.fix as VerifyFix, document, session)
    return next ? { ...refusal, next } : refusal
  }
  const claims = Array.isArray(document.claims)
    ? document.claims.map((claim) =>
        isRecord(claim) && claim.refusal ? { ...claim, refusal: withFix(claim.refusal) } : claim,
      )
    : document.claims
  const window = isRecord(document.window)
    ? {
        ...document.window,
        ...(Array.isArray(document.window.refusals)
          ? {
              refusals: document.window.refusals.map((entry) =>
                isRecord(entry) ? { ...entry, refusal: withFix(entry.refusal) } : entry,
              ),
            }
          : {}),
      }
    : document.window
  const next =
    document.state === 'recording'
      ? endCommand(id, session)
      : document.state === 'completed'
        ? showCommand(id, session, firstNotPassing(claims))
        : undefined
  return {
    ...document,
    ...(document.window === undefined ? {} : { window }),
    ...(document.claims === undefined ? {} : { claims }),
    ...(next ? { next } : {}),
  }
}

function firstNotPassing(claims: unknown): number | undefined {
  if (!Array.isArray(claims)) return undefined
  const failing = claims.find((claim) => isRecord(claim) && claim.verdict !== 'pass')
  return isRecord(failing) && typeof failing.index === 'number' ? failing.index : undefined
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

function headline(document: FieldReader): string {
  const verdict = document.take('verdict')
  const state = document.take('state')
  const id = document.take('verificationId')
  const name = document.take('name')
  const label = `${scalarText(id)} ${quoteString(String(name ?? ''))}`
  if (state !== 'completed') return `${scalarText(state)} ${label}`
  const window = document.record.window
  const settle = isRecord(window) && isRecord(window.settle) ? window.settle : null
  const commits =
    isRecord(window) && typeof window.commits === 'number' ? plural(window.commits, 'commit') : null
  const domains = settle && isRecord(settle.domains) ? Object.keys(settle.domains).join(', ') : ''
  const quiet = settle
    ? `${settle.outcome === 'met' ? 'quiet' : 'not quiet'} after ${scalarText(settle.waitedMs)} ms${domains ? ` (${domains})` : ''}`
    : null
  const ledger = document.record.ledger
  const retries =
    verdict === 'pass' &&
    isRecord(ledger) &&
    typeof ledger.failsOnSameCode === 'number' &&
    ledger.failsOnSameCode > 0
      ? `attempt ${scalarText(ledger.attempt)}: ${plural(ledger.failsOnSameCode, 'earlier run')} failed on the same code`
      : null
  return [`${scalarText(verdict)} ${label}`, [commits, quiet].filter(Boolean).join(', '), retries]
    .filter((part) => part)
    .join('  ')
}

function claimLines(claims: unknown, width: number): string[] {
  if (!Array.isArray(claims)) return []
  return claims.filter(isRecord).flatMap((entry) => {
    const claim = new FieldReader(entry)
    const index = scalarText(claim.take('index'))
    const verdict = String(claim.take('verdict') ?? '')
    const text = proseText(String(claim.take('text') ?? ''))
    claim.take('claim')
    claim.take('observed')
    const refusal = claim.take('refusal')
    const inconclusive = claim.take('inconclusive')
    const deciding = claim.take('deciding')
    const omitted = claim.take('decidingOmitted')
    const caveats = claim.take('caveats')
    const reason = isRecord(refusal) ? refusal : isRecord(inconclusive) ? inconclusive : null
    const observed = isRecord(entry.observed) ? entry.observed : {}
    const detail = reason
      ? `${scalarText(reason.reason)}: ${proseText(String(reason.message ?? ''))}`
      : flowText(observed)
    const lines = [`  ${index} ${verdict.padEnd(12)} ${text.padEnd(width)}  ${detail}`]
    if (reason && Object.keys(observed).length > 0)
      lines.push(`      observed: ${flowText(observed)}`)
    if (Array.isArray(deciding) && deciding.length > 0)
      lines.push(`      deciding: ${flowText(deciding)}`)
    if (typeof omitted === 'number' && omitted > 0) lines.push(`      decidingOmitted: ${omitted}`)
    if (Array.isArray(caveats) && caveats.length > 0)
      lines.push(`      caveats: ${flowText(caveats)}`)
    if (isRecord(refusal)) {
      const { reason: _reason, message: _message, next, ...rest } = refusal
      if (Object.keys(rest).length > 0) lines.push(`      ${flowText(rest).slice(1, -1)}`)
      if (isRecord(next) && typeof next.command === 'string')
        lines.push(`      fix: $ ${next.command}`)
    }
    if (isRecord(inconclusive) && isRecord(inconclusive.evidence))
      lines.push(`      evidence: ${flowText(inconclusive.evidence)}`)
    lines.push(...blockLines(claim.rest(), 0, '      '))
    return lines
  })
}

function windowLines(window: unknown): string[] {
  if (!isRecord(window)) return []
  const reader = new FieldReader(window)
  const refusals = reader.take('refusals')
  const lines = Array.isArray(refusals)
    ? refusals.filter(isRecord).flatMap((entry) => {
        const refusal = isRecord(entry.refusal) ? entry.refusal : {}
        const next =
          isRecord(refusal.next) && typeof refusal.next.command === 'string'
            ? refusal.next.command
            : null
        return [
          `  window ${scalarText(refusal.reason)}: ${proseText(String(refusal.message ?? ''))}`,
          ...(next ? [`    fix: $ ${next}`] : []),
        ]
      })
    : []
  return [...lines, ...fieldLines('window', reader.rest(), 1, '')]
}

function ledgerLine(ledger: unknown): string[] {
  if (!isRecord(ledger)) return []
  const reader = new FieldReader(ledger)
  const attempt = reader.take('attempt')
  const history = reader.take('history')
  const changed = reader.take('codeChangedSincePrevious')
  const previous = Array.isArray(history) ? history.filter(isRecord).at(-1) : undefined
  const parts = [`attempt ${scalarText(attempt)} for these claims on this tab`]
  if (previous) {
    const reasons =
      Array.isArray(previous.reasons) && previous.reasons.length > 0
        ? ` (${previous.reasons.map(scalarText).join(', ')})`
        : ''
    parts.push(
      `previous ${scalarText(previous.verdict)} ${scalarText(previous.verificationId)}${reasons}`,
    )
  }
  if (changed === 'fast-refresh') parts.push('code changed since (Fast Refresh)')
  else if (changed === 'document-reloaded') parts.push('document reloaded since')
  else if (changed === 'none-observed') parts.push('no code change observed')
  return [parts.join('; '), ...fieldLines('ledger', reader.rest(), 1, '')]
}

/** Text form of a verification: the verdict line, one line per claim with its evidence, window refusals, caveats, the rerun history and the evidence command. */
export function renderVerificationText(value: unknown): string {
  if (!isRecord(value) || value.kind !== 'verification') return encodeText(value)
  const document = new FieldReader(value)
  document.take('schemaVersion')
  document.take('kind')
  document.take('request')
  const lines = [headline(document)]
  const session = document.take('session')
  if (isRecord(session) && typeof session.url === 'string')
    lines.push(`  url ${quoteString(session.url)}`)
  const claims = document.take('claims')
  const width = Array.isArray(claims)
    ? Math.min(
        48,
        Math.max(0, ...claims.filter(isRecord).map((claim) => String(claim.text ?? '').length)),
      )
    : 0
  lines.push(...claimLines(claims, width))
  if (document.has('targets')) lines.push(...fieldLines('targets', document.take('targets'), 0, ''))
  lines.push(...windowLines(document.take('window')))
  const caveats = document.take('caveats')
  if (Array.isArray(caveats)) {
    for (const caveat of caveats) {
      const known = typeof caveat === 'string' ? CAVEAT_TEXT[caveat] : undefined
      lines.push(known ? `! ${caveat}: ${known}` : `! caveat: ${scalarText(caveat)}`)
    }
  }
  lines.push(...ledgerLine(document.take('ledger')))
  const next = document.take('next')
  if (isRecord(next) && typeof next.command === 'string') {
    lines.push(`${document.record.state === 'recording' ? 'next' : 'evidence'}: $ ${next.command}`)
  }
  if (isRecord(session)) {
    const { url: _url, ...rest } = session
    lines.push(...fieldLines('session', rest, 1, ''))
  }
  lines.push(...blockLines(document.rest(), 0, ''))
  return lines.join('\n')
}
