// @vitest-environment jsdom
import './hook'
import { createElement, lazy, type ReactNode, Suspense, useState } from 'react'
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

interface HideLog {
  hides: {
    documentCommitId: number
    boundaryName: string
    forced: boolean
    hiddenTargets: { componentName: string; mountId: string }[]
    hiddenScanComplete: boolean
  }[]
  complete: boolean
}

const genie = startCollector()

let loadPage: () => void = () => {}

function lazyPage() {
  return lazy(
    () =>
      new Promise<{ default: () => ReactNode }>((resolve) => {
        loadPage = () => resolve({ default: () => createElement('h1', null, 'settings') })
      }),
  )
}

let SettingsPage = lazyPage()

function TopBar(): ReactNode {
  return createElement('header', null, 'top bar')
}

function Shell({ initialPage = 'board' }: { initialPage?: string }): ReactNode {
  const [page, setPage] = useState(initialPage)
  return createElement(
    Suspense,
    { fallback: null },
    createElement(TopBar),
    createElement('button', { type: 'button', onClick: () => setPage('settings') }, 'open'),
    page === 'settings' ? createElement(SettingsPage) : createElement('p', null, 'board'),
  )
}

async function windowStart(args: Record<string, unknown> = { component: 'TopBar' }) {
  return (await genie.call<{ documentCommitId: number }>('react_clear_renders', args))
    .documentCommitId
}

const hideLog = async (afterDocumentCommitId: number) =>
  (
    await genie.call<{ hideLog?: HideLog }>('react_error_state', {
      appOnly: false,
      includeSource: false,
      afterDocumentCommitId,
    })
  ).hideLog

const topBarHidden = () => app.container.querySelector('header')?.style.display === 'none'

let app: MountedApp

beforeEach(async () => {
  SettingsPage = lazyPage()
  app = await mount(createElement(Shell))
})
afterEach(async () => {
  await genie.call('react_reset_overrides', {})
  await unmountAll()
})
afterAll(() => genie.stop())

describe('Suspense hide log', () => {
  it('keeps a hide whose fallback resolved before the read, naming the target it hid', async () => {
    const start = await windowStart()
    await click(byText(app.container, 'open'))
    expect(topBarHidden()).toBe(true)
    await act(async () => {
      loadPage()
      await Promise.resolve()
    })

    const log = await hideLog(start)
    expect(topBarHidden()).toBe(false)
    expect(log).toMatchObject({
      complete: true,
      hides: [
        {
          boundaryName: 'Suspense',
          forced: false,
          hiddenScanComplete: true,
          hiddenTargets: [{ componentName: 'TopBar', mountId: expect.any(String) }],
        },
      ],
    })
    expect(log?.hides[0]?.documentCommitId).toBeGreaterThan(start)
  })

  it('names no instance when the window targets no hidden component', async () => {
    const start = await windowStart({})
    await click(byText(app.container, 'open'))

    expect((await hideLog(start))?.hides).toEqual([
      expect.objectContaining({ hiddenTargets: [], hiddenScanComplete: true }),
    ])
  })

  it('excludes hides committed before the window', async () => {
    await click(byText(app.container, 'open'))
    const start = await windowStart()

    expect(await hideLog(start)).toMatchObject({ complete: true, hides: [] })
  })

  it('does not count a boundary that mounts in its fallback, since it hid nothing', async () => {
    await unmountAll()
    const start = await windowStart()
    app = await mount(createElement(Shell, { initialPage: 'settings' }))

    expect(app.container.textContent).toBe('')
    expect(await hideLog(start)).toMatchObject({ complete: true, hides: [] })
  })

  it('records a hide while profiling is paused, since a fallback is on screen', async () => {
    const { documentCommitId: stoppedAt } = await genie.call<{ documentCommitId: number }>(
      'react_profile_stop',
      {},
    )
    await click(byText(app.container, 'open'))

    expect((await hideLog(stoppedAt))?.hides).toEqual([
      expect.objectContaining({ boundaryName: 'Suspense', forced: false }),
    ])
  })

  it('marks a fallback forced by react_toggle_suspense_fallback', async () => {
    const start = await windowStart()
    const topBar = await genie.call<{ matches: { id: number }[] }>('react_find_components', {
      component: 'TopBar',
    })
    await act(async () => {
      await genie.call('react_toggle_suspense_fallback', { id: topBar.matches[0]?.id })
    })

    expect((await hideLog(start))?.hides).toEqual([expect.objectContaining({ forced: true })])
  })

  it('omits the hide log unless a window start is given', async () => {
    expect(
      await genie.call('react_error_state', { appOnly: false, includeSource: false }),
    ).not.toHaveProperty('hideLog')
  })
})
