import type { Fiber } from 'bippy'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type DevRenderer, overrideFiberProps, resetOverrides } from './overrides'
import { defaultWorkTags } from './work-tags'

const mocks = vi.hoisted(() => ({
  owner: null as DevRenderer | null,
  injected: [] as DevRenderer[],
}))

// Only renderer discovery is faked; every other bippy helper stays real.
vi.mock('bippy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('bippy')>()),
  getRenderer: () => mocks.owner,
  getRDTHook: () => ({ renderers: new Map(mocks.injected.map((r, i) => [i, r])) }),
}))

const recordingRenderer = (): DevRenderer & { propsCalls: unknown[] } => {
  const propsCalls: unknown[] = []
  return {
    propsCalls,
    scheduleUpdate: () => {},
    overrideProps: (fiber, path, value) => void propsCalls.push([fiber, path, value]),
  }
}

const fiber = (): Fiber =>
  ({
    tag: defaultWorkTags.FunctionComponent,
    type: function Component() {},
    return: null,
    child: null,
    sibling: null,
    alternate: null,
    stateNode: null,
    flags: 0,
    memoizedProps: { title: 'before' },
  }) as unknown as Fiber

afterEach(() => {
  resetOverrides(recordingRenderer())
  mocks.owner = null
  mocks.injected = []
})

describe('renderer selection', () => {
  it("drives the fiber's own renderer rather than the first injected one", () => {
    const other = recordingRenderer()
    const owner = recordingRenderer()
    mocks.injected = [other, owner]
    mocks.owner = owner

    overrideFiberProps(fiber(), { title: 'after' })

    expect(owner.propsCalls).toHaveLength(1)
    expect(other.propsCalls).toHaveLength(0)
  })

  it('falls back to the first capable renderer when no renderer claims the fiber', () => {
    const fallback = recordingRenderer()
    mocks.injected = [fallback]
    mocks.owner = null

    overrideFiberProps(fiber(), { title: 'after' })

    expect(fallback.propsCalls).toHaveLength(1)
  })

  it('skips an owning renderer that lacks the capability', () => {
    const capable = recordingRenderer()
    mocks.owner = { scheduleUpdate: () => {} }
    mocks.injected = [capable]

    overrideFiberProps(fiber(), { title: 'after' })

    expect(capable.propsCalls).toHaveLength(1)
  })

  it('throws when no renderer can drive overrides', () => {
    mocks.owner = null
    mocks.injected = []

    expect(() => overrideFiberProps(fiber(), { title: 'after' })).toThrow(/does not expose/)
  })
})
