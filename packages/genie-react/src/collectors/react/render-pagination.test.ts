import type { Fiber } from 'bippy'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSource = vi.fn(async (fiber: { _debugSource?: unknown }) => fiber._debugSource ?? null)
vi.mock('bippy/source', () => ({
  getSource: (fiber: { _debugSource?: unknown }) => getSource(fiber),
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
  getSourceMap: async () => null,
  getSourceFromSourceMap: () => null,
}))

const { clearRenders, getRendersMeasurement, recordRender } = await import('./render-tracker')
const { clearSourceCache } = await import('./source')
const { noteDocumentCommit } = await import('./observation')

function cursorFor(report: { nextCursor: string | null }): string {
  if (!report.nextCursor) throw new Error('Expected another report page')
  return report.nextCursor
}

function row(name: string, library = false): Fiber {
  const type = () => null
  Object.assign(type, { displayName: name })
  return {
    tag: 0,
    type,
    memoizedProps: {},
    memoizedState: null,
    child: null,
    alternate: null,
    actualDuration: 1,
    selfBaseDuration: 1,
    _debugSource: {
      fileName: library ? '/node_modules/library/Row.tsx' : `/src/${name}.tsx`,
      lineNumber: 1,
      columnNumber: 0,
    },
  } as unknown as Fiber
}

