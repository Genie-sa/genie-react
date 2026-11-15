import type { Fiber, RenderPhase } from 'bippy'
import type { HooksNode } from 'bippy/source'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Effect } from './bippy-compat'
import { getEffectScheduleEvents } from './effect-events'
import {
  clearEffects,
  getEffectAuditReport,
  getEffectTrackingCoverage,
  prepareEffect,
  recordEffect,
  removeEffectRecord,
} from './effect-tracker'
import { clearSourceCache } from './source'

const getEffectAudit = async (query: Parameters<typeof getEffectAuditReport>[0]) =>
  (await getEffectAuditReport(query)).components

// Fake fibers carry no owned elements, so their ownership stays unknown and survives appOnly; per-test getFiberHooks trees drive per-effect attribution.
const inspector = vi.hoisted(() => ({
  getFiberHooks: vi.fn<(fiber: unknown) => HooksNode[]>(() => []),
  symbolicateStack: vi.fn<(frames: unknown[]) => Promise<unknown[]>>(async (frames) => frames),
}))
vi.mock('bippy/source', () => ({
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: inspector.getFiberHooks,
  symbolicateStack: inspector.symbolicateStack,
}))

/** A leaf hook node as bippy's inspector reports it, before symbolication. */
const hookNode = (
  name: string,
  fileName: string | null,
  line: number | null,
  subHooks: HooksNode[] = [],
  id: number | null = null,
): HooksNode => ({
  id,
  isStateEditable: false,
  name,
  value: null,
  subHooks,
  debugInfo: null,
  hookSource: fileName ? { fileName, lineNumber: line, columnNumber: 0, functionName: null } : null,
})

// React's hook effect tag bits.
const HAS_EFFECT = 0b0001
const LAYOUT = 0b0100
const PASSIVE = 0b1000

const asFiber = (shape: unknown): Fiber => shape as Fiber

interface EffectSpec {
  tag: number
  deps: unknown[] | null
  /** React 18.3+/19 store the cleanup at effect.inst.destroy. */
  cleanup?: boolean
  /** Legacy (<18.3) cleanup location: effect.destroy directly. */
  legacyDestroy?: boolean
}

/** A fiber's hook-backed effects: React's circular `lastEffect` list plus the hook chain whose slots hold the same effect objects. */
function effectHooks(specs: EffectSpec[]): {
  updateQueue: { lastEffect: Effect | null }
  memoizedState: unknown
} {
  const lastEffect = effectList(specs)
  const nodes: Effect[] = []
  for (let node = lastEffect?.next ?? null; node && nodes.length < specs.length; node = node.next) {
    nodes.push(node)
  }
  const memoizedState = nodes.reduceRight<unknown>(
    (next, effect) => ({ memoizedState: effect, next }),
    null,
  )
  return { updateQueue: { lastEffect }, memoizedState }
}

/** Build a circular effect linked-list and return its `lastEffect` (whose `.next` is the first). */
function effectList(specs: EffectSpec[]): Effect | null {
  if (specs.length === 0) return null
  const nodes = specs.map(
    (spec) =>
      ({
        tag: spec.tag,
        deps: spec.deps,
        create: () => {},
        inst: { destroy: spec.cleanup ? () => {} : undefined },
        destroy: spec.legacyDestroy ? () => {} : null,
        next: null,
      }) as unknown as Effect,
  )
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node) node.next = nodes[(i + 1) % nodes.length] ?? null
  }
  return nodes[nodes.length - 1] ?? null
}

// One fiber whose identity (hence bippy id) is stable across commits; the effect list and alternate are mutated per commit, as React reuses fibers.
function makeComponent(
  name: string,
  source?: { fileName: string; lineNumber: number; columnNumber: number },
) {
  const type = (): null => null
  Object.assign(type, { displayName: name })
  const fiber = {
    tag: 0,
    type,
    updateQueue: { lastEffect: null },
    alternate: null,
    _debugSource: source,
  } as Record<string, unknown>
  return {
    fiber: asFiber(fiber),
    commit(phase: RenderPhase, effects: EffectSpec[], prevEffects?: EffectSpec[]) {
      Object.assign(fiber, effectHooks(effects))
      fiber.alternate = prevEffects ? effectHooks(prevEffects) : null
      return recordEffect(asFiber(fiber), phase)
    },
  }
}

