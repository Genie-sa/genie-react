// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { instrument } from 'bippy'
import { afterAll, describe, expect, it } from 'vitest'
import { noteCommittedRoot } from './fiber'
import { getSuspenseReport } from './suspense-boundaries'
import { reactSuspenseContract } from './suspense-contract'

instrument({ onCommitFiberRoot: (_rendererId, root) => noteCommittedRoot(root) })

const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms))

async function loadProductionReact() {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    const React = await import('react')
    const ReactDOMClient = await import('react-dom/client')
    return { React, ReactDOMClient }
  } finally {
    process.env.NODE_ENV = previous
  }
}

const unmounts: Array<() => void> = []
afterAll(() => {
  for (const unmount of unmounts) unmount()
})

describe('react_suspense on a production React build', () => {
  it('reports the boundary state but no blockers, with production-build as the reason', async () => {
    const { React, ReactDOMClient } = await loadProductionReact()
    const host = document.createElement('div')
    host.id = 'root'
    document.body.append(host)
    const root = ReactDOMClient.createRoot(host)
    unmounts.push(() => root.unmount())
    const pending = new Promise<string>(() => {})
    function Reader(): React.ReactNode {
      return React.createElement('span', null, React.use(pending))
    }
    root.render(
      React.createElement(React.Suspense, { fallback: 'loading' }, React.createElement(Reader)),
    )
    await settle()

    const report = await getSuspenseReport({
      waitingOnly: false,
      limit: 20,
      blockerLimit: 10,
      includeSource: false,
      appOnly: false,
      view: 'full',
    })
    reactSuspenseContract.output.parse(report)

    expect(host.textContent).toBe('loading')
    expect(report.capability).toMatchObject({
      asyncDebugInfo: 'unavailable',
      reason: 'production-build',
      bundle: 'production',
    })
    expect(report.boundaries).toHaveLength(1)
    expect(report.boundaries[0]).toMatchObject({
      state: 'fallback',
      blockerStatus: 'unavailable',
      blockers: [],
    })
  })
})
