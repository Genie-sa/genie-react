import type { Fiber } from 'bippy'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { minimalExampleArgs } from '../../protocol'
import { schemaConstraints } from '../../protocol/schema-description'
import { metaToolDescriptors, metaTools } from '../../protocol/tools'

vi.mock('bippy/source', () => ({
  getSource: async (fiber: { _debugSource?: unknown }) => fiber._debugSource ?? null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
  getSourceMap: async () => null,
  getSourceFromSourceMap: () => null,
}))
const { reactCollector } = await import('./collector')
const fiberTools = await import('./fiber')
const { buildTree, noteCommittedRoot, forgetCommittedRoots } = fiberTools
const { clearRenders, recordRender, takeSnapshot, rendersDiff, getRendersLeaderboardsMeasurement } =
  await import('./render-tracker')
const { noteInstanceRender } = await import('./instance-identity')
const sourceTools = await import('./source')
const { classifyFiber, clearSourceCache } = sourceTools
const { getRenderCohort } = await import('./render-cohort')
const { reactFindComponentsContract } = await import('./contracts')

function row(name: string, file: string | null): Fiber {
  return {
    tag: 0,
    type: Object.assign(() => null, { displayName: name }),
    memoizedProps: {},
    memoizedState: null,
    alternate: null,
    child: null,
    sibling: null,
    return: null,
    key: null,
    _debugSource: file ? { fileName: file, lineNumber: 1, columnNumber: 0 } : null,
  } as unknown as Fiber
}
function attach(parent: Fiber, children: Fiber[]) {
  Object.assign(parent, { child: children[0] ?? null })
  children.forEach((child, index) => {
    Object.assign(child, { return: parent, sibling: children[index + 1] ?? null })
  })
}
const gaps = {
  skippedCommitFibers: 0,
  droppedUnmountFibers: 0,
  analysisFailedFibers: 0,
  truncatedInputFibers: 0,
}
beforeEach(() => {
  clearRenders()
  clearSourceCache()
  forgetCommittedRoots()
  vi.stubGlobal('fetch', async () => ({ ok: false }))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  forgetCommittedRoots()
})

it('accepts the canonical find selector while preserving the legacy alias and rejecting conflicts', () => {
  expect(
    reactFindComponentsContract.input.safeParse({ component: 'Row', appOnly: true }).success,
  ).toBe(true)
  expect(reactFindComponentsContract.input.safeParse({ query: 'Row' }).success).toBe(true)
  expect(
    reactFindComponentsContract.input.safeParse({ component: 'Row', query: 'Other' }).success,
  ).toBe(false)
})
it('returns app-owned descendants through library and unknown wrappers with explicit ownership coverage', async () => {
  const root = row('Root', null),
    library = row('Library', '/node_modules/ui/index.tsx'),
    unknown = row('Unknown', null),
    app = row('AppRow', '/src/App.tsx')
  attach(root, [library, unknown])
  attach(library, [app])
  const result = await buildTree(root, {
    depth: 10,
    maxNodes: 20,
    includeHost: false,
    appOnly: true,
  })
  expect(result.nodes.map((node) => [node.name, node.parentId])).toEqual([['AppRow', null]])
  expect(result).toMatchObject({
    ownershipCoverage: { app: 1, library: 1, unknown: 1, complete: false },
  })
})
it('retains app ownership on unmounted cohorts after source caches clear and excludes unknown tombstones honestly', async () => {
  const root = row('Root', null),
    app = row('AppRow', '/src/App.tsx'),
    unknown = row('UnknownRow', null)
  attach(root, [app, unknown])
  noteCommittedRoot({ current: root } as never)
  await classifyFiber(app)
  noteInstanceRender(app, 'unmount', 1, 1)
  noteInstanceRender(unknown, 'unmount', 1, 1)
  attach(root, [])
  clearSourceCache()
  const result = await getRenderCohort(
    root,
    { component: 'Row', exact: false, limit: 20, appOnly: true },
    gaps,
  )
  expect(result.instances.map((instance) => instance.componentName)).toEqual(['AppRow'])
  expect(result).toMatchObject({
    ownershipCoverage: { app: 1, unknown: 1, complete: false },
    coverage: { complete: false },
  })
})
it('advertises ownership filtering on every component listing and profile comparison', () => {
  const names = [
    'react_find_components',
    'react_component_cohort',
    'react_profile_report',
    'react_profile_snapshot',
    'react_renders_diff',
    'react_component_for_dom',
    'react_effect_events',
    'react_effect_timeline',
  ]
  for (const name of names) {
    const tool = reactCollector().tools?.find((tool) => tool.contract.name === name)
    expect(
      JSON.stringify(tool && z.toJSONSchema(tool.contract.input, { io: 'input' })),
      name,
    ).toContain('"appOnly"')
  }
})