const byName = async () => new Map((await getEffectAudit({ limit: 50 })).map((r) => [r.name, r]))

beforeEach(() => {
  clearEffects()
  clearSourceCache()
  // Default: the inspector throws, so effects stay unattributed and unfiltered; per-effect tests override getFiberHooks.
  inspector.getFiberHooks.mockReset().mockImplementation(() => {
    throw new Error('inspector unavailable in test')
  })
  inspector.symbolicateStack.mockImplementation(async (frames) => frames)
  // No network in unit tests: inline-map lookup fails → per-effect source keeps served coordinates.
  vi.stubGlobal('fetch', () => Promise.reject(new Error('no network in tests')))
})
afterEach(() => vi.unstubAllGlobals())

describe('recordEffect dependency-mode classification', () => {
  it('keeps simulated traversal unmounts but removes exact DevTools unmounts', async () => {
    const component = makeComponent('UnmountedEffect')
    component.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [] }])

    component.commit('unmount', [])
    expect((await getEffectAudit({ limit: 50 })).map((record) => record.name)).toContain(
      'UnmountedEffect',
    )

    removeEffectRecord(component.fiber)
    expect((await getEffectAudit({ limit: 50 })).map((record) => record.name)).not.toContain(
      'UnmountedEffect',
    )
  })

  it('keeps prepared effect stats and events private until publication', async () => {
    const component = makeComponent('AtomicEffect')
    Object.assign(component.fiber, effectHooks([{ tag: PASSIVE | HAS_EFFECT, deps: [] }]))

    const prepared = prepareEffect(component.fiber, 'mount', 1)
    expect(await getEffectAudit({ limit: 50 })).toEqual([])
    expect(getEffectScheduleEvents({ limit: 10 }).events).toEqual([])

    prepared.publish()
    expect((await getEffectAudit({ limit: 50 })).map((record) => record.name)).toContain(
      'AtomicEffect',
    )
    expect(getEffectScheduleEvents({ limit: 10 }).events).toMatchObject([
      { componentName: 'AtomicEffect', event: 'scheduled' },
    ])
  })

  it('flags a no-deps effect that runs after every render', async () => {
    const c = makeComponent('NoDeps')
    c.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: null }])
    c.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
    )
    c.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
    )
    c.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
    )

    const eff = (await byName()).get('NoDeps')?.effects[0]
    expect(eff?.depsMode).toBe('none')
    expect(eff?.scheduled).toBe(3)
    expect(eff?.schedulesEveryUpdate).toBe(true)
    expect(eff?.fired).toBe(3)
    expect(eff?.updates).toBe(3)
    expect(eff?.firesEveryUpdate).toBe(true)
    expect(eff?.hotness).toMatchObject({
      label: 'hot',
      samples: 3,
      observedRate: 1,
      scheduleReason: 'meets-threshold',
      reason: 'meets-threshold',
    })
    expect(eff?.hotness.confidenceInterval).toMatchObject({ level: 0.95, upper: 1 })
    expect(eff?.note).toMatch(/no dependency array/)
  })

  it('keeps 1/1 as an observation but requires enough samples for a hot diagnosis', async () => {
    const c = makeComponent('OneOfOne')
    c.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: null }])
    c.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
    )

    const defaultFinding = (await byName()).get('OneOfOne')?.effects[0]
    expect(defaultFinding?.firesEveryUpdate).toBe(true)
    expect(defaultFinding?.hotness).toMatchObject({
      label: 'insufficient-data',
      samples: 1,
      minUpdates: 3,
      scheduleReason: 'below-minimum-updates',
      reason: 'below-minimum-updates',
    })
    expect(defaultFinding?.note).toBeUndefined()
    expect(await getEffectAudit({ limit: 50, onlyHot: true })).toEqual([])

    const lowered = await getEffectAudit({ limit: 50, onlyHot: true, minUpdates: 1 })
    expect(lowered[0]?.effects[0]?.hotness.label).toBe('hot')
  })

  it('applies the schedule-rate threshold to an effect without a dependency array', async () => {
    const c = makeComponent('TwoOfThree')
    c.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: null }])
    c.commit('update', [{ tag: PASSIVE | HAS_EFFECT, deps: null }], [{ tag: PASSIVE, deps: null }])
    c.commit('update', [{ tag: PASSIVE, deps: null }], [{ tag: PASSIVE, deps: null }])
    c.commit('update', [{ tag: PASSIVE | HAS_EFFECT, deps: null }], [{ tag: PASSIVE, deps: null }])

    const defaultFinding = (await byName()).get('TwoOfThree')?.effects[0]
    expect(defaultFinding?.hotness).toMatchObject({
      label: 'not-hot',
      basis: 'below-schedule-rate',
      observedRate: 0.6667,
      minScheduleRate: 1,
      minFireRate: 1,
      scheduleReason: 'below-schedule-rate',
      reason: 'below-fire-rate',
    })

    const lowered = await getEffectAudit({
      limit: 50,
      onlyHot: true,
      minScheduleRate: 0.6,
    })
    expect(lowered[0]?.effects[0]?.hotness).toMatchObject({
      label: 'hot',
      basis: 'no-dependency-array',
      minScheduleRate: 0.6,
      minFireRate: 0.6,
    })
  })

  it('does not call an effect hot for re-running whenever a primitive dependency changes value', async () => {
    const c = makeComponent('Clock')
    c.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [0] }])
    for (let tick = 1; tick <= 4; tick += 1) {
      c.commit(
        'update',
        [{ tag: PASSIVE | HAS_EFFECT, deps: [tick] }],
        [{ tag: PASSIVE, deps: [tick - 1] }],
      )
    }

    const finding = (await byName()).get('Clock')?.effects[0]
    expect(finding?.schedulesEveryUpdate).toBe(true)
    expect(finding?.hotness).toMatchObject({
      label: 'not-hot',
      basis: 'value-change-reruns',
      reruns: { valueChanged: 4, referenceOnly: 0, undetermined: 0 },
    })
    expect(
      (await getEffectAudit({ limit: 50, onlyHot: true, minScheduleRate: 0.1 })).map((r) => r.name),
    ).not.toContain('Clock')
  })

  it('calls an effect hot when it keeps re-running on a new object with equal contents, whatever its schedule rate', async () => {
    const c = makeComponent('Quote')
    c.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [{ country: 'NO' }] }])
    for (let keystroke = 0; keystroke < 4; keystroke += 1) {
      c.commit(
        'update',
        [{ tag: PASSIVE | HAS_EFFECT, deps: [{ country: 'NO' }] }],
        [{ tag: PASSIVE, deps: [{ country: 'NO' }] }],
      )
      c.commit(
        'update',
        [{ tag: PASSIVE, deps: [{ country: 'NO' }] }],
        [{ tag: PASSIVE, deps: [{ country: 'NO' }] }],
      )
    }

    const finding = (await byName()).get('Quote')?.effects[0]
    expect(finding?.hotness).toMatchObject({
      label: 'hot',
      basis: 'reference-only-reruns',
      observedRate: 0.5,
      reruns: { valueChanged: 0, referenceOnly: 4, undetermined: 0 },
    })
    expect(finding?.note).toMatch(/dependency \[0\] is a new reference with equal contents/)
  })

  it('withholds a verdict when the changed dependencies are functions it cannot compare', async () => {
    const c = makeComponent('Handler')
    c.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [() => 0] }])
    for (let render = 0; render < 3; render += 1) {
      c.commit(
        'update',
        [{ tag: PASSIVE | HAS_EFFECT, deps: [() => 0] }],
        [{ tag: PASSIVE, deps: [() => 0] }],
      )
    }

    expect((await byName()).get('Handler')?.effects[0]?.hotness).toMatchObject({
      label: 'insufficient-data',
      basis: 'dependency-values-not-compared',
      reruns: { valueChanged: 0, referenceOnly: 0, undetermined: 3 },
    })
  })

  it('does not flag an empty-deps effect (mount only)', async () => {
    const c = makeComponent('Mounted')
    c.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [] }])
    c.commit('update', [{ tag: PASSIVE, deps: [] }], [{ tag: PASSIVE, deps: [] }])

    const eff = (await byName()).get('Mounted')?.effects[0]
    expect(eff?.depsMode).toBe('empty')
    expect(eff?.fired).toBe(0)
    expect(eff?.firesEveryUpdate).toBe(false)
    expect(eff?.note).toBeUndefined()
  })
})

