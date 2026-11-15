// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { act, createElement as h, memo, type ReactNode, useCallback, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { CaptureArtifact, CaptureComparison, ToolDescriptor } from '../protocol'
import { reactCollectorHarness } from '../test-support/react-collector'
import { CaptureManager, type CaptureSession } from './capture-manager'

// The Next.js dev overlay renders through its own production React; loading react-dom's production client beside the development one reproduces that page.
const require = createRequire(import.meta.url)
const productionClient: { createRoot: (container: Element) => Root } = require(
  join(dirname(require.resolve('react-dom/package.json')), 'cjs/react-dom-client.production.js'),
)

const { call, start, stop } = reactCollectorHarness()

const viewInput = { type: 'object', properties: { view: { type: 'string' } } }
const session: CaptureSession = {
  sessionId: 'live',
  app: { name: 'live', reactVersion: '19' },
  tools: ['react_get_renders', 'react_render_causes', 'react_profile_report'].map(
    (name): ToolDescriptor => ({
      name,
      title: name,
      description: name,
      group: 'react',
      inputJsonSchema: viewInput,
    }),
  ),
}

const captures = new CaptureManager({
  resolveSession: () => ({ session, standIn: false }),
  sessionUnavailable: () => ({ errorCode: 'unknown-session', error: 'no session' }),
  isCurrentSession: () => true,
  request: async (_session, tool, args) => {
    try {
      return { ok: true, result: await call(tool, args) }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  },
})

// Renders only its children, so its own code says nothing about who owns it: ownership stays unknown, like the dashboard's PermissionGate.
function Gate({ children }: { children: ReactNode }) {
  return children
}

const Row = memo(function Row({ label }: { label: string; onPick: () => void }) {
  return h('li', null, label)
})

const LABELS = ['a', 'b', 'c', 'd']
let refresh: () => void = () => {}

/** The shipped table hands each memoized row a new handler on every render; the fix keeps one. */
function table({ stableHandler, gated }: { stableHandler: boolean; gated: boolean }) {
  return function Table() {
    const [tick, setTick] = useState(0)
    refresh = () => setTick((value) => value + 1)
    const stable = useCallback(() => {}, [])
    const children = [
      h('output', { key: 'tick' }, tick),
      ...LABELS.map((label) =>
        h(Row, { key: label, label, onPick: stableHandler ? stable : () => {} }),
      ),
    ]
    return gated ? h(Gate, null, children) : h('section', null, children)
  }
}

const ShippedTable = table({ stableHandler: false, gated: true })
const FixedTable = table({ stableHandler: true, gated: true })
const UngatedTable = table({ stableHandler: true, gated: false })

let app: Root | undefined
let overlay: Root | undefined
let overlayCommits = 0

async function mount(table: () => ReactNode): Promise<void> {
  await act(async () => app?.unmount())
  const container = document.createElement('div')
  document.body.append(container)
  app = createRoot(container)
  await act(async () => app?.render(h(table)))
}

/** One run as an agent would take it: open a window, change the table, capture. */
async function cohort(
  name: string,
  table: () => ReactNode,
  { overlayCommits: commitOverlay = false } = {},
): Promise<string[]> {
  await mount(table)
  const ids: string[] = []
  for (let run = 0; run < 6; run += 1) {
    await call('react_clear_renders', {})
    await act(async () => refresh())
    if (commitOverlay) {
      overlayCommits += 1
      await act(async () => overlay?.render(h('span', null, `issue ${overlayCommits}`)))
    }
    const created = await captures.invoke('devtools_capture_create', {
      name: `${name}-${run}`,
      include: ['react'],
      view: 'full',
    })
    if (!created.ok) throw new Error(created.error)
    ids.push((created.result as CaptureArtifact).captureId)
  }
  return ids
}

async function compare(
  baselineCaptureIds: string[],
  candidateCaptureIds: string[],
  budgets: { metric: 'react.renders'; maxRegressionPct: number }[] = [],
): Promise<CaptureComparison> {
  const compared = await captures.invoke('devtools_capture_compare', {
    baselineCaptureIds,
    candidateCaptureIds,
    metrics: ['react.renders', 'react.updates', 'react.commits'],
    budgets,
  })
  if (!compared.ok) throw new Error(compared.error)
  return compared.result as CaptureComparison
}

const metric = (comparison: CaptureComparison, name: string) =>
  comparison.metrics.find((entry) => entry.metric === name)

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  start()
  const container = document.createElement('div')
  document.body.append(container)
  overlay = productionClient.createRoot(container)
})

afterEach(() => captures.clear())

afterAll(async () => {
  await act(async () => app?.unmount())
  await act(async () => overlay?.unmount())
  stop()
})

describe('capture comparison on a page like the realistic apps', () => {
  it('proves a row re-render fix although a gate has unknown ownership and a production overlay committed', async () => {
    const shipped = await cohort('shipped', ShippedTable, { overlayCommits: true })
    const fixed = await cohort('fixed', FixedTable)

    const comparison = await compare(shipped, fixed, [
      { metric: 'react.renders', maxRegressionPct: 0 },
    ])

    expect(comparison.notComparableReasons).toEqual([])
    expect(metric(comparison, 'react.renders')).toMatchObject({
      comparable: true,
      verdict: 'pass',
      baseline: { samples: 5, median: 6 },
      candidate: { samples: 5, median: 2 },
      confidence: { significant: true },
    })
    expect(metric(comparison, 'react.updates')).toMatchObject({ comparable: true })
    expect(metric(comparison, 'react.commits')).toMatchObject({
      comparable: true,
      baseline: { median: 1 },
      candidate: { median: 1 },
    })
    expect(comparison.overall).toBe('pass')
    expect(comparison.warnings).toEqual([
      expect.stringContaining('React renderer Genie does not analyze'),
      expect.stringMatching(
        /^Ownership of Gate \(.*capture-comparison-live\.test\.ts\) is unknown/,
      ),
    ])
  })

  it('finds no change between two cohorts of the same build', async () => {
    const first = await cohort('first', ShippedTable, { overlayCommits: true })
    const second = await cohort('second', ShippedTable)

    const comparison = await compare(first, second)

    expect(comparison.overall).toBe('informational')
    for (const name of ['react.renders', 'react.updates', 'react.commits']) {
      expect(metric(comparison, name)).toMatchObject({
        comparable: true,
        delta: { median: 0, regressionPct: 0 },
        reasons: [expect.stringMatching(/^no significant change/)],
      })
    }
  })

  it('refuses component totals when the cohorts count different unknown-ownership components', async () => {
    const gated = await cohort('gated', FixedTable)
    const ungated = await cohort('ungated', UngatedTable)

    const comparison = await compare(gated, ungated, [
      { metric: 'react.renders', maxRegressionPct: 0 },
    ])

    expect(comparison.overall).toBe('not-comparable')
    expect(metric(comparison, 'react.renders')).toMatchObject({
      comparable: false,
      notComparableReasons: ['unknown-ownership-differs-between-captures'],
    })
    expect(metric(comparison, 'react.commits')).toMatchObject({ comparable: true })
  })
})
