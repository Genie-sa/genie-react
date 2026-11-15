// @vitest-environment jsdom
import './hook'
import { Component, createElement, type ReactNode, useState } from 'react'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
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

interface CatchLog {
  catches: {
    boundaryName: string
    boundaryKind: string
    forced: boolean
    message: string | null
    documentCommitId: number
  }[]
  complete: boolean
  incompleteReasons: string[]
}

interface ErrorState {
  caughtErrors: { boundaryName: string }[]
  catchLog?: CatchLog
}

const genie = startCollector()

let failure: string | null = null

function Unstable(): ReactNode {
  if (failure) throw new Error(failure)
  return createElement('span', null, 'content')
}

class ResettingBoundary extends Component<{ children?: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }
  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return createElement(
      'button',
      {
        type: 'button',
        onClick: () => {
          failure = null
          this.setState({ error: null })
        },
      },
      'retry',
    )
  }
}

function Screen(): ReactNode {
  const [broken, setBroken] = useState(false)
  if (broken) failure = 'save failed'
  return createElement(
    'main',
    null,
    createElement('button', { type: 'button', onClick: () => setBroken(true) }, 'save'),
    createElement(ResettingBoundary, null, createElement(Unstable, { key: String(broken) })),
  )
}

async function windowStart(): Promise<number> {
  return (await genie.call<{ documentCommitId: number }>('react_clear_renders', {}))
    .documentCommitId
}

const errorState = (afterDocumentCommitId?: number) =>
  genie.call<ErrorState>('react_error_state', {
    appOnly: false,
    includeSource: false,
    ...(afterDocumentCommitId === undefined ? {} : { afterDocumentCommitId }),
  })

let app: MountedApp

beforeEach(async () => {
  failure = null
  app = await mount(createElement(Screen))
})
afterEach(async () => {
  await genie.call('react_reset_overrides', {})
  await unmountAll()
})
afterAll(() => genie.stop())

describe('boundary catch log', () => {
  it('keeps a catch that the boundary reset before the window was read', async () => {
    const start = await windowStart()
    await click(byText(app.container, 'save'))
    await click(byText(app.container, 'retry'))

    const state = await errorState(start)
    expect(app.container.textContent).toBe('savecontent')
    expect(state.caughtErrors).toEqual([])
    expect(state.catchLog).toMatchObject({
      complete: true,
      catches: [{ boundaryName: 'ResettingBoundary', forced: false, message: 'save failed' }],
    })
    expect(state.catchLog?.catches[0]?.documentCommitId).toBeGreaterThan(start)
  })

  it('excludes catches committed before the window', async () => {
    await click(byText(app.container, 'save'))
    const start = await windowStart()

    expect((await errorState(start)).catchLog).toMatchObject({ complete: true, catches: [] })
  })

  it('records a catch while profiling is paused, since the boundary is on screen', async () => {
    const { documentCommitId: stoppedAt } = await genie.call<{ documentCommitId: number }>(
      'react_profile_stop',
      {},
    )
    await click(byText(app.container, 'save'))

    const state = await errorState(stoppedAt)
    expect(state.caughtErrors).toEqual([
      expect.objectContaining({ boundaryName: 'ResettingBoundary' }),
    ])
    expect(state.catchLog?.catches.map((entry) => entry.message)).toEqual(['save failed'])
  })

  it('records a catch even when the analysis budget skipped the boundary fiber', async () => {
    const start = (
      await genie.call<{ documentCommitId: number }>('react_clear_renders', {
        budget: { fiberLimit: 50, operationLimit: 1_000, adaptive: false },
      })
    ).documentCommitId
    await click(byText(app.container, 'save'))

    expect((await errorState(start)).catchLog?.catches).toEqual([
      expect.objectContaining({ boundaryName: 'ResettingBoundary', forced: false }),
    ])
  })

  it('omits the catch log unless a window start is given', async () => {
    expect(await errorState()).not.toHaveProperty('catchLog')
  })
})
