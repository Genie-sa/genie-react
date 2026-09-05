import type { Fiber } from 'bippy'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  beginMeasurementCommit,
  clearMeasurementSpans,
  markMeasurementIncomplete,
  openMeasurementSpan,
  readMeasurementSpan,
} from './measurement-spans'
import { noteDocumentCommit, resetObservationStateForTests } from './observation'
import { clearRenders, getRendersMeasurement, recordRender } from './render-tracker'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

function component(name: string): Fiber {
  return {
    tag: 0,
    type: Object.assign(() => null, { displayName: name }),
    memoizedProps: {},
    memoizedState: null,
    actualDuration: 2,
    child: null,
    alternate: { memoizedProps: {}, memoizedState: null },
  } as unknown as Fiber
}
function commit(fiber: Fiber) {
  beginMeasurementCommit(noteDocumentCommit(), true)
  recordRender(fiber, 'update')
}
const query = { sort: 'renders' as const, appOnly: false, limit: 200 }
beforeEach(() => {
  clearMeasurementSpans()
  clearRenders()
  resetObservationStateForTests()
})
afterEach(() => {
  clearMeasurementSpans()
  vi.useRealTimers()
})

it('keeps concurrent handles disjoint and resumes the older owner when the newer closes', async () => {
  const counter = component('Counter')
  commit(counter)
  const a = openMeasurementSpan('route A')
  commit(counter)
  const b = openMeasurementSpan('route B')
  commit(counter)
  const middle = await readMeasurementSpan(a.handle, false, query)
  expect(middle.commitIds).toEqual([2])
  expect(middle.excludedCommits).toBe(1)
  const closed = await readMeasurementSpan(b.handle, true, query)
  commit(counter)
  const older = await readMeasurementSpan(a.handle, true, query)
  expect(older).toMatchObject({ label: 'route A', commitIds: [2, 4], summary: { totalUpdates: 2 } })
  expect(closed).toMatchObject({ label: 'route B', commitIds: [3], summary: { totalUpdates: 1 } })
  expect(older.commitIds.filter((id) => closed.commitIds.includes(id))).toEqual([])
  expect((await getRendersMeasurement(query)).summary.totalUpdates).toBe(4)
  expect((await readMeasurementSpan(b.handle, true, query)).commitIds).toEqual([3])
})

it('global clear preserves owned evidence and delta counts across the reset', async () => {
  const counter = component('Counter')
  const a = openMeasurementSpan('clear across span')
  commit(counter)
  clearRenders()
  commit(counter)
  const result = await readMeasurementSpan(a.handle, true, query)
  expect(result.commitIds).toEqual([1, 2])
  expect(result.components[0]).toMatchObject({ updates: 2, renders: 2 })
  expect((await getRendersMeasurement(query)).summary.totalUpdates).toBe(1)
})

it('a read freezes counts before asynchronous source lookup while capture continues', async () => {
  const counter = component('Counter')
  const a = openMeasurementSpan('snapshot')
  commit(counter)
  const reading = readMeasurementSpan(a.handle, false, query)
  commit(counter)
  expect((await reading).summary.totalUpdates).toBe(1)
  expect((await readMeasurementSpan(a.handle, false, query)).summary.totalUpdates).toBe(2)
})

it('refuses to call incomplete or paused collection exact', async () => {
  const a = openMeasurementSpan('budget')
  commit(component('Counter'))
  markMeasurementIncomplete()
  expect((await readMeasurementSpan(a.handle, true, query)).coverage).toEqual({
    complete: false,
    semantics: 'lower-bound',
  })
  const b = openMeasurementSpan('paused')
  beginMeasurementCommit(noteDocumentCommit(), false)
  expect((await readMeasurementSpan(b.handle, true, query)).summary.semantics).toBe('unknown')
})

it('expires handles at the deadline and rejects excess open spans without stealing ownership', async () => {
  vi.useFakeTimers()
  const a = openMeasurementSpan('first')
  for (let i = 1; i < 20; i++) openMeasurementSpan(String(i))
  expect(() => openMeasurementSpan('overflow')).toThrow('20 measurement spans')
  vi.advanceTimersByTime(5 * 60_000 - 1)
  expect((await readMeasurementSpan(a.handle, false, query)).label).toBe('first')
  vi.advanceTimersByTime(1)
  await expect(readMeasurementSpan(a.handle, false, query)).rejects.toThrow('expired')
  expect(openMeasurementSpan('new').handle).not.toBe(a.handle)
})

it('caps retained components and commits with explicit incomplete coverage', async () => {
  const a = openMeasurementSpan('bounded')
  beginMeasurementCommit(noteDocumentCommit(), true)
  for (let i = 0; i < 501; i++) recordRender(component(`Row${i}`), 'update')
  const counter = component('Counter')
  for (let i = 1; i < 1001; i++) commit(counter)
  const result = await readMeasurementSpan(a.handle, false, query)
  expect(result.commitIds).toHaveLength(1000)
  expect(result.endedAtDocumentCommitId).toBe(1000)
  expect(result.summary.trackedComponents).toBe(500)
  expect(result.coverage.complete).toBe(false)
})

it('teardown invalidates handles instead of associating a new document with old labels', async () => {
  const a = openMeasurementSpan('old document')
  clearMeasurementSpans()
  await expect(readMeasurementSpan(a.handle, false, query)).rejects.toThrow('invalidated')
})
