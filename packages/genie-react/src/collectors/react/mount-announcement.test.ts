// @vitest-environment jsdom
import 'bippy/install-hook-only'
import { cleanup, render } from '@testing-library/react'
import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext } from '../../client'
import { reactCollector } from './collector'
import { forgetCommittedRoots } from './fiber'
import { setCommitListener } from './render-tracker'

function startCollector() {
  const refreshTools = vi.fn()
  const context: CollectorContext = {
    pushSnapshot() {},
    pushEvent() {},
    refreshTools,
    markActivity() {},
  }
  const collector = reactCollector()
  const dispose = collector.start?.(context) || undefined
  return { collector, refreshTools, dispose }
}

let dispose: (() => void) | undefined

afterEach(() => {
  cleanup()
  dispose?.()
  dispose = undefined
  forgetCommittedRoots()
  vi.useRealTimers()
})

describe('React mount announcement', () => {
  it('reports no mounted tree before the app renders, then re-announces once it commits', async () => {
    const started = startCollector()
    dispose = started.dispose
    expect(started.collector.appInfo?.()).toMatchObject({ reactMounted: false })

    act(() => {
      render(createElement('main', null, 'app'))
    })
    await vi.waitFor(() => expect(started.refreshTools).toHaveBeenCalledTimes(1))
    expect(started.collector.appInfo?.()).toMatchObject({ reactMounted: true })

    act(() => {
      render(createElement('main', null, 'again'))
    })
    await Promise.resolve()
    expect(started.refreshTools).toHaveBeenCalledTimes(1)
  })

  it('does not re-announce a tree that was already mounted when the collector started', async () => {
    act(() => {
      render(createElement('main', null, 'app'))
    })
    const started = startCollector()
    dispose = started.dispose
    expect(started.collector.appInfo?.()).toMatchObject({ reactMounted: true })

    act(() => {
      render(createElement('main', null, 'update'))
    })
    await Promise.resolve()
    expect(started.refreshTools).not.toHaveBeenCalled()
  })

  it('finds a tree whose commits never reach the collector by polling the page', () => {
    vi.useFakeTimers()
    const started = startCollector()
    dispose = started.dispose
    setCommitListener(null)

    act(() => {
      render(createElement('main', null, 'app'))
    })
    expect(started.refreshTools).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(started.refreshTools).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(started.refreshTools).toHaveBeenCalledTimes(1)
  })
})
