// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { createRequire } from 'node:module'
import { instrument } from 'bippy'
import { createElement, type ReactNode, Suspense, use } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { noteCommittedRoot } from './fiber'
import { getSuspenseReport, type SuspenseQuery } from './suspense-boundaries'
import { reactSuspenseContract, type SuspenseReport } from './suspense-contract'

instrument({ onCommitFiberRoot: (_rendererId, root) => noteCommittedRoot(root) })

const FULL: SuspenseQuery = {
  waitingOnly: false,
  limit: 50,
  blockerLimit: 50,
  includeSource: false,
  appOnly: false,
  view: 'full',
}
const settle = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))

type ReactModule = typeof import('react')
type ReactDomClient = typeof import('react-dom/client')

/** A second, production copy of React beside the development one, as Next.js runs its dev overlay: fresh module instances, so it registers its own renderer with bundleType 0. */
function loadProductionCopy(): { React: ReactModule; ReactDOMClient: ReactDomClient } {
  const require = createRequire(import.meta.url)
  const cached = Object.keys(require.cache).filter((path) =>
    /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(path),
  )
  const saved = new Map(cached.map((path) => [path, require.cache[path]]))
  for (const path of cached) delete require.cache[path]
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    return { React: require('react'), ReactDOMClient: require('react-dom/client') }
  } finally {
    process.env.NODE_ENV = previous
    for (const [path, module] of saved) require.cache[path] = module
  }
}

const production = loadProductionCopy()
const roots: Array<{ unmount: () => void; host: HTMLElement }> = []

afterEach(() => {
  for (const { unmount, host } of roots.splice(0)) {
    unmount()
    host.remove()
  }
})

function host(id?: string): HTMLElement {
  const element = document.createElement('div')
  if (id) element.id = id
  document.body.append(element)
  return element
}

function mountDevelopment(element: ReactNode): void {
  const container = host('root')
  const root: Root = createRoot(container)
  root.render(element)
  roots.push({ unmount: () => root.unmount(), host: container })
}

function mountProduction(build: (React: ReactModule) => ReactNode): void {
  const container = host()
  const root = production.ReactDOMClient.createRoot(container)
  root.render(build(production.React))
  roots.push({ unmount: () => root.unmount(), host: container })
}

const timedRead = Object.assign(Promise.resolve('orders'), {
  status: 'fulfilled' as const,
  value: 'orders',
  _debugInfo: [{ awaited: { name: 'loadOrders', start: 10, end: 60, value: undefined } }],
})

function Orders(): ReactNode {
  return createElement('p', null, use(timedRead))
}

/** The rule an agent follows from the skill: check capability first. It must never say "unavailable" beside blockers it did return, and a boundary reports unavailable exactly when its own root has no debug information. */
function expectCapabilityAgreesWithContent(report: SuspenseReport): void {
  const withBlockers = report.boundaries.filter((boundary) => boundary.blockers.length > 0)
  if (withBlockers.length > 0) expect(report.capability.asyncDebugInfo).not.toBe('unavailable')
  if (report.capability.asyncDebugInfo === 'available') {
    expect(report.boundaries.every((boundary) => boundary.blockerStatus !== 'unavailable')).toBe(
      true,
    )
  }
  for (const boundary of report.boundaries) {
    if (boundary.blockerStatus === 'unavailable') expect(boundary.blockers).toEqual([])
  }
}

describe('react_suspense capability beside a second React copy', () => {
  it('describes the development root that holds the boundaries, not a production overlay root without any', async () => {
    mountDevelopment(
      createElement(Suspense, { name: 'Orders', fallback: 'loading' }, createElement(Orders)),
    )
    mountProduction((React) => React.createElement('aside', null, 'dev overlay'))
    await settle()

    const report = await getSuspenseReport(FULL)
    reactSuspenseContract.output.parse(report)

    expect(report.capability).toMatchObject({
      asyncDebugInfo: 'available',
      bundle: 'development',
      reason: null,
    })
    expect(report.boundaries).toHaveLength(1)
    expect(report.boundaries[0]?.blockers[0]).toMatchObject({ name: 'loadOrders', durationMs: 50 })
    expectCapabilityAgreesWithContent(report)
  })

  it('is partial, not unavailable, when production and development roots both hold boundaries', async () => {
    mountDevelopment(
      createElement(Suspense, { name: 'Orders', fallback: 'loading' }, createElement(Orders)),
    )
    mountProduction((React) =>
      React.createElement(React.Suspense, { name: 'Widget', fallback: 'w' }, 'widget content'),
    )
    await settle()

    const report = await getSuspenseReport(FULL)
    reactSuspenseContract.output.parse(report)

    expect(report.capability).toMatchObject({
      asyncDebugInfo: 'partial',
      reason: 'some-roots-without-debug-info',
    })
    const byName = new Map(report.boundaries.map((boundary) => [boundary.name, boundary]))
    expect(byName.get('Orders')?.blockers).toHaveLength(1)
    expect(byName.get('Widget')).toMatchObject({ blockerStatus: 'unavailable', blockers: [] })
    expect(report.coverage.complete).toBe(false)
    expectCapabilityAgreesWithContent(report)
  })

  it('stays unavailable when the only boundaries live in a production root', async () => {
    mountProduction((React) =>
      React.createElement(React.Suspense, { name: 'Widget', fallback: 'w' }, 'widget content'),
    )
    mountDevelopment(createElement('main', null, 'no boundaries here'))
    await settle()

    const report = await getSuspenseReport(FULL)
    reactSuspenseContract.output.parse(report)

    expect(report.capability).toMatchObject({
      asyncDebugInfo: 'unavailable',
      reason: 'production-build',
    })
    expectCapabilityAgreesWithContent(report)
  })
})
