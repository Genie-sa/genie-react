import { describe, expect, it } from 'vitest'
import { EXIT_CODES, failureExit } from './exit-codes'
import type { FailureReason } from './failure'
import { asShellCommand } from './text-output'
import {
  beginAgainCommand,
  fixCommand,
  renderVerificationText,
  withNextCommands,
} from './verify-output'

const ID = 'vfy_2b1f0c9a-4d1e-4f60-9a4c-1f2e3d4c5b6a'

function verdict(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '1.0',
    kind: 'verification',
    verificationId: ID,
    verdict: 'refused',
    exitCode: 4,
    name: 'edit order 412 quantity',
    state: 'completed',
    claims: [
      {
        index: 1,
        text: 'render OrderRow max 1',
        claim: {
          kind: 'renders',
          target: { component: 'OrderRow' },
          max: 1,
          counting: 'renders',
          allowRemount: false,
        },
        verdict: 'refused',
        observed: { renders: 1, semantics: 'lower-bound' },
        deciding: [],
        caveats: [],
        refusal: {
          reason: 'budget_exhausted',
          message: 'fiberLimit ran out in 1 commit, so render counts are a lower bound.',
          fix: { action: 'begin-again', budget: { fiberLimit: 1200, operationLimit: 90000 } },
        },
      },
      {
        index: 2,
        text: 'render OrdersTable min 1',
        claim: {
          kind: 'renders',
          target: { component: 'OrdersTable' },
          min: 1,
          counting: 'renders',
          allowRemount: false,
        },
        verdict: 'pass',
        observed: { renders: 1, semantics: 'exact' },
        deciding: [],
        caveats: [],
      },
    ],
    request: {
      budget: {
        fiberLimit: 250,
        operationLimit: 20000,
        timeLimitMs: 8,
        targetOperationReserve: 4000,
        targetTimeReserveMs: 4,
        adaptive: true,
      },
      settle: { quietMs: 500, timeoutMs: 10000 },
      maxDurationMs: 300000,
      allowOverrides: false,
    },
    ...overrides,
  }
}

const tail = (argv: string[]) => argv.slice(argv.indexOf('genie-react') + 1)

describe('commands built from a stored verdict', () => {
  it('repeats the begin with the same name and claims and only the budget the fix changes', () => {
    const next = beginAgainCommand(verdict(), 'my-agent', {
      budget: { fiberLimit: 1200, operationLimit: 90000 },
    })

    expect(tail(next?.argv ?? [])).toEqual([
      'verify',
      'begin',
      '--session',
      'my-agent',
      '--name',
      'edit order 412 quantity',
      '--claim',
      'render OrderRow max 1',
      '--claim',
      'render OrdersTable min 1',
      '--budget',
      '{"fiberLimit":1200,"operationLimit":90000}',
    ])
    expect(asShellCommand(next)).toBe(true)
  })

  it('keeps a hostile run name inside one quoted argument', () => {
    const next = beginAgainCommand(verdict({ name: "x'; rm -rf / #" }), undefined)

    expect(tail(next?.argv ?? [])).toContain("x'; rm -rf / #")
    expect(asShellCommand(next)).toBe(true)
    expect(next?.command).toContain(`'x'\\''; rm -rf / #'`)
  })

  it('drops a session pin that is not a safe identifier instead of echoing it', () => {
    const next = beginAgainCommand(verdict(), 'tab$(id)')

    expect(next?.argv).not.toContain('--session')
    expect(next?.command).not.toContain('$(id)')
  })

  it('carries settle changes from a not-quiescent fix', () => {
    const next = beginAgainCommand(verdict(), undefined, { settle: { timeoutMs: 20000 } })

    expect(tail(next?.argv ?? [])).toEqual(expect.arrayContaining(['--timeout-ms', '20000']))
  })

  it('builds no begin command when the verdict lacks the claims it would repeat', () => {
    expect(beginAgainCommand(verdict({ claims: [] }), undefined)).toBeUndefined()
  })

  it.each([
    [{ action: 'reset-overrides' }, ['call', 'react_reset_overrides', '{}']],
    [{ action: 'check-setup' }, ['doctor', '--live']],
    [
      { action: 'find-target', component: 'StatusBadge' },
      ['call', 'react_find_components', '{"query":"StatusBadge"}'],
    ],
    [
      { action: 'list-target-sources', component: 'Row' },
      ['call', 'react_component_cohort', '{"component":"Row","exact":true,"appOnly":false}'],
    ],
  ] as const)('turns fix %j into a runnable command', (fix, expected) => {
    expect(tail(fixCommand(fix, verdict(), undefined)?.argv ?? [])).toEqual(expected)
  })

  it('offers no command when the fix is to change the claim, or the component is unsafe to echo', () => {
    expect(fixCommand({ action: 'change-claim' }, verdict(), undefined)).toBeUndefined()
    expect(
      fixCommand({ action: 'find-target', component: "a'b" }, verdict(), undefined),
    ).toBeUndefined()
  })

  it('adds each refusal its fix and points the evidence command at the first claim that did not pass', () => {
    const document = withNextCommands(verdict(), 'my-agent') as {
      claims: { refusal?: { next?: { argv: string[] } } }[]
      next: { argv: string[] }
    }

    expect(document.claims[0]?.refusal?.next?.argv).toContain('--budget')
    expect(tail(document.next.argv)).toEqual([
      'verify',
      'show',
      ID,
      '--claim',
      '1',
      '--session',
      'my-agent',
    ])
  })

  it('points a recording window at verify end', () => {
    const document = withNextCommands(
      { kind: 'verification', verificationId: ID, state: 'recording' },
      undefined,
    ) as {
      next: { argv: string[] }
    }

    expect(tail(document.next.argv)).toEqual(['verify', 'end', ID])
  })
})

