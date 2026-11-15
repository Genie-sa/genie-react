// @vitest-environment jsdom
import './hook'
import { Component, createElement, type ReactNode, Suspense, useEffect, useState } from 'react'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  byText,
  click,
  type MountedApp,
  mount,
  startCollector,
  unmountAll,
} from '../../test-support/react-app'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

interface CaughtError {
  boundaryId: number
  boundaryName: string
  boundaryKind: 'error-boundary' | 'root'
  throwingComponent: string | null
  message: string | null
  forced: boolean
  status: 'active' | 'unknown'
  statusReason: string
  rendered: { output: string; hostNodes: number; text: string | null }
}

interface ErrorState {
  caughtErrors: CaughtError[]
  suspended: { boundaryName: string; forced: boolean }[]
  blankTreeHint: string | null
}

const genie = startCollector()

const errorState = () =>
  genie.call<ErrorState>('react_error_state', { appOnly: false, includeSource: false })

const caught = async () =>
  (await errorState()).caughtErrors.map(({ boundaryName, message, throwingComponent, status }) => ({
    boundaryName,
    message,
    throwingComponent,
    status,
  }))

let failure: string | null = 'first failure'

function Unstable(): ReactNode {
  if (failure) throw new Error(failure)
  return createElement('span', null, 'content')
}

class RetryBoundary extends Component<
  { children?: ReactNode; fallback?: () => ReactNode },
  { error: Error | null }
> {
  override state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }
  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      this.props.fallback?.() ??
      createElement(
        'button',
        { type: 'button', onClick: () => this.setState({ error: null }) },
        'retry',
      )
    )
  }
}

function Page({ children }: { children: ReactNode }): ReactNode {
  const [tick, setTick] = useState(0)
  return createElement(
    'main',
    null,
    createElement('button', { type: 'button', onClick: () => setTick(tick + 1) }, `tick ${tick}`),
    children,
  )
}

beforeEach(async () => {
  failure = 'first failure'
  await genie.call('react_clear_renders', {})
})
afterEach(async () => {
  await genie.call('react_reset_overrides', {})
  await unmountAll()
})
afterAll(() => genie.stop())

describe('caught render errors', () => {
  let app: MountedApp

  beforeEach(async () => {
    app = await mount(
      createElement(Page, null, createElement(RetryBoundary, null, createElement(Unstable))),
    )
  })

  it('reports the boundary, thrower and message that React logged', async () => {
    expect(app.container.textContent).toBe('tick 0retry')
    expect(await caught()).toEqual([
      {
        boundaryName: 'RetryBoundary',
        message: 'first failure',
        throwingComponent: 'Unstable',
        status: 'active',
      },
    ])
  })

  it('keeps reporting a fallback that is still on screen after unrelated re-renders', async () => {
    await click(byText(app.container, 'tick 0'))
    await click(byText(app.container, 'tick 1'))

    expect(app.container.textContent).toBe('tick 2retry')
    expect(await caught()).toEqual([expect.objectContaining({ status: 'active' })])
    expect((await errorState()).blankTreeHint).toContain('first failure')
  })

  it('keeps a caught error across react_clear_renders, which starts a new observation', async () => {
    await genie.call('react_clear_renders', {})

    expect(app.container.textContent).toBe('tick 0retry')
    expect(await caught()).toEqual([expect.objectContaining({ message: 'first failure' })])
  })

  it('reports a healthy screen once the boundary recovers', async () => {
    failure = null
    await click(byText(app.container, 'retry'))

    expect(app.container.textContent).toBe('tick 0content')
    expect(await errorState()).toMatchObject({ caughtErrors: [], blankTreeHint: null })
  })

  it('reports the latest error, not an older one from the same boundary', async () => {
    failure = 'second failure'
    await click(byText(app.container, 'retry'))

    expect(app.container.textContent).toBe('tick 0retry')
    expect(await caught()).toEqual([expect.objectContaining({ message: 'second failure' })])
  })
})