it('composes valid first-call arguments for the entire advertised React catalog', () => {
  for (const contract of [
    ...(reactCollector().tools ?? []).map((tool) => tool.contract),
    ...metaTools.filter((tool) => tool.name.startsWith('react_')),
  ]) {
    const schema = z.toJSONSchema(contract.input, { io: 'input' })
    const properties = schema.properties ?? {}
    const args = JSON.parse(minimalExampleArgs(properties, new Set(schema.required ?? []), schema))
    expect(
      contract.input.safeParse(args).success,
      `${contract.name}: ${JSON.stringify(args)}`,
    ).toBe(true)
    const constraints = schemaConstraints(schema)
    for (const [name, field] of Object.entries(properties)) {
      if (typeof field !== 'object' || field === null) continue
      if ('enum' in field || 'minimum' in field || 'maximum' in field)
        expect(constraints, contract.name).toContain(`${name}:`)
    }
  }
})

it('keeps source incompleteness on filtered leaderboards and both sides of profile comparisons', async () => {
  const app = row('AppRow', '/src/App.tsx'),
    library = row('LibraryRow', '/node_modules/ui/Row.tsx'),
    unknown = row('UnknownRow', null)
  recordRender(app, 'update')
  recordRender(library, 'update')
  recordRender(unknown, 'update')
  const board = await getRendersLeaderboardsMeasurement(1, { appOnly: true })
  expect(board.boards.mostRerendered.map((row) => row.name)).toEqual(['AppRow'])
  expect(board.coverage).toMatchObject({
    complete: false,
    semantics: 'lower-bound',
    sourceClassification: { app: 1, library: 1, unknown: 1 },
  })
  const snapshot = await takeSnapshot('ownership', true)
  expect(snapshot.components).toBe(1)
  expect(snapshot.coverage).toMatchObject({ complete: false, sourceClassification: { unknown: 1 } })
  const diff = await rendersDiff('ownership', 0.5, true)
  expect(diff.coverage).toMatchObject({
    baseline: { complete: false },
    current: { complete: false },
  })
  await expect(rendersDiff('ownership', 0.5, false)).rejects.toThrow('appOnly must match')
  const raw = await takeSnapshot('all', false)
  expect(raw.components).toBe(3)
})

it('advertises bridge React quiescence bounds in its tool description', () => {
  const tool = metaToolDescriptors.find((tool) => tool.name === 'react_quiesce')
  expect(tool?.description).toContain('idleMs: minimum')
  expect(tool?.description).toContain('timeoutMs: maximum 60000, greater than 0')
})

it('filters library DOM owners before limit and discloses unknown ownership', async () => {
  const library = row('LibraryButton', '/node_modules/ui/Button.tsx'),
    app = row('AppButton', '/src/Button.tsx'),
    unknown = row('UnknownButton', null)
  const elements = [library, app, unknown].map(() => ({ tagName: 'BUTTON' }))
  vi.stubGlobal('document', { body: {}, querySelectorAll: () => elements })
  vi.stubGlobal('Element', class {})
  vi.stubGlobal('navigator', { product: 'Browser' })
  vi.spyOn(fiberTools, 'owningComponentFor').mockImplementation((element) => {
    const fiber = [library, app, unknown][elements.indexOf(element as never)]
    return fiber
      ? {
          id: fiberTools.registerFiber(fiber),
          name: fiberTools.nameOf(fiber),
          kind: 'function',
          props: {},
          fiber,
        }
      : null
  })
  const tool = reactCollector().tools?.find(
    (tool) => tool.contract.name === 'react_component_for_dom',
  )
  if (!tool) throw new Error('Missing DOM owner tool')
  const report = await tool.handler(
    tool.contract.input.parse({ selector: 'button', appOnly: true, limit: 1 }) as never,
    {} as never,
  )
  expect(report).toMatchObject({
    components: [{ name: 'AppButton' }],
    ownershipCoverage: { app: 1, library: 1, unknown: 1, complete: false },
  })
})
it('keeps app descendants recoverable when hidden tree candidates precede the requested limit', async () => {
  const root = row('Root', null),
    library = row('Library', '/node_modules/ui.tsx'),
    app = row('App', '/src/App.tsx')
  attach(root, [library])
  attach(library, [app])
  const report = await buildTree(root, { depth: 5, maxNodes: 1, includeHost: false, appOnly: true })
  expect(report.nodes.map((node) => node.name)).toEqual(['App'])
})
it('marks a cohort stale when its observation clears during source lookup', async () => {
  const root = row('Root', null),
    app = row('AppRow', '/src/App.tsx')
  attach(root, [app])
  noteCommittedRoot({ current: root } as never)
  const classify = sourceTools.classifyFibersWithinBudget
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  vi.spyOn(sourceTools, 'classifyFibersWithinBudget').mockImplementationOnce(async (fibers) => {
    await gate
    return classify(fibers)
  })
  const pending = getRenderCohort(
    root,
    { component: 'Row', exact: false, limit: 10, appOnly: true },
    gaps,
  )
  clearRenders()
  release?.()
  const report = await pending
  expect(report).toMatchObject({
    attribution: { status: 'stale' },
    ownershipCoverage: { unknown: 1, complete: false },
    coverage: { complete: false },
    instances: [],
  })
})
