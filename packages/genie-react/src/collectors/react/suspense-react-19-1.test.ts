// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { instrument } from 'bippy'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createElement,
  createRoot,
  lazy,
  Suspense,
  use,
  version,
} from '../../../../../apps/react-19-1-fixture/index.js'
import { noteCommittedRoot } from './fiber'
import { getSuspenseReport, type SuspenseQuery } from './suspense-boundaries'
import { reactSuspenseContract } from './suspense-contract'

instrument({ onCommitFiberRoot: (_rendererId, root) => noteCommittedRoot(root) })

const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms))
const FULL: SuspenseQuery = {
  waitingOnly: false,
  limit: 20,
  blockerLimit: 10,
  includeSource: false,
  appOnly: false,
  view: 'full',
}

const host = document.createElement('div')
host.id = 'root'
document.body.append(host)
const root = createRoot(host)
afterAll(() => root.unmount())

async function read() {
  const report = await getSuspenseReport(FULL)
  reactSuspenseContract.output.parse(report)
  if (report.view !== 'full') throw new Error('expected the full view')
  return report
}

describe('react_suspense on React 19.1', () => {
  it('marks the data partial: use() and lazy are recognized, but without names or timings', async () => {
    expect(version).toBe('19.1.1')
    let resolveProfile!: (value: string) => void
    const profile = Object.assign(
      new Promise<string>((resolve) => {
        resolveProfile = resolve
      }),
      { displayName: 'loadProfile' },
    )
    let loadChart!: (module: { default: () => unknown }) => void
    const LazyChart = lazy(
      () =>
        new Promise((resolve) => {
          loadChart = resolve
        }),
    )
    function Reader(): unknown {
      return createElement('span', null, use(profile))
    }
    root.render(
      createElement(
        'main',
        null,
        createElement(Suspense, { name: 'Profile', fallback: 'loading' }, createElement(Reader)),
        createElement(Suspense, { name: 'Chart', fallback: 'loading' }, createElement(LazyChart)),
      ),
    )
    await settle()

    const pending = await read()
    expect(pending.capability).toEqual({
      asyncDebugInfo: 'partial',
      reason: 'react-19.0-19.1',
      reactVersion: '19.1.1',
      bundle: 'development',
    })
    expect(pending.coverage.complete).toBe(false)
    const [profileBoundary, chartBoundary] = pending.boundaries
    expect(profileBoundary?.state).toBe('fallback')
    expect(profileBoundary?.blockers).toHaveLength(1)
    expect(profileBoundary?.blockers[0]).toMatchObject({
      kind: 'unknown',
      kindEvidence: 'unknown',
      basis: 'tracked-thenable-without-debug-info',
      status: 'pending',
      name: 'loadProfile',
      startMs: null,
      pendingForMs: null,
    })
    expect(chartBoundary?.blockers[0]).toMatchObject({
      kind: 'lazy',
      kindEvidence: 'exact',
      phase: 'pending',
      startMs: null,
    })

    resolveProfile('ada')
    loadChart({ default: () => createElement('figure', null, 'chart') })
    await settle(400)

    const revealed = await read()
    const [profileContent, chartContent] = revealed.boundaries
    expect(profileContent?.blockers[0]).toMatchObject({
      kind: 'use',
      kindEvidence: 'exact',
      basis: 'use-thenable-state',
      phase: 'awaited-by-content',
      status: 'fulfilled',
      name: 'loadProfile',
      startMs: null,
      durationMs: null,
      awaitedBy: { name: 'Reader' },
    })
    expect(chartContent?.blockers[0]).toMatchObject({
      kind: 'lazy',
      basis: 'lazy-type',
      status: 'fulfilled',
      durationMs: null,
      location: null,
    })
  })
})
