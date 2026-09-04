import type { Fiber, ReactRenderer } from 'bippy'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactCollector } from './collector'
import { reactGetRendersContract, reactProfileReportContract } from './contracts'
import { getMeasurementEnvironment } from './measurement-environment'
import { clearRenders, recordRender } from './render-tracker'

const mocks = vi.hoisted(() => ({
  renderers: new Map<number, ReactRenderer>(),
  unavailable: false,
}))
vi.mock('bippy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('bippy')>()),
  getRDTHook: () => {
    if (mocks.unavailable) throw new Error('hook unavailable')
    return { renderers: mocks.renderers }
  },
}))

beforeEach(() => {
  clearRenders()
  mocks.renderers.clear()
  mocks.unavailable = false
})

describe('measurement environment', () => {
  it.each([
    { types: [1], bundle: 'development' },
    { types: [0], bundle: 'production' },
    { types: [1, 1], bundle: 'development' },
    { types: [0, 1], bundle: 'mixed' },
    { types: [], bundle: 'unknown' },
    { types: [1, 2], bundle: 'unknown' },
  ])('reports $bundle for renderer bundle types $types', ({ types, bundle }) => {
    types.forEach((bundleType, index) => {
      mocks.renderers.set(index, { bundleType } as ReactRenderer)
    })
    expect(getMeasurementEnvironment()).toEqual({
      bundle,
      timingsBundleDependent: true,
      countsScope: 'observed-run',
    })
  })

  it('keeps missing hook evidence unknown instead of using the Genie build mode', () => {
    mocks.unavailable = true
    expect(getMeasurementEnvironment().bundle).toBe('unknown')
  })

  it.each([
    reactGetRendersContract,
    reactProfileReportContract,
  ])('preserves renderer metadata in the $name wire contract', async (contract) => {
    mocks.renderers.set(1, { bundleType: 0 } as ReactRenderer)
    const tool = reactCollector().tools?.find(
      (candidate) => candidate.contract.name === contract.name,
    )
    if (!tool) throw new Error(`Missing ${contract.name}`)
    const result = contract.output.parse(
      await tool.handler(contract.input.parse({}) as never, {
        pushSnapshot() {},
        pushEvent() {},
        refreshTools() {},
        markActivity() {},
      }),
    )
    expect(result).toMatchObject({
      bundle: 'production',
      timingsBundleDependent: true,
      countsScope: 'observed-run',
    })
  })
})

it('keeps the original bundle metadata on later cursor pages', async () => {
  mocks.renderers.set(1, { bundleType: 1 } as ReactRenderer)
  for (const name of ['First', 'Second']) {
    const type = () => null
    Object.assign(type, { displayName: name })
    recordRender(
      {
        tag: 0,
        type,
        memoizedProps: {},
        memoizedState: null,
        alternate: null,
        child: null,
      } as unknown as Fiber,
      'update',
    )
  }
  const tool = reactCollector().tools?.find(
    (candidate) => candidate.contract.name === 'react_get_renders',
  )
  if (!tool) throw new Error('Missing render report tool')
  const read = async (args: unknown) =>
    reactGetRendersContract.output.parse(
      await tool.handler(reactGetRendersContract.input.parse(args) as never, {
        pushSnapshot() {},
        pushEvent() {},
        refreshTools() {},
        markActivity() {},
      }),
    )
  const first = await read({ appOnly: false, limit: 1 })
  expect(first.bundle).toBe('development')
  if (!first.nextCursor) throw new Error('Expected next page')
  mocks.renderers.set(1, { bundleType: 0 } as ReactRenderer)
  const second = await read({ cursor: first.nextCursor, limit: 1 })
  expect(second).toMatchObject({
    bundle: 'development',
    timingsBundleDependent: true,
    countsScope: 'observed-run',
  })
  expect((await read({ appOnly: false, limit: 1 })).bundle).toBe('production')
})
