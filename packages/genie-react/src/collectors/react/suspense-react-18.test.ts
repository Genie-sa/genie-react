// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { instrument } from 'bippy'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createElement,
  createRoot,
  lazy,
  Suspense,
  startTransition,
  useState,
  version,
} from '../../../../../apps/react-18-fixture/index.js'
import { noteCommittedRoot } from './fiber'
import { getSuspenseReport } from './suspense-boundaries'
import { reactSuspenseContract } from './suspense-contract'

instrument({ onCommitFiberRoot: (_rendererId, root) => noteCommittedRoot(root) })

const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms))

const host = document.createElement('div')
host.id = 'root'
document.body.append(host)
const root = createRoot(host)
afterAll(() => root.unmount())

describe('react_suspense on React 18', () => {
  it('lists boundaries and their state but reports blockers as unavailable, never guessed', async () => {
    expect(version).toBe('18.3.1')
    let loadChart!: (module: { default: () => unknown }) => void
    const LazyChart = lazy(
      () =>
        new Promise((resolve) => {
          loadChart = resolve
        }),
    )
    let showNext!: () => void
    function App(): unknown {
      const [next, setNext] = useState(false)
      showNext = () => startTransition(() => setNext(true))
      return createElement(
        'main',
        null,
        createElement(Suspense, { fallback: 'loading chart' }, createElement(LazyChart)),
        createElement(
          Suspense,
          { fallback: 'loading next' },
          next ? createElement(LazyChart) : 'current',
        ),
      )
    }
    root.render(createElement(App))
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

    expect(report.capability).toEqual({
      asyncDebugInfo: 'unavailable',
      reason: 'react-before-19',
      reactVersion: '18.3.1',
      bundle: 'development',
    })
    expect(report.boundaries.map((boundary) => boundary.state)).toEqual(['fallback', 'content'])
    expect(report.boundaries.every((boundary) => boundary.blockerStatus === 'unavailable')).toBe(
      true,
    )
    expect(report.boundaries.flatMap((boundary) => boundary.blockers)).toEqual([])
    expect(report.coverage.complete).toBe(false)
    expect(report.waitingHint).toContain('react-before-19')

    showNext()
    await settle()
    const held = await getSuspenseReport({
      waitingOnly: true,
      limit: 20,
      blockerLimit: 10,
      includeSource: false,
      appOnly: false,
      view: 'summary',
    })
    expect(host.textContent).toContain('current')
    expect(held.boundaries.map((boundary) => boundary.state).sort()).toEqual([
      'fallback',
      'transition-pending',
    ])

    loadChart({ default: () => createElement('figure', null, 'chart') })
    await settle(400)
    const loaded = await getSuspenseReport({
      waitingOnly: false,
      limit: 20,
      blockerLimit: 10,
      includeSource: false,
      appOnly: false,
      view: 'summary',
    })
    expect(loaded.boundaries.map((boundary) => boundary.state)).toEqual(['content', 'content'])
    expect(loaded.boundaries.every((boundary) => boundary.blockers.length === 0)).toBe(true)
  })
})