describe('what a boundary renders in place of a caught error', () => {
  const fallbackOf = async (fallback: () => ReactNode) => {
    await mount(
      createElement(
        Page,
        null,
        createElement(RetryBoundary, { fallback }, createElement(Unstable)),
      ),
    )
    return errorState()
  }

  it('reports a boundary that swallows the error by rendering no element as rendering nothing', async () => {
    const state = await fallbackOf(() => false)

    expect(state.caughtErrors).toEqual([
      expect.objectContaining({
        boundaryName: 'RetryBoundary',
        rendered: { output: 'nothing', hostNodes: 0, text: null },
      }),
    ])
    expect(state.blankTreeHint).toMatch(/renders nothing in its place/)
  })

  it('reports a boundary that shows a message as visible, quoting the text', async () => {
    const state = await fallbackOf(() =>
      createElement('section', null, createElement('p', null, 'Reviews are unavailable')),
    )

    expect(state.caughtErrors[0]?.rendered).toEqual({
      output: 'visible',
      hostNodes: 1,
      text: 'Reviews are unavailable',
    })
    expect(state.blankTreeHint).toMatch(/shows "Reviews are unavailable" instead/)
  })

  it('reports elements with no text and no size as empty, not as a visible fallback', async () => {
    const state = await fallbackOf(() => createElement('div', { className: 'spacer' }))

    expect(state.caughtErrors[0]?.rendered).toEqual({ output: 'empty', hostNodes: 1, text: null })
  })
})

describe('errors outside render', () => {
  it('reports errors thrown by an effect and by a cleanup', async () => {
    function EffectThrows(): ReactNode {
      useEffect(() => {
        throw new Error('effect failure')
      }, [])
      return null
    }
    const effectApp = await mount(createElement(RetryBoundary, null, createElement(EffectThrows)))
    expect(effectApp.container.textContent).toBe('retry')
    expect(await caught()).toEqual([
      expect.objectContaining({ message: 'effect failure', status: 'active' }),
    ])
    await effectApp.unmount()

    function CleanupThrows(): ReactNode {
      useEffect(
        () => () => {
          throw new Error('cleanup failure')
        },
        [],
      )
      return null
    }
    function Toggle(): ReactNode {
      const [shown, setShown] = useState(true)
      return createElement(
        'div',
        null,
        createElement('button', { type: 'button', onClick: () => setShown(false) }, 'hide'),
        shown ? createElement(CleanupThrows) : null,
      )
    }
    const cleanupApp = await mount(createElement(RetryBoundary, null, createElement(Toggle)))
    await click(byText(cleanupApp.container, 'hide'))
    expect(cleanupApp.container.textContent).toBe('retry')
    expect(await caught()).toEqual([expect.objectContaining({ message: 'cleanup failure' })])
  })

  it('reports nothing for an event handler error, which leaves the UI rendered', async () => {
    function Handler(): ReactNode {
      return createElement(
        'button',
        {
          type: 'button',
          onClick: () => {
            throw new Error('handler failure')
          },
        },
        'press',
      )
    }
    const app = await mount(createElement(RetryBoundary, null, createElement(Handler)))
    const swallow = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener('error', swallow)
    try {
      await click(byText(app.container, 'press')).catch(() => {})
    } finally {
      window.removeEventListener('error', swallow)
    }

    expect(app.container.textContent).toBe('press')
    expect(await errorState()).toMatchObject({ caughtErrors: [], blankTreeHint: null })
  })
})