beforeEach(() => {
  clearRenders()
  getSource.mockClear()
  vi.stubGlobal('fetch', async () => ({ ok: false }))
})
afterEach(() => {
  clearSourceCache()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('render report selection and pagination', () => {
  it('applies name patterns, exclusions, and minimum updates before the result cap', async () => {
    recordRender(row('RowMountOnly'), 'mount')
    recordRender(row('RowHidden'), 'update')
    recordRender(row('Unrelated'), 'update')
    recordRender(row('RowLibrary', true), 'update')
    recordRender(row('RowA'), 'update')
    recordRender(row('RowB'), 'update')
    const first = await getRendersMeasurement({
      sort: 'renders',
      limit: 1,
      appOnly: true,
      nameFilter: 'row*',
      excludeNames: ['*hidden*'],
      minUpdates: 1,
    })
    expect(first.components.map((component) => component.name)).toEqual(['RowA'])
    expect(first.summary.trackedComponents).toBe(2)
    expect(first.omittedByLimit).toBe(1)
    expect(first.nextCursor).toEqual(expect.any(String))
    const second = await getRendersMeasurement({
      sort: 'renders',
      limit: 1,
      cursor: cursorFor(first),
    })
    expect(second.components.map((component) => component.name)).toEqual(['RowB'])
    expect(second.nextCursor).toBeNull()
    expect(second.omittedByLimit).toBe(0)
  })

  it('pages a frozen app-owned set without duplicates or gaps while commits arrive', async () => {
    vi.useFakeTimers()
    const fibers = Array.from({ length: 241 }, (_, index) => row(`AppRow${index}`))
    for (const fiber of fibers) recordRender(fiber, 'update')
    recordRender(row('LibraryRow', true), 'update')
    await getRendersMeasurement({ sort: 'renders', limit: 200, appOnly: true })
    await vi.runAllTimersAsync()
    const first = await getRendersMeasurement({ sort: 'renders', limit: 200, appOnly: true })
    expect(first.sourceClassification).toMatchObject({ complete: true, app: 241, library: 1 })
    expect(first.components).toHaveLength(200)
    expect(first.nextCursor).toEqual(expect.any(String))
    noteDocumentCommit()
    const moved = fibers[240]
    if (!moved) throw new Error('Expected final row')
    recordRender(moved, 'update')
    recordRender(row('NewRow'), 'update')
    const second = await getRendersMeasurement({
      sort: 'renders',
      limit: 200,
      cursor: cursorFor(first),
    })
    expect(second.components).toHaveLength(41)
    expect(second.components.every((component) => component.updates === 1)).toBe(true)
    const all = [...first.components, ...second.components]
    expect(new Set(all.map((component) => component.id)).size).toBe(241)
    expect(all.map((component) => component.name)).toEqual(
      fibers.map((_, index) => `AppRow${index}`),
    )
    expect(second.summary).toEqual(first.summary)
    expect(second.documentCommitId).toBe(first.documentCommitId)
    expect(second.sourceClassification).toEqual(first.sourceClassification)
    expect(second.nextCursor).toBeNull()
  })
})

describe('render cursor lifecycle and bounded retention', () => {
  async function firstPage() {
    return getRendersMeasurement({ sort: 'renders', limit: 1, appOnly: false })
  }

  beforeEach(() => {
    recordRender(row('First'), 'update')
    recordRender(row('Second'), 'update')
  })

  it('replays the same cursor without exposing mutable retained report objects', async () => {
    const first = await firstPage()
    const query = { sort: 'renders' as const, limit: 1, cursor: cursorFor(first) }
    const second = await getRendersMeasurement(query)
    const returnedRow = second.components[0]
    if (!returnedRow) throw new Error('Expected second row')
    returnedRow.updates = 999
    second.summary.totalUpdates = 999
    const replay = await getRendersMeasurement(query)
    expect(replay.components).toMatchObject([{ name: 'Second', updates: 1 }])
    expect(replay.summary.totalUpdates).toBe(2)
    expect(replay.appOnly).toBe(false)
  })

  it('keeps an active cursor through repeated one-shot reads with honest summary totals', async () => {
    const first = await firstPage()
    for (let index = 0; index < 5; index += 1) {
      const poll = await getRendersMeasurement({
        sort: 'renders',
        limit: 1,
        appOnly: false,
        includeCursor: false,
      })
      expect(poll.components).toHaveLength(1)
      expect(poll.omittedByLimit).toBe(1)
      expect(poll.summary.trackedComponents).toBe(2)
      expect(poll.nextCursor).toBeNull()
      expect(poll.pagination).toMatchObject({
        snapshotId: null,
        totalComponents: 2,
        expiresAt: null,
      })
    }
    const next = await getRendersMeasurement({
      sort: 'renders',
      limit: 1,
      cursor: cursorFor(first),
    })
    expect(next.components).toMatchObject([{ name: 'Second', updates: 1 }])
  })

  it('expires at the declared deadline without sliding expiry on access', async () => {
    vi.useFakeTimers()
    const first = await firstPage()
    const query = { sort: 'renders' as const, limit: 1, cursor: cursorFor(first) }
    const expiresAt = first.pagination.expiresAt
    if (expiresAt === null) throw new Error('Expected expiring cursor')
    vi.setSystemTime(expiresAt - 1)
    expect((await getRendersMeasurement(query)).components).toHaveLength(1)
    vi.setSystemTime(expiresAt)
    await expect(getRendersMeasurement(query)).rejects.toThrow('expired')
  })

  it('evicts the oldest paginated snapshot after three retained reports', async () => {
    const oldest = await firstPage()
    const retained = await firstPage()
    await firstPage()
    await firstPage()
    await expect(
      getRendersMeasurement({ sort: 'renders', limit: 1, cursor: cursorFor(oldest) }),
    ).rejects.toThrow('evicted')
    expect(
      (await getRendersMeasurement({ sort: 'renders', limit: 1, cursor: cursorFor(retained) }))
        .components,
    ).toHaveLength(1)
  })

  it('invalidates existing and in-flight paginated reports when profiling resets', async () => {
    const first = await firstPage()
    const pending = firstPage()
    clearRenders()
    await expect(pending).rejects.toThrow('cleared while preparing')
    await expect(
      getRendersMeasurement({ sort: 'renders', limit: 1, cursor: cursorFor(first) }),
    ).rejects.toThrow('cleared')
  })

  it.each([
    'invalid',
    '00000000-0000-4000-8000-000000000000:1',
  ])('rejects an invalid or unknown cursor', async (cursor) => {
    await expect(getRendersMeasurement({ sort: 'renders', limit: 1, cursor })).rejects.toThrow(
      'Run react_get_renders without cursor',
    )
  })

  it('allows 5000 candidates and rejects overflow before inspecting sources', async () => {
    vi.useFakeTimers()
    clearRenders()
    for (let index = 0; index < 5000; index += 1) recordRender(row(`Row${index}`), 'update')
    const atLimit = await getRendersMeasurement({ sort: 'renders', limit: 200, appOnly: false })
    expect(atLimit.pagination.totalComponents).toBe(5000)
    expect(atLimit.omittedByLimit).toBe(4800)
    recordRender(row('Overflow'), 'update')
    getSource.mockClear()
    await expect(
      getRendersMeasurement({ sort: 'renders', limit: 200, appOnly: false }),
    ).rejects.toThrow('Narrow component, nameFilter, excludeNames, or minUpdates')
    expect(getSource).not.toHaveBeenCalled()
    const narrowed = await getRendersMeasurement({
      sort: 'renders',
      limit: 200,
      appOnly: false,
      nameFilter: 'Row?',
    })
    expect(narrowed.components).toHaveLength(10)
    expect(narrowed.nextCursor).toBeNull()
  })
})

describe('selection coverage', () => {
  it('filters irrelevant records before spending the source classification budget', async () => {
    for (let index = 0; index < 130; index += 1) recordRender(row(`Ignored${index}`), 'update')
    recordRender(row('Selected'), 'update')
    const selected = await getRendersMeasurement({
      sort: 'renders',
      limit: 1,
      appOnly: true,
      nameFilter: 'Selected',
    })
    expect(selected.components).toMatchObject([{ name: 'Selected' }])
    expect(selected.sourceClassification).toMatchObject({
      complete: true,
      totalCandidates: 1,
      evaluated: 1,
    })
  })

  it('treats regex characters literally while supporting whole-name wildcards', async () => {
    recordRender(row('A[1]Row'), 'update')
    recordRender(row('A1Row'), 'update')
    const selected = await getRendersMeasurement({
      sort: 'renders',
      limit: 10,
      appOnly: false,
      nameFilter: 'a[1]*',
    })
    expect(selected.components.map((component) => component.name)).toEqual(['A[1]Row'])
  })

  it('keeps partial ownership frozen until a new report is requested after warmup', async () => {
    vi.useFakeTimers()
    for (let index = 0; index < 241; index += 1) recordRender(row(`App${index}`), 'update')
    const cold = await getRendersMeasurement({ sort: 'renders', limit: 100, appOnly: true })
    expect(cold.sourceClassification).toMatchObject({ complete: false, app: 120, unknown: 121 })
    await vi.runAllTimersAsync()
    const continuation = await getRendersMeasurement({
      sort: 'renders',
      limit: 100,
      cursor: cursorFor(cold),
    })
    expect(continuation.components).toHaveLength(20)
    expect(continuation.sourceClassification).toEqual(cold.sourceClassification)
    expect(continuation.nextCursor).toBeNull()
    const fresh = await getRendersMeasurement({ sort: 'renders', limit: 200, appOnly: true })
    expect(fresh.sourceClassification).toMatchObject({ complete: true, app: 241, unknown: 0 })
    expect(fresh.omittedByLimit).toBe(41)
  })
})
