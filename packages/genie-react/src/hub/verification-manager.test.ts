// @vitest-environment jsdom
import '../collectors/react/hook'
import {
  Component,
  createElement,
  memo,
  type ReactNode,
  StrictMode,
  useEffect,
  useState,
} from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactCollector } from '../collectors/react'
import {
  devtoolsVerifyReadContract,
  type VerifyClaimInput,
  type VerifyClaimResult,
  verificationSchema,
} from '../protocol'
import { MAXIMUM_RENDER_OBSERVATION_BUDGET } from '../protocol/react-observation-schema'
import { freezeAnalysisClock } from '../test-support/analysis-clock'
import { loadReact18 } from '../test-support/react-18'
import { act, byText, click, mount, unmountAll } from '../test-support/react-app'
import { type VerifyHarnessOptions, verifyHarness } from '../test-support/verify-harness'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

interface Verification {
  verificationId: string
  verdict: string
  exitCode: number
  state: string
  claims: VerifyClaimResult[]
  caveats: string[]
  window: { commits: number; refusals: { guard: string; refusal: { reason: string } }[] }
  ledger: { attempt: number; failsOnSameCode: number; codeChangedSincePrevious: string | null }
}

const STABLE_APPEARANCE = { tone: 'success' }
const effectRuns: string[] = []

const StatusBadge = memo(function StatusBadge({ appearance }: { appearance: { tone: string } }) {
  return createElement('span', { 'data-tone': appearance.tone }, 'Pager on call')
})

function SearchScreen({ fixed }: { fixed: boolean }): ReactNode {
  const [query, setQuery] = useState('')
  return createElement(
    'main',
    null,
    createElement('button', { type: 'button', onClick: () => setQuery(`${query}c`) }, 'type'),
    createElement('output', null, `query:${query}`),
    createElement(StatusBadge, { appearance: fixed ? STABLE_APPEARANCE : { tone: 'success' } }),
  )
}

let harness: ReturnType<typeof verifyHarness> | undefined

function start(options?: VerifyHarnessOptions) {
  harness = verifyHarness([reactCollector()], options)
  return harness
}

const productionRoots: { unmount: () => void; container: HTMLElement }[] = []

beforeEach(freezeAnalysisClock)

afterEach(async () => {
  harness?.stop()
  harness = undefined
  await unmountAll()
  for (const root of productionRoots.splice(0)) {
    await loadReact18('production').act(() => root.unmount())
    root.container.remove()
  }
})

/** A second React copy in its production build, as Next.js bundles one for its dev overlay. */
async function mountProduction(
  render: (React: ReturnType<typeof loadReact18>['React']) => ReactNode,
): Promise<HTMLElement> {
  const production = loadReact18('production')
  const container = document.createElement('div')
  document.body.append(container)
  const root = production.createRoot(container)
  productionRoots.push({ unmount: () => root.unmount(), container })
  await production.act(() => root.render(render(production.React)))
  return container
}

function productionOverlay(React: ReturnType<typeof loadReact18>['React']): ReactNode {
  function DevOverlay(): ReactNode {
    const [issues] = React.useState(0)
    return React.createElement('nextjs-portal', null, `${issues} issues`)
  }
  return React.createElement(DevOverlay)
}

async function begin(claims: VerifyClaimInput[], extra: Record<string, unknown> = {}) {
  if (!harness) throw new Error('start the harness first')
  return harness.invoke<Verification & { state: string }>('devtools_verify_begin', {
    name: 'type in filter',
    claims,
    ...extra,
  })
}

async function end(verificationId: string) {
  if (!harness) throw new Error('start the harness first')
  return harness.invoke<Verification>('devtools_verify_end', { verificationId })
}

const badgeClaims: VerifyClaimInput[] = [
  { kind: 'renders', target: { component: 'StatusBadge' }, max: 0 },
  { kind: 'renders', target: { component: 'SearchScreen' }, min: 1 },
  { kind: 'boundaries-clean' },
]

async function typeTwice(container: HTMLElement): Promise<void> {
  await click(byText(container, 'type'))
  await click(byText(container, 'type'))
}

