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
  'ui-outcome-not-observed': 'Genie does not check the screen; confirm it with the UI driver',
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

function showCommand(
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

function endCommand(verificationId: string, session: string | undefined): Command | undefined {
  if (!VERIFICATION_ID.test(verificationId)) return undefined
  return genieCommand(['verify', 'end', verificationId, ...sessionFlags(session)])
}

interface StoredRequest {
  budget?: Record<string, unknown>
  settle?: { quietMs?: number; timeoutMs?: number; domains?: string[] }
  tailMs?: number
  maxDurationMs?: number
  allowOverrides?: boolean
}

function storedRequest(document: Record<string, unknown>): StoredRequest | null {
  return isRecord(document.request) ? (document.request as StoredRequest) : null
}

/** The claims a run declared, in order; the begin command repeats them exactly. */
function declaredClaims(document: Record<string, unknown>): VerifyClaim[] | null {
  if (!Array.isArray(document.claims) || document.claims.length === 0) return null
  const claims = document.claims.map((entry) =>
    isRecord(entry) && isRecord(entry.claim) ? entry.claim : null,
  )
  return claims.every((claim) => claim !== null) ? (claims as unknown as VerifyClaim[]) : null
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
  const claims = declaredClaims(document)
  const name = typeof document.name === 'string' ? document.name : undefined
  if (!request || !claims || name === undefined) return undefined
  const quietMs = fix?.settle?.quietMs ?? request.settle?.quietMs
  const timeoutMs = fix?.settle?.timeoutMs ?? request.settle?.timeoutMs
  return genieCommand([
    'verify',
    'begin',
    ...sessionFlags(session),
    '--name',
    name,
    ...claims.flatMap((claim) => ['--claim', formatVerifyClaim(claim)]),
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

/** A refusal or inconclusive as `reason: message`, then its remaining fields and its fix command. */
function reasonLines(reason: Record<string, unknown>, indent: string): string[] {
  const fields = new FieldReader(reason)
  fields.take('reason')
  fields.take('message')
  const next = fields.take('next')
  return [
    ...(Object.keys(fields.rest()).length > 0
      ? [`${indent}${flowText(fields.rest()).slice(1, -1)}`]
      : []),
    ...(next === undefined ? [] : fieldLines('fix', next, 2, indent)),
  ]
}

/** One line per claim; a claim the window has not decided yet shows the document state in place of its verdict. */
function claimLines(claims: unknown, state: unknown): string[] {
  if (!Array.isArray(claims)) return []
  return claims.flatMap((entry) => {
    if (!isRecord(entry)) return [`  - ${flowText(entry)}`]
    const claim = new FieldReader(entry)
    const index = scalarText(claim.take('index'))
    const verdict = claim.take('verdict')
    const text = proseText(String(claim.take('text') ?? ''))
    const observed = claim.take('observed')
    const reason = [claim.take('refusal'), claim.take('inconclusive')].find(isRecord)
    const detail = reason
      ? `  ${scalarText(reason.reason)}: ${proseText(String(reason.message ?? ''))}`
      : observed === undefined
        ? ''
        : `  ${flowText(observed)}`
    const lines = [`  ${index} ${scalarText(verdict ?? state)} ${text}${detail}`]
    if (reason) {
      if (observed !== undefined) lines.push(`      observed: ${flowText(observed)}`)
      lines.push(...reasonLines(reason, '      '))
    }
    const { caveats, ...rest } = claim.rest()
    if (caveats !== undefined && (!Array.isArray(caveats) || caveats.length > 0))
      rest.caveats = caveats
    lines.push(...blockLines(rest, 2, '      '))
    return lines
  })
}

function windowLines(window: unknown): string[] {
  if (!isRecord(window)) return window === undefined ? [] : fieldLines('window', window, 0, '')
  const { refusals, ...rest } = window
  const lines = Array.isArray(refusals)
    ? refusals.flatMap((entry) => {
        const refusal = isRecord(entry) && isRecord(entry.refusal) ? entry.refusal : null
        if (!isRecord(entry) || !refusal) return [`  window ${flowText(entry)}`]
        const { refusal: _refusal, ...guard } = entry
        return [
          `  window ${scalarText(refusal.reason)}: ${proseText(String(refusal.message ?? ''))}`,
          ...(Object.keys(guard).length > 0 ? [`    ${flowText(guard).slice(1, -1)}`] : []),
          ...reasonLines(refusal, '    '),
        ]
      })
    : refusals === undefined
      ? []
      : fieldLines('refusals', refusals, 1, '  ')
  return [...lines, ...fieldLines('window', rest, 2, '')]
}

function ledgerLine(ledger: unknown): string[] {
  if (!isRecord(ledger)) return []
  const previous = Array.isArray(ledger.history)
    ? ledger.history.filter(isRecord).at(-1)
    : undefined
  const parts = [`attempt ${scalarText(ledger.attempt)} for these claims on this tab`]
  if (previous) {
    const reasons =
      Array.isArray(previous.reasons) && previous.reasons.length > 0
        ? ` (${previous.reasons.map(scalarText).join(', ')})`
        : ''
    parts.push(
      `previous ${scalarText(previous.verdict)} ${scalarText(previous.verificationId)}${reasons}`,
    )
  }
  const change = ledger.codeChangedSincePrevious
  if (change === 'fast-refresh') parts.push('code changed since (Fast Refresh)')
  else if (change === 'document-reloaded') parts.push('document reloaded since')
  else if (change === 'none-observed') parts.push('no code change observed')
  return [parts.join('; ')]
}

/** Text form of a verification: the verdict line, one line per claim with its evidence, window refusals, caveats, the rerun history and the evidence command; every other field follows as generic text. */
export function renderVerificationText(value: unknown): string {
  if (!isRecord(value) || value.kind !== 'verification') return encodeText(value)
  const document = new FieldReader(value)
  document.take('kind')
  const lines = [headline(document)]
  const session = document.take('session')
  if (isRecord(session) && typeof session.url === 'string')
    lines.push(`  url ${quoteString(session.url)}`)
  const claims = document.take('claims')
  lines.push(...claimLines(claims, document.record.state))
  lines.push(...windowLines(document.take('window')))
  const caveats = document.take('caveats')
  if (Array.isArray(caveats)) {
    for (const caveat of caveats) {
      const known = typeof caveat === 'string' ? CAVEAT_TEXT[caveat] : undefined
      lines.push(known ? `! ${caveat}: ${known}` : `! caveat: ${scalarText(caveat)}`)
    }
  } else if (caveats !== undefined) {
    lines.push(...fieldLines('caveats', caveats, 0, ''))
  }
  lines.push(...ledgerLine(document.record.ledger))
  const next = document.take('next')
  if (next !== undefined) {
    lines.push(
      ...fieldLines(document.record.state === 'recording' ? 'next' : 'evidence', next, 0, ''),
    )
  }
  if (isRecord(session)) {
    const { url: _url, ...rest } = session
    lines.push(...fieldLines('session', typeof session.url === 'string' ? rest : session, 2, ''))
  } else if (session !== undefined) {
    lines.push(...fieldLines('session', session, 0, ''))
  }
  lines.push(...blockLines(document.rest(), 2, ''))
  return lines.join('\n')
}
