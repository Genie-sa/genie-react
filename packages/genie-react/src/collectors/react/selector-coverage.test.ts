import type { Fiber } from 'bippy'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { z } from 'zod'

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
const { buildTree, noteCommittedRoot, forgetCommittedRoots } = await import('./fiber')
const { clearRenders } = await import('./render-tracker')
const { noteInstanceRender } = await import('./instance-identity')
const { classifyFiber, clearSourceCache } = await import('./source')
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