describe('recordEffect dependency-change attribution', () => {
  it('names the dependency slot that drives a re-run every update', async () => {
    const stable = { id: 'stable' }
    const a = {}
    const b = {}
    const c = {}
    const comp = makeComponent('Churn')
    comp.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [stable, a] }])
    comp.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: [stable, b] }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: [stable, a] }],
    )
    comp.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: [stable, c] }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: [stable, b] }],
    )
    comp.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: [stable, {}] }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: [stable, c] }],
    )

    const eff = (await byName()).get('Churn')?.effects[0]
    expect(eff?.fired).toBe(3)
    expect(eff?.firesEveryUpdate).toBe(true)
    expect(eff?.lastChangedDep).toBe(1)
    expect(eff?.hotness).toMatchObject({ label: 'hot', basis: 'reference-only-reruns' })
    expect(eff?.note).toMatch(/dependency \[1\] is a new reference with equal contents/)
  })

  it('does not flag a list-deps effect whose deps stay stable (HasEffect cleared)', async () => {
    const stable = { id: 'stable' }
    const c = makeComponent('Calm')
    c.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [stable] }])
    c.commit('update', [{ tag: PASSIVE, deps: [stable] }], [{ tag: PASSIVE, deps: [stable] }])

    const eff = (await byName()).get('Calm')?.effects[0]
    expect(eff?.fired).toBe(0)
    expect(eff?.firesEveryUpdate).toBe(false)
    expect(eff?.note).toBeUndefined()
  })
})

