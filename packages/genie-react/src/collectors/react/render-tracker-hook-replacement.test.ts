import type { FiberRoot, InstrumentationOptions } from 'bippy'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  currentHook: { name: 'initial', renderers: new Map<number, object>() },
  hookLookupError: false,
  safe: true,
  installations: [] as Array<{
    hook: object
    options: InstrumentationOptions
    disposed: boolean
  }>,
}))

vi.mock('bippy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('bippy')>()
  return {
    ...actual,
    getRDTHook: () => {
      if (harness.hookLookupError) throw new Error('hook lookup failed')
      return harness.currentHook
    },
    instrument: (_options: InstrumentationOptions) => {
      const installation = {
        hook: harness.currentHook,
        options: _options,
        disposed: false,
      }
      harness.installations.push(installation)
      const dispose = () => {
        installation.disposed = true
      }
      return Object.assign(dispose, { [Symbol.dispose]: dispose })
    },
    traverseRenderedFibers: () => {},
  }
})

vi.mock('./refresh-tracker', () => ({
  isRefreshCommit: () => false,
  noteExcludedRefreshCommit: () => {},
}))

vi.mock('./safe-instrumentation', () => ({
  isSafeRenderer: () => harness.safe,
  supportedCommitHandler: <T extends (...args: never[]) => unknown>(handler: T) => handler,
}))

import { openMeasurementSpan, readMeasurementSpan } from './measurement-spans'

import {
  clearRenders,
  disposeRenderTracking,
  getCommitCount,
  renderCollectionStatus,
  startRenderTracking,
} from './render-tracker'

beforeEach(() => {
  disposeRenderTracking()
  harness.currentHook = { name: 'initial', renderers: new Map() }
  harness.hookLookupError = false
  harness.safe = true
  harness.installations.length = 0
})

afterEach(() => disposeRenderTracking())

describe('React DevTools hook replacement', () => {
  it('reinstalls commit instrumentation when profiling resumes on a replacement hook', () => {
    startRenderTracking()
    const initialInstallation = harness.installations[0]

    harness.currentHook = { name: 'replacement', renderers: new Map() }
    startRenderTracking()

    expect(initialInstallation?.disposed).toBe(true)
    expect(harness.installations).toHaveLength(2)
    expect(harness.installations[1]?.hook).toBe(harness.currentHook)

    clearRenders()
    harness.installations[1]?.options.onCommitFiberRoot?.(1, {
      current: { child: null },
    } as FiberRoot)
    expect(getCommitCount()).toBe(1)
  })

  it('disposes stale instrumentation and can recover after hook lookup fails', () => {
    startRenderTracking()
    const initialInstallation = harness.installations[0]

    harness.hookLookupError = true
    expect(startRenderTracking()).toBe(false)
    expect(initialInstallation?.disposed).toBe(true)

    harness.hookLookupError = false
    expect(startRenderTracking()).toBe(true)
    expect(harness.installations).toHaveLength(2)
  })
})

it('retains late-hook collection proof across clear and resets it only when the hook changes', () => {
  harness.currentHook.renderers.set(1, {})
  clearRenders()
  startRenderTracking()
  expect(renderCollectionStatus()).toMatch(/^unavailable/)
  harness.installations[0]?.options.onCommitFiberRoot?.(1, {
    current: { child: null },
  } as FiberRoot)
  expect(renderCollectionStatus()).toMatch(/^degraded/)
  clearRenders()
  expect(getCommitCount()).toBe(0)
  expect(renderCollectionStatus()).toMatch(/^degraded/)
  harness.currentHook = { name: 'replacement', renderers: new Map([[1, {}]]) }
  startRenderTracking()
  expect(renderCollectionStatus()).toMatch(/^unavailable/)
})

it('marks the newest open span incomplete for an excluded renderer before its first owned commit', async () => {
  clearRenders()
  startRenderTracking()
  const older = openMeasurementSpan('older')
  harness.installations[0]?.options.onCommitFiberRoot?.(1, {
    current: { child: null },
  } as FiberRoot)
  const newer = openMeasurementSpan('newer')
  harness.safe = false
  harness.installations[0]?.options.onCommitFiberRoot?.(2, {
    current: { child: null },
  } as FiberRoot)
  const query = { sort: 'renders' as const, appOnly: false, limit: 20 }
  expect((await readMeasurementSpan(newer.handle, true, query)).coverage.complete).toBe(false)
  expect((await readMeasurementSpan(older.handle, true, query)).coverage.complete).toBe(true)
})