describe('verdict text', () => {
  it('leads with the verdict, the ID and the quoted name, then one line per claim', () => {
    const lines = renderVerificationText(withNextCommands(verdict(), undefined)).split('\n')

    expect(lines[0]).toBe(`refused ${ID} "edit order 412 quantity"`)
    expect(lines[1]).toMatch(
      /^ {2}1 refused render OrderRow max 1 {2}budget_exhausted: fiberLimit ran out/,
    )
    expect(
      lines.some((line) => line.startsWith('      fix: $ ') && line.includes('--budget')),
    ).toBe(true)
  })

  it('marks the claims of a recording window as not decided yet', () => {
    const text = renderVerificationText({
      schemaVersion: '1.0',
      kind: 'verification',
      verificationId: ID,
      state: 'recording',
      name: 'put one order on hold',
      claims: [
        { index: 1, text: 'render OrderRow only props.order' },
        { index: 2, text: 'boundaries clean' },
      ],
    })

    expect(text.split('\n').slice(0, 3)).toEqual([
      `recording ${ID} "put one order on hold"`,
      '  1 recording render OrderRow only props.order',
      '  2 recording boundaries clean',
    ])
  })

  it('names an earlier failure on the same code on the first line of a pass', () => {
    const text = renderVerificationText(
      verdict({ verdict: 'pass', ledger: { attempt: 4, history: [], failsOnSameCode: 2 } }),
    )

    expect(text.split('\n')[0]).toContain('attempt 4: 2 earlier runs failed on the same code')
  })

  it('blames the timeout only when the settle wait ran out', () => {
    const text = renderVerificationText(
      verdict({
        window: {
          commits: 6,
          settle: {
            outcome: 'timed-out',
            waitedMs: 10_000,
            domains: { react: 'met', network: 'pending' },
          },
        },
        caveats: ['not-settled'],
      }),
    ).split('\n')

    expect(text[0]).toBe(
      `refused ${ID} "edit order 412 quantity"  6 commits, not quiet after 10000 ms (react, network)`,
    )
    expect(text).toContain('! not-settled: the app did not settle within the timeout')
  })

  it('names the domain Genie could not observe when settle failed before the timeout', () => {
    const text = renderVerificationText(
      verdict({
        window: {
          commits: 6,
          settle: {
            outcome: 'failed',
            reason: 'Generic network quiet is not instrumented by this app.',
            waitedMs: 21,
            domains: { react: 'pending', network: 'unsupported' },
          },
        },
        caveats: ['not-settled'],
      }),
    ).split('\n')

    expect(text[0]).toBe(
      `refused ${ID} "edit order 412 quantity"  6 commits, settle not observed after 21 ms (network unsupported)`,
    )
    expect(text).toContain('! not-settled: Genie could not observe whether the app settled')
    expect(text.join('\n')).not.toContain('within the timeout')
  })

  it('prints a caveat code it does not know as data, not as a sentence', () => {
    const text = renderVerificationText(
      verdict({ caveats: ['ui-outcome-not-observed', 'new-caveat'] }),
    )

    expect(text).toContain('! ui-outcome-not-observed: Genie does not check the screen')
    expect(text).toContain('! caveat: new-caveat')
  })
})

describe('exit-code taxonomy', () => {
  it.each([
    ['invalid_input', 2],
    ['invalid_args', 2],
    ['unknown_tool', 2],
    ['unknown_session', 2],
    ['tool_error', 1],
    ['tool_unavailable', 1],
    ['operational_failure', 1],
    ['bridge_rejected', 3],
    ['bridge_unreachable', 69],
    ['not_connected', 69],
    ['timeout', 124],
    ['busy', 124],
  ] as [FailureReason, number][])('maps %s to %i', (reason, code) => {
    expect(failureExit(reason).code).toBe(code)
  })

  it('keeps every code below the shell reserved range except SIGINT', () => {
    for (const [exitClass, code] of Object.entries(EXIT_CODES)) {
      if (exitClass !== 'interrupted') expect(code).toBeLessThan(126)
    }
    expect(EXIT_CODES.interrupted).toBe(130)
  })
})