describe('recordEffect kind + cleanup', () => {
  it('labels a layout effect and detects a cleanup at inst.destroy (React 18.3+/19)', async () => {
    makeComponent('Layout').commit('mount', [{ tag: LAYOUT | HAS_EFFECT, deps: [], cleanup: true }])
    const eff = (await byName()).get('Layout')?.effects[0]
    expect(eff?.kind).toBe('layout')
    expect(eff?.cleanupFunctionObserved).toBe(true)
    expect(eff?.hasCleanup).toBe(true)
  })

  it('detects a cleanup at effect.destroy (legacy React < 18.3)', async () => {
    makeComponent('Legacy').commit('mount', [
      { tag: PASSIVE | HAS_EFFECT, deps: [], legacyDestroy: true },
    ])
    expect((await byName()).get('Legacy')?.effects[0]?.hasCleanup).toBe(true)
  })

  it('reports no cleanup when the effect returns nothing', async () => {
    makeComponent('NoClean').commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [] }])
    expect((await byName()).get('NoClean')?.effects[0]?.hasCleanup).toBe(false)
  })
})

describe('recordEffect tracking lifecycle', () => {
  it('ignores non-function fibers and waits for an exact unmount before eviction', async () => {
    recordEffect(
      asFiber({ tag: 5, updateQueue: { lastEffect: effectList([{ tag: PASSIVE, deps: null }]) } }),
      'update',
    )
    const gone = makeComponent('Gone')
    gone.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: null }])
    expect((await byName()).get('Gone')).toBeDefined()
    gone.commit('unmount', [{ tag: PASSIVE | HAS_EFFECT, deps: null }])
    expect((await byName()).get('Gone')).toBeDefined()
    removeEffectRecord(gone.fiber)
    expect(await getEffectAudit({ limit: 50 })).toEqual([])
  })

  it('onlyHot returns only components with a smell', async () => {
    const stable = { id: 'stable' }
    const calm = makeComponent('Calm')
    calm.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [stable] }])
    calm.commit('update', [{ tag: PASSIVE, deps: [stable] }], [{ tag: PASSIVE, deps: [stable] }])

    const loopy = makeComponent('Loopy')
    loopy.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: null }])
    loopy.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
    )
    loopy.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
    )
    loopy.commit(
      'update',
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
      [{ tag: PASSIVE | HAS_EFFECT, deps: null }],
    )

    expect((await getEffectAudit({ limit: 50, onlyHot: true })).map((r) => r.name)).toEqual([
      'Loopy',
    ])
  })

  it('bounds one component effect list and exposes incomplete tracking coverage', async () => {
    const effects = Array.from({ length: 101 }, () => ({
      tag: PASSIVE | HAS_EFFECT,
      deps: [] as unknown[],
    }))
    const observation = makeComponent('ManyEffects').commit('mount', effects)

    expect(observation).toEqual({ scheduled: 100, complete: false })
    expect(getEffectTrackingCoverage().truncatedEffectLists).toBe(1)
    expect((await byName()).get('ManyEffects')?.effects).toHaveLength(100)
  })

  it('caps total effect findings and reports the omitted total', async () => {
    const effects = Array.from({ length: 100 }, () => ({
      tag: PASSIVE | HAS_EFFECT,
      deps: [] as unknown[],
    }))
    for (let index = 0; index < 6; index += 1) {
      makeComponent(`EffectGroup${index}`).commit('mount', effects)
    }

    const report = await getEffectAuditReport({ limit: 50, appOnly: false })
    expect(report.components.reduce((sum, component) => sum + component.effects.length, 0)).toBe(
      500,
    )
    expect(report.effectsOmittedByLimit).toBe(100)
    expect(report.components.reduce((sum, component) => sum + component.effectsOmitted, 0)).toBe(
      100,
    )
  })
})