describe('nested and failing boundaries', () => {
  class Outer extends RetryBoundary {}
  class Inner extends RetryBoundary {}

  it('reports only the inner boundary that is showing its fallback', async () => {
    const app = await mount(
      createElement(
        Outer,
        null,
        createElement('p', null, 'outer content'),
        createElement(Inner, null, createElement(Unstable)),
      ),
    )

    expect(app.container.textContent).toBe('outer contentretry')
    expect((await caught()).map(({ boundaryName }) => boundaryName)).toEqual(['Inner'])
  })

  it('reports the outer boundary when the inner fallback itself throws', async () => {
    function BrokenFallback(): ReactNode {
      throw new Error('fallback failure')
    }
    const app = await mount(
      createElement(
        Outer,
        null,
        createElement(
          Inner,
          { fallback: () => createElement(BrokenFallback) },
          createElement(Unstable),
        ),
      ),
    )

    expect(app.container.textContent).toBe('retry')
    expect(await caught()).toEqual([
      expect.objectContaining({ boundaryName: 'Outer', message: 'fallback failure' }),
    ])
  })

  it('reports nothing when React recovers by retrying the render', async () => {
    let attempts = 0
    function FlakyOnce(): ReactNode {
      attempts += 1
      if (attempts === 1) throw new Error('transient failure')
      return createElement('span', null, 'recovered')
    }
    const app = await mount(createElement(RetryBoundary, null, createElement(FlakyOnce)))

    expect(app.container.textContent).toBe('recovered')
    expect((await errorState()).caughtErrors).toEqual([])
  })
})

describe('uncaught errors', () => {
  it('reports a root that an uncaught error emptied, then clears it once the root renders again', async () => {
    const app = await mount(createElement('span', null, 'before'))
    await expect(app.render(createElement(Unstable))).rejects.toThrow('first failure')
    expect(app.container.textContent).toBe('')
    const [rootError, ...others] = (await errorState()).caughtErrors
    expect(others).toEqual([])
    expect(rootError).toMatchObject({ boundaryKind: 'root', status: 'active' })
    expect((await errorState()).blankTreeHint).toContain('no error boundary')

    failure = null
    await app.render(createElement(Unstable))
    expect(app.container.textContent).toBe('content')
    expect((await errorState()).caughtErrors).toEqual([])
  })
})

describe('Suspense', () => {
  it('reports a showing fallback and drops it once the content resolves', async () => {
    let resolve: () => void = () => {}
    let ready = false
    const pending = new Promise<void>((done) => {
      resolve = () => {
        ready = true
        done()
      }
    })
    function Slow(): ReactNode {
      if (!ready) throw pending
      return createElement('span', null, 'loaded')
    }
    const app = await mount(
      createElement(
        Suspense,
        { fallback: createElement('i', null, 'loading') },
        createElement(Slow),
      ),
    )
    expect(app.container.textContent).toBe('loading')
    expect((await errorState()).suspended).toEqual([
      expect.objectContaining({ boundaryName: 'Suspense', forced: false }),
    ])

    await genie.call('react_clear_renders', {})
    expect((await errorState()).suspended).toHaveLength(1)

    await act(async () => {
      resolve()
      await pending
    })
    expect(app.container.textContent).toBe('loaded')
    expect((await errorState()).suspended).toEqual([])
  })
})

describe('react_force_error_boundary', () => {
  it('reports the forced state and leaves no residue after reset', async () => {
    failure = null
    const app = await mount(createElement(RetryBoundary, null, createElement(Unstable)))
    const { matches } = await genie.call<{ matches: { id: number; name: string }[] }>(
      'react_find_components',
      { component: 'Unstable' },
    )
    const target = matches.find((match) => match.name === 'Unstable')
    if (!target) throw new Error('Unstable is not mounted')

    await act(async () => {
      await genie.call('react_force_error_boundary', { id: target.id, forceError: true })
    })
    expect(app.container.textContent).toBe('retry')
    expect((await errorState()).caughtErrors).toEqual([
      expect.objectContaining({ boundaryName: 'RetryBoundary', forced: true, status: 'active' }),
    ])

    await act(async () => {
      await genie.call('react_reset_overrides', {})
    })
    expect(app.container.textContent).toBe('content')
    expect(await errorState()).toMatchObject({
      caughtErrors: [],
      suspended: [],
      blankTreeHint: null,
    })
  })
})