describe('verify on a real React tree', () => {
  it('fails a memo claim the badge breaks, with exact counts, and passes the controls', async () => {
    const app = await mount(createElement(SearchScreen, { fixed: false }))
    start()
    const began = await begin(badgeClaims)
    expect(began.state).toBe('recording')
    expect(verificationSchema.safeParse(began).error).toBeUndefined()
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)
    expect(verificationSchema.safeParse(verdict).error).toBeUndefined()

    expect(verdict.verdict).toBe('fail')
    expect(verdict.exitCode).toBe(1)
    expect(verdict.claims.map((claim) => claim.verdict)).toEqual(['fail', 'pass', 'pass'])
    expect(verdict.claims[0]?.observed).toMatchObject({ renders: 2, semantics: 'exact' })
    expect(verdict.caveats).toContain('ui-outcome-not-observed')
    expect(Object.keys(verdict).slice(0, 5)).toEqual([
      'schemaVersion',
      'kind',
      'verificationId',
      'verdict',
      'exitCode',
    ])
  })

  it('passes once the fix keeps the prop stable, with exact zero counts over real commits', async () => {
    const app = await mount(createElement(SearchScreen, { fixed: true }))
    start()
    const began = await begin(badgeClaims)
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)

    expect(verdict.verdict).toBe('pass')
    expect(verdict.exitCode).toBe(0)
    expect(verdict.window.commits).toBe(2)
    expect(verdict.claims[0]?.observed).toMatchObject({
      renders: 0,
      semantics: 'exact',
      activeInstances: expect.any(Number),
    })
    expect(verdict.claims[0]?.deciding[0]).toMatchObject({ kind: 'coverage', complete: true })
  })

  it('refuses an absence claim when the interaction never reached React, and fails the positive control', async () => {
    await mount(createElement(SearchScreen, { fixed: false }))
    start()
    const began = await begin(badgeClaims)
    const verdict = await end(began.verificationId)

    expect(verdict.claims.map((claim) => [claim.verdict, claim.refusal?.reason])).toEqual([
      ['refused', 'no_activity'],
      ['fail', undefined],
      ['pass', undefined],
    ])
    expect(verdict.verdict).toBe('fail')
  })

  it('refuses rather than passes when only an absence claim was made and nothing happened', async () => {
    await mount(createElement(SearchScreen, { fixed: false }))
    start()
    const began = await begin([badgeClaims[0] as VerifyClaimInput])
    const verdict = await end(began.verificationId)

    expect(verdict).toMatchObject({ verdict: 'refused', exitCode: 4 })
    expect(verdict.window.refusals).toEqual([
      expect.objectContaining({
        guard: 'activity',
        refusal: expect.objectContaining({ reason: 'no_activity' }),
      }),
    ])
  })

  it('fails a remount decoy that drops updates to zero by changing the key every render', async () => {
    function Decoy(): ReactNode {
      const [query, setQuery] = useState('')
      return createElement(
        'main',
        null,
        createElement('button', { type: 'button', onClick: () => setQuery(`${query}c`) }, 'type'),
        createElement(StatusBadge, { key: query, appearance: STABLE_APPEARANCE }),
      )
    }
    const app = await mount(createElement(Decoy))
    start()
    const began = await begin([
      { kind: 'renders', target: { component: 'StatusBadge' }, max: 0, counting: 'updates' },
      { kind: 'renders', target: { component: 'StatusBadge' }, max: 0 },
    ])
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)

    expect(verdict.claims.map((claim) => claim.verdict)).toEqual(['fail', 'fail'])
    expect(verdict.claims[0]?.observed).toMatchObject({ updates: 0, remounts: 2 })
  })

  it('refuses an upper bound when the target renders after settling, inside the tail', async () => {
    let container: HTMLElement | undefined
    start({
      duringTail: async () => {
        if (container) await click(byText(container, 'type'))
      },
    })
    container = (await mount(createElement(SearchScreen, { fixed: false }))).container
    const began = await begin([{ kind: 'renders', target: { component: 'StatusBadge' }, max: 3 }])
    await click(byText(container, 'type'))
    const verdict = await end(began.verificationId)

    expect(verdict.claims[0]).toMatchObject({
      verdict: 'refused',
      refusal: { reason: 'not_quiescent' },
      observed: { renders: 2 },
    })
  })

  it('refuses every claim when another caller resets the window past the lock', async () => {
    let reset: (() => Promise<unknown>) | undefined
    const app = await mount(createElement(SearchScreen, { fixed: true }))
    start({ duringTail: () => reset?.().then(() => undefined) })
    reset = () => harness?.call(null, 'react_clear_renders', {}) ?? Promise.resolve()
    const began = await begin(badgeClaims)
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)

    expect(verdict.verdict).toBe('refused')
    expect(new Set(verdict.claims.map((claim) => claim.refusal?.reason))).toEqual(
      new Set(['window_interrupted']),
    )
  })

  it('refuses every claim when profiling was paused during the window', async () => {
    let pause: (() => Promise<unknown>) | undefined
    const app = await mount(createElement(SearchScreen, { fixed: true }))
    start({ duringTail: () => pause?.().then(() => undefined) })
    pause = () => harness?.call(null, 'react_profile_stop', {}) ?? Promise.resolve()
    const began = await begin([badgeClaims[0] as VerifyClaimInput])
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)

    expect(verdict.claims[0]?.refusal?.reason).toBe('window_interrupted')
  })

  it('refuses every claim when the document reloads during the window', async () => {
    const app = await mount(createElement(SearchScreen, { fixed: true }))
    const verify = start()
    const began = await begin(badgeClaims)
    await typeTwice(app.container)
    verify.reload()
    const verdict = await end(began.verificationId)

    expect(verdict.verdict).toBe('refused')
    expect(verdict.claims.every((claim) => claim.refusal?.reason === 'session_changed')).toBe(true)
  })

  it('returns the stored verdict for a repeated end and refuses an unknown one', async () => {
    const app = await mount(createElement(SearchScreen, { fixed: true }))
    const verify = start()
    const began = await begin(badgeClaims)
    await typeTwice(app.container)
    const first = await end(began.verificationId)
    const second = await end(began.verificationId)
    const unknown = await verify.raw('devtools_verify_end', {
      verificationId: 'vfy_00000000-0000-4000-8000-000000000000',
    })

    expect(second).toEqual(first)
    expect(
      await verify.invoke('devtools_verify_read', { verificationId: began.verificationId }),
    ).toEqual(first)
    expect(
      await verify.invoke('devtools_verify_read', {
        verificationId: began.verificationId,
        claim: 1,
      }),
    ).toMatchObject({ verdict: first.verdict, claim: first.claims[0] })
    for (const read of [
      { claim: 1 },
      { section: 'guards' },
      { section: 'raw:react_profile_stop' },
    ]) {
      const view = await verify.invoke('devtools_verify_read', {
        verificationId: began.verificationId,
        ...read,
      })
      expect(devtoolsVerifyReadContract.output.safeParse(view).error).toBeUndefined()
    }
    expect(unknown).toMatchObject({
      ok: false,
      errorDetails: { hubCode: 'VERIFICATION_UNKNOWN' },
    })
  })

  it('locks window and override tools while recording, and abort releases the lock', async () => {
    await mount(createElement(SearchScreen, { fixed: true }))
    const verify = start()
    const began = await begin(badgeClaims)
    const sessionId = verify.session.sessionId

    expect(verify.manager.lockFor(sessionId, 'react_clear_renders')).toBe(began.verificationId)
    expect(verify.manager.lockFor(sessionId, 'react_override_props')).toBe(began.verificationId)
    expect(verify.manager.lockFor(sessionId, 'react_get_renders')).toBeUndefined()
    expect(
      await verify.raw('devtools_verify_begin', { name: 'second', claims: badgeClaims }),
    ).toMatchObject({
      ok: false,
      errorCode: 'conflict',
      errorDetails: { hubCode: 'VERIFICATION_ACTIVE', verificationId: began.verificationId },
    })
    const aborted = await verify.invoke('devtools_verify_abort', {
      verificationId: began.verificationId,
    })
    expect(aborted.state).toBe('aborted')
    expect(verificationSchema.safeParse(aborted).error).toBeUndefined()
    expect(verify.manager.lockFor(sessionId, 'react_clear_renders')).toBeUndefined()
  })

  it('refuses at begin while an override is active, and states it when overrides are allowed', async () => {
    const app = await mount(createElement(SearchScreen, { fixed: true }))
    const verify = start()
    const tree = (await verify.call(null, 'react_find_components', { query: 'StatusBadge' })) as {
      result: { matches: { id: number }[] }
    }
    const id = tree.result.matches[0]?.id
    await act(async () => {
      await verify.call(null, 'react_override_props', { id, props: { appearance: { tone: 'x' } } })
    })

    const refusedAtBegin = await begin(badgeClaims)
    expect(refusedAtBegin).toMatchObject({ verdict: 'refused', state: 'completed', stage: 'begin' })
    expect(verificationSchema.safeParse(refusedAtBegin).error).toBeUndefined()
    expect(refusedAtBegin.claims[0]?.refusal?.reason).toBe('override_active')

    const allowed = await begin(badgeClaims, { allowOverrides: true })
    await typeTwice(app.container)
    const verdict = await end(allowed.verificationId)
    expect(verdict.caveats).toContain('overrides-active')
    await verify.call(null, 'react_reset_overrides', {})
  })

  it('fails boundaries clean for a boundary that caught and reset inside the window', async () => {
    let broken = false
    function Thrower(): ReactNode {
      if (broken) throw new Error('save failed')
      return createElement('span', null, 'ok')
    }
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      override state = { failed: false }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      override render(): ReactNode {
        return this.state.failed
          ? createElement(
              'button',
              {
                type: 'button',
                onClick: () => {
                  broken = false
                  this.setState({ failed: false })
                },
              },
              'retry',
            )
          : this.props.children
      }
    }
    function Page(): ReactNode {
      const [, setTick] = useState(0)
      return createElement(
        'main',
        null,
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              broken = true
              setTick((tick) => tick + 1)
            },
          },
          'save',
        ),
        createElement(Boundary, null, createElement(Thrower)),
      )
    }
    const app = await mount(createElement(Page))
    start()
    const began = await begin([
      { kind: 'boundaries-clean' },
      { kind: 'boundaries-clean', scope: 'end' },
    ])
    await click(byText(app.container, 'save'))
    await click(byText(app.container, 'retry'))
    const verdict = await end(began.verificationId)

    expect(verdict.claims.map((claim) => claim.verdict)).toEqual(['fail', 'pass'])
    expect(verdict.claims[0]?.deciding[0]).toMatchObject({
      kind: 'boundary-catch',
      message: 'save failed',
    })
  })

  it('counts observed effect runs, and calls a StrictMode-only excess inconclusive', async () => {
    function Report({ strictOnly }: { strictOnly: boolean }): ReactNode {
      const [query, setQuery] = useState('')
      const dependency = strictOnly ? 'fixed' : query
      useEffect(() => {
        effectRuns.push(dependency)
      }, [dependency])
      return createElement(
        'button',
        { type: 'button', onClick: () => setQuery(`${query}c`) },
        'type',
      )
    }
    const looping = await mount(createElement(Report, { strictOnly: false }))
    start()
    const runs = await begin([{ kind: 'effect-runs', target: { component: 'Report' }, max: 1 }])
    await typeTwice(looping.container)
    const failing = await end(runs.verificationId)
    expect(failing.claims[0]).toMatchObject({
      verdict: 'fail',
      observed: { effects: [{ runs: 2 }] },
    })
    await looping.unmount()

    function Host(): ReactNode {
      const [shown, setShown] = useState(false)
      return createElement(
        'div',
        null,
        createElement('button', { type: 'button', onClick: () => setShown(true) }, 'open'),
        shown ? createElement(StrictMode, null, createElement(Report, { strictOnly: true })) : null,
      )
    }
    const strict = await mount(createElement(Host))
    const replay = await begin([{ kind: 'effect-runs', target: { component: 'Report' }, max: 1 }])
    await click(byText(strict.container, 'open'))
    const verdict = await end(replay.verificationId)
    expect(verdict.claims[0]).toMatchObject({
      verdict: 'inconclusive',
      inconclusive: { reason: 'strict_mode_replay' },
      observed: { effects: [{ runs: 1, rawRuns: 2 }] },
    })
  })

  it('fails effect settles when the effect keeps running after the agent stopped driving', async () => {
    let container: HTMLElement | undefined
    function Poller(): ReactNode {
      const [tick, setTick] = useState(0)
      useEffect(() => {
        effectRuns.push(String(tick))
      }, [tick])
      return createElement('button', { type: 'button', onClick: () => setTick(tick + 1) }, 'tick')
    }
    start({
      duringTail: async () => {
        if (!container) return
        await click(byText(container, 'tick'))
        await click(byText(container, 'tick'))
      },
    })
    container = (await mount(createElement(Poller))).container
    const began = await begin([{ kind: 'effect-settles', target: { component: 'Poller' } }])
    await click(byText(container, 'tick'))
    const verdict = await end(began.verificationId)

    expect(verdict.claims[0]).toMatchObject({
      verdict: 'fail',
      observed: { tailRuns: [{ runs: 2 }] },
    })
  })

  it('fails a render-causes claim on an exact cause outside the allowed set', async () => {
    const Count = memo(function Count({ label }: { label: string }): ReactNode {
      return createElement('span', null, label)
    })
    function Parent(): ReactNode {
      const [query, setQuery] = useState('')
      return createElement(
        'main',
        null,
        createElement('button', { type: 'button', onClick: () => setQuery(`${query}c`) }, 'type'),
        createElement(Count, { label: query }),
      )
    }
    const app = await mount(createElement(Parent))
    start()
    const began = await begin([
      { kind: 'render-causes', target: { component: 'Count' }, allow: [{ kind: 'state' }] },
      {
        kind: 'render-causes',
        target: { component: 'Count' },
        allow: [{ kind: 'props', name: 'label' }],
      },
    ])
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)

    expect(verdict.claims.map((claim) => claim.verdict)).toEqual(['fail', 'pass'])
  })

  it('refuses render-causes when the deciding cause is a parent render, which is only ever inferred', async () => {
    function Plain({ label }: { label: string }): ReactNode {
      return createElement('span', null, label)
    }
    function Parent(): ReactNode {
      const [query, setQuery] = useState('')
      return createElement(
        'main',
        null,
        createElement('button', { type: 'button', onClick: () => setQuery(`${query}c`) }, 'type'),
        createElement(Plain, { label: query }),
      )
    }
    const app = await mount(createElement(Parent))
    start()
    const began = await begin([
      { kind: 'render-causes', target: { component: 'Plain' }, allow: [{ kind: 'props' }] },
    ])
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)

    expect(verdict.claims[0]?.refusal?.reason).toBe('evidence_inferred')
  })

  it('refuses a renamed or missing target instead of passing an absence', async () => {
    const app = await mount(createElement(SearchScreen, { fixed: true }))
    start()
    const began = await begin([
      { kind: 'renders', target: { component: 'StatusBadgeRenamed' }, max: 0 },
      { kind: 'renders', target: { component: 'SearchScreen' }, min: 1 },
    ])
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)

    expect(verdict.claims[0]?.refusal?.reason).toBe('target_not_found')
    expect(verdict.verdict).toBe('refused')
  })

  it('expires a window nobody ended, releases the lock, and refuses with window_lost', async () => {
    await mount(createElement(SearchScreen, { fixed: true }))
    const verify = start()
    vi.useFakeTimers()
    try {
      const began = await begin(badgeClaims, { maxDurationMs: 10_000 })
      vi.advanceTimersByTime(10_000)

      expect(
        verify.manager.lockFor(verify.session.sessionId, 'react_clear_renders'),
      ).toBeUndefined()
      const verdict = await end(began.verificationId)
      expect(verdict.verdict).toBe('refused')
      expect(verdict.claims.every((result) => result.refusal?.reason === 'window_lost')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('records every attempt and says when a pass follows failures on the same code', async () => {
    const broken = await mount(createElement(SearchScreen, { fixed: false }))
    start()
    for (const _ of [1, 2]) {
      const run = await begin([badgeClaims[0] as VerifyClaimInput])
      await typeTwice(broken.container)
      expect((await end(run.verificationId)).verdict).toBe('fail')
    }
    await broken.unmount()
    const fixed = await mount(createElement(SearchScreen, { fixed: true }))
    const run = await begin([badgeClaims[0] as VerifyClaimInput])
    await typeTwice(fixed.container)
    const verdict = await end(run.verificationId)

    expect(verdict.verdict).toBe('pass')
    expect(verdict.ledger).toMatchObject({ attempt: 3, failsOnSameCode: 2 })
    expect(verdict.caveats).toContain('passed-after-failures-on-same-code')
  })
})

describe('verify on a page that mixes React builds', () => {
  it('passes when a production renderer on the page hosts none of the targets, as the Next.js dev overlay does', async () => {
    const app = await mount(createElement(SearchScreen, { fixed: true }))
    await mountProduction(productionOverlay)
    start()
    const began = await begin(badgeClaims)
    expect(began.state).toBe('recording')
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)

    expect(verdict.verdict).toBe('pass')
    expect(verdict.claims[0]?.observed).toMatchObject({ renders: 0, semantics: 'exact' })
  })

  it('refuses at begin when a production renderer hosts a claim target', async () => {
    await mount(createElement(SearchScreen, { fixed: true }))
    await mountProduction((React) =>
      React.createElement(function StatusBadge(): ReactNode {
        return React.createElement('span', null, 'Pager on call')
      }),
    )
    start()
    const began = await begin(badgeClaims)

    expect(began.verdict).toBe('refused')
    expect(began.claims.map((claim) => claim.refusal?.reason)).toEqual([
      'unsupported_environment',
      'unsupported_environment',
      'unsupported_environment',
    ])
  })

  it('refuses even a satisfied lower bound when a production renderer mounts the target during the window', async () => {
    const app = await mount(createElement(SearchScreen, { fixed: false }))
    start()
    const began = await begin([{ kind: 'renders', target: { component: 'StatusBadge' }, min: 1 }])
    await typeTwice(app.container)
    await mountProduction((React) =>
      React.createElement(function StatusBadge(): ReactNode {
        return React.createElement('span', null, 'Pager on call')
      }),
    )
    const verdict = await end(began.verificationId)

    expect(verdict.verdict).toBe('refused')
    expect(verdict.window.refusals).toEqual([
      expect.objectContaining({
        guard: 'development-bundle',
        refusal: expect.objectContaining({ reason: 'unsupported_environment' }),
      }),
    ])
  })

  it('does not pass boundaries clean when a production renderer commits in the window before the app does', async () => {
    let setBroken: (broken: boolean) => void = () => {}
    await mountProduction((React) => {
      function Thrower({ broken }: { broken: boolean }): ReactNode {
        if (broken) throw new Error('overlay failed')
        return React.createElement('span', null, 'ok')
      }
      class Boundary extends React.Component<{ children: ReactNode }, { failed: boolean }> {
        override state = { failed: false }
        static getDerivedStateFromError() {
          return { failed: true }
        }
        override render(): ReactNode {
          return this.state.failed ? 'caught' : this.props.children
        }
      }
      function Widget(): ReactNode {
        const [broken, update] = React.useState(false)
        setBroken = update
        return React.createElement(Boundary, null, React.createElement(Thrower, { broken }))
      }
      return React.createElement(Widget)
    })
    const app = await mount(createElement(SearchScreen, { fixed: true }))
    start()
    const began = await begin([{ kind: 'boundaries-clean' }])
    await loadReact18('production').act(() => setBroken(true))
    await typeTwice(app.container)
    const verdict = await end(began.verificationId)

    expect(verdict.claims.map((claim) => [claim.verdict, claim.refusal?.reason])).toEqual([
      ['refused', 'coverage_incomplete'],
    ])
  })
})

describe('verify on a tree with more matching instances than one render report keeps', () => {
  const CELLS = 5_100

  function Cell({ value }: { value: number }): ReactNode {
    return createElement('td', null, value)
  }

  function Grid(): ReactNode {
    const [tick, setTick] = useState(0)
    return createElement(
      'div',
      null,
      createElement('button', { type: 'button', onClick: () => setTick(tick + 1) }, 'tick'),
      createElement(
        'table',
        null,
        createElement(
          'tbody',
          null,
          createElement(
            'tr',
            null,
            Array.from({ length: CELLS }, (_, index) =>
              createElement(Cell, { key: index, value: index + tick }),
            ),
          ),
        ),
      ),
    )
  }

  it('refuses a max claim it could read only one page of instead of passing on that page', async () => {
    const app = await mount(createElement(Grid))
    start()
    const began = await begin(
      [{ kind: 'renders', target: { component: 'Cell' }, max: CELLS - 100 }],
      { budget: MAXIMUM_RENDER_OBSERVATION_BUDGET },
    )
    await click(byText(app.container, 'tick'))
    const verdict = await end(began.verificationId)

    expect(verdict.claims.map((claim) => [claim.verdict, claim.refusal?.reason])).toEqual([
      ['refused', 'evidence_truncated'],
    ])
  }, 20_000)
})