describe('per-effect source attribution', () => {
  // One app effect and one effect created inside a library hook (nested subHook): ids are hook slots, as React DevTools' inspector reports them.
  const tree = () => [
    hookNode('Effect', '/src/tree-search.tsx', 99, [], 0),
    hookNode('Translation', '/src/tree-search.tsx', 24, [
      hookNode('Effect', '/node_modules/@tanstack/react-query/build/index.js', 42, [], 1),
    ]),
  ]
  const twoEffects: EffectSpec[] = [
    { tag: PASSIVE | HAS_EFFECT, deps: null },
    { tag: PASSIVE | HAS_EFFECT, deps: [] },
  ]

  it('inspects hooks once per component type, the way React DevTools does on select', async () => {
    inspector.getFiberHooks.mockReturnValue(tree())
    const type = (): null => null
    Object.assign(type, { displayName: 'Row' })
    for (const id of [1, 2]) {
      const fiber = asFiber({
        tag: 0,
        type,
        alternate: null,
        ...effectHooks(twoEffects),
        key: `${id}`,
      })
      recordEffect(fiber, 'mount')
    }

    const rows = (await getEffectAudit({ limit: 50, appOnly: false })).filter(
      (entry) => entry.name === 'Row',
    )

    expect(rows).toHaveLength(2)
    expect(rows.flatMap((row) => row.effects.map((effect) => effect.provenance.ownership))).toEqual(
      ['app', 'library', 'app', 'library'],
    )
    expect(inspector.getFiberHooks).toHaveBeenCalledTimes(1)
  })

  it('attributes each effect to the hook that declared it, with the index and chain react_inspect_component reports', async () => {
    inspector.getFiberHooks.mockReturnValue(tree())
    makeComponent('TreeSearch').commit('mount', twoEffects)

    const rec = (await getEffectAudit({ limit: 50, appOnly: false })).find(
      (r) => r.name === 'TreeSearch',
    )
    expect(rec?.effects[0]).toMatchObject({
      hookIndex: 0,
      hook: 'useEffect',
      customHooks: [],
      source: { line: 99, role: 'hook-callsite' },
      isLibrary: false,
    })
    expect(rec?.effects[0]?.provenance).toMatchObject({
      ownership: 'app',
      evidence: 'exact',
      reason: 'exact-hook-order',
      packageName: null,
      hookAncestry: [],
    })
    expect(rec?.effects[1]).toMatchObject({
      hookIndex: 1,
      customHooks: ['useTranslation'],
      isLibrary: true,
    })
    expect(rec?.effects[1]?.source?.file).toContain('@tanstack/react-query')
    expect(rec?.effects[1]?.provenance).toMatchObject({
      ownership: 'library',
      evidence: 'exact',
      packageName: '@tanstack/react-query',
      hookAncestry: [
        {
          name: 'useTranslation',
          source: { file: '/src/tree-search.tsx', line: 24 },
          ownership: 'app',
          packageName: null,
        },
      ],
    })

    const packageReport = await getEffectAuditReport({
      limit: 50,
      appOnly: false,
      packageName: '@tanstack/react-query',
    })
    expect(packageReport.components).toHaveLength(1)
    expect(packageReport.components[0]?.effects).toHaveLength(1)
    expect(packageReport.packageFilter).toEqual({
      packageName: '@tanstack/react-query',
      matchedEffects: 1,
      excludedEffects: 1,
      unknownPackageEffects: 1,
    })
  })

  it('hides library effects under appOnly and keeps the app effect of the same component', async () => {
    inspector.getFiberHooks.mockReturnValue(tree())
    makeComponent('TreeSearchApp').commit('mount', twoEffects)

    const report = await getEffectAuditReport({ limit: 50, appOnly: true })
    const rec = report.components.find((r) => r.name === 'TreeSearchApp')
    expect(rec?.effects.map((effect) => effect.source?.line)).toEqual([99])
    expect(report.libraryEffectsHidden).toBe(1)
  })

  it('keeps an exact app effect when the component itself resolves to a library chunk', async () => {
    const component = makeComponent('MappedEffectDemo', {
      fileName: '/node_modules/opaque-server-chunk.js',
      lineNumber: 10,
      columnNumber: 0,
    })
    inspector.getFiberHooks.mockReturnValue([hookNode('Effect', '/src/effect-demo.tsx', 11, [], 0)])
    component.commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [] }])

    const record = (await getEffectAudit({ limit: 50 })).find(
      (item) => item.name === 'MappedEffectDemo',
    )

    expect(record?.componentProvenance.ownership).toBe('library')
    expect(record?.effects[0]?.provenance).toMatchObject({
      ownership: 'app',
      evidence: 'exact',
      hookSource: { file: '/src/effect-demo.tsx', line: 11 },
    })
  })

  it('attributes nothing when the inspected hooks do not line up with the mounted ones', async () => {
    inspector.getFiberHooks.mockReturnValue([hookNode('Effect', '/src/a.tsx', 10, [], 0)])
    makeComponent('Mixed').commit('mount', [
      { tag: PASSIVE | HAS_EFFECT, deps: [] },
      { tag: PASSIVE | HAS_EFFECT, deps: [] },
    ])

    const rec = (await getEffectAudit({ limit: 50 })).find((r) => r.name === 'Mixed')
    expect(rec?.effects).toHaveLength(2)
    expect(rec?.effects.every((e) => e.source === null && e.customHooks === null)).toBe(true)
    expect(rec?.effects.every((e) => e.isLibrary === false)).toBe(true)
    expect(rec?.effects.every((e) => e.provenance.ownership === 'unknown')).toBe(true)
    expect(rec?.effects.every((e) => e.provenance.reason === 'hook-count-mismatch')).toBe(true)
  })

  it('falls back to no per-effect source when the inspector throws', async () => {
    inspector.getFiberHooks.mockImplementation(() => {
      throw new Error('ReactDebugToolsRenderError')
    })
    makeComponent('Throws').commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: null }])

    const rec = (await getEffectAudit({ limit: 50, appOnly: false })).find(
      (r) => r.name === 'Throws',
    )
    expect(rec?.effects[0]?.source).toBeNull()
    expect(rec?.effects[0]?.isLibrary).toBe(false)
    expect(rec?.effects[0]?.provenance).toMatchObject({
      ownership: 'unknown',
      evidence: 'unknown',
      reason: 'hook-inspection-unavailable',
    })
  })

  it('keeps an unattributed effect visible under appOnly and hides one whose component is library code', async () => {
    inspector.getFiberHooks.mockImplementation(() => {
      throw new Error('inspector unavailable')
    })
    makeComponent('AppPanel', {
      fileName: '/src/panel.tsx',
      lineNumber: 4,
      columnNumber: 0,
    }).commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [] }])
    makeComponent('LibraryPanel', {
      fileName: '/node_modules/lib/panel.js',
      lineNumber: 4,
      columnNumber: 0,
    }).commit('mount', [{ tag: PASSIVE | HAS_EFFECT, deps: [] }])

    const report = await getEffectAuditReport({ limit: 50, appOnly: true })

    expect(report.components.map((record) => record.name)).toEqual(['AppPanel'])
    expect(report.components[0]?.effects[0]?.provenance.ownership).toBe('unknown')
    expect(report.libraryEffectsHidden).toBe(1)
  })
})
