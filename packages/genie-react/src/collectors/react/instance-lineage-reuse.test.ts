import { type Fiber, getFiberId } from 'bippy'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { freezeAnalysisClock } from '../../test-support/analysis-clock'
import { type CommitWorkBudget, createCommitWorkBudget } from './commit-budget'
import {
  clearInstanceIdentityForTests,
  instanceForMountedFiber,
  noteUnobservedMounts,
  releaseInstance,
  setCommitLineageReuseForTests,
} from './instance-identity'

const COMPONENT = 0
const HOST_ROOT = 3
const HOST = 5
const FRAGMENT = 7
const CONTEXT_PROVIDER = 10

interface TestFiber {
  tag: number
  type: unknown
  key: string | null
  child: TestFiber | null
  sibling: TestFiber | null
  return: TestFiber | null
  alternate: null
  memoizedProps: Record<string, never>
  memoizedState: null
}

const asFiber = (fiber: TestFiber): Fiber => fiber as unknown as Fiber

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }
}

const componentTypes = ['Row', 'Cell', 'Panel', 'List'].map((name) =>
  Object.assign((): null => null, { displayName: name }),
)

function node(tag: number, type: unknown, key: string | null): TestFiber {
  return {
    tag,
    type,
    key,
    child: null,
    sibling: null,
    return: null,
    alternate: null,
    memoizedProps: {},
    memoizedState: null,
  }
}

function attach(parent: TestFiber, children: TestFiber[]): void {
  parent.child = children[0] ?? null
  children.forEach((child, index) => {
    child.return = parent
    child.sibling = children[index + 1] ?? null
  })
}

/** Lists with unique, duplicate and missing keys, wrapper fibers that are not lineage nodes, and one chain deeper than the 50-node lineage bound. */
function randomTree(random: () => number): { root: TestFiber; components: TestFiber[] } {
  const components: TestFiber[] = []
  const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)] as T
  const randomKey = (index: number): string | null =>
    pick([null, `k${index}`, `k${index}`, 'shared', 'a'])
  const build = (depth: number): TestFiber => {
    const roll = random()
    const kind =
      roll < 0.55 ? COMPONENT : roll < 0.8 ? HOST : roll < 0.9 ? FRAGMENT : CONTEXT_PROVIDER
    const fiber = node(kind, kind === HOST ? pick(['div', 'li', 'td']) : pick(componentTypes), null)
    if (kind === COMPONENT) components.push(fiber)
    if (depth > 0) {
      const children = Array.from({ length: 1 + Math.floor(random() * 4) }, (_, index) => {
        const child = build(depth - 1 - Math.floor(random() * 2))
        child.key = randomKey(index)
        return child
      })
      attach(fiber, children)
    }
    return fiber
  }
  const root = node(HOST_ROOT, null, null)
  let chain = node(COMPONENT, pick(componentTypes), null)
  const branches = [build(5), chain]
  components.push(chain)
  for (let depth = 0; depth < 60; depth += 1) {
    const next = node(depth % 3 === 0 ? FRAGMENT : COMPONENT, pick(componentTypes), null)
    if (next.tag === COMPONENT) components.push(next)
    attach(chain, [next])
    chain = next
  }
  attach(root, branches)
  return { root, components }
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T]
  }
  return copy
}

function budgetState(budget: CommitWorkBudget) {
  return {
    remainingOperations: budget.remainingOperations,
    exhaustedLimit: budget.exhaustedLimit,
    exhaustedSubsystems: [...budget.exhaustedSubsystems].sort(),
  }
}

/** Resolve every component of one simulated commit in `order`, recording identity and budget state after each. */
function resolveCommit(order: TestFiber[], operationLimit: number, reuse: boolean) {
  clearInstanceIdentityForTests()
  setCommitLineageReuseForTests(reuse)
  const budget = createCommitWorkBudget({ operationLimit, timeLimitMs: 60_000, now: () => 0 })
  return order.map((fiber) => {
    const { key, siblingIndex, parent, keyedParent, logicalPath, logicalIdentityEvidence } =
      instanceForMountedFiber(asFiber(fiber), budget)
    return {
      identity: { key, siblingIndex, parent, keyedParent, logicalPath, logicalIdentityEvidence },
      budget: budgetState(budget),
    }
  })
}

beforeEach(() => clearInstanceIdentityForTests())
afterEach(() => setCommitLineageReuseForTests(true))

describe('commit-scoped lineage reuse', () => {
  it('resolves the same identity and charges the same budget as a fresh walk for every fiber', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const random = seededRandom(seed)
      const { components } = randomTree(random)
      const order = shuffled(components, random)
      for (const operationLimit of [40, 400, 4_000, 1_000_000]) {
        const reused = resolveCommit(order, operationLimit, true)
        const walked = resolveCommit(order, operationLimit, false)
        expect(reused, `seed ${seed}, operation limit ${operationLimit}`).toEqual(walked)
      }
    }
  })

  it('resolves a shared ancestor once per commit, not once per row of a wide list', () => {
    const ancestorNameReads = (reuse: boolean): number => {
      setCommitLineageReuseForTests(reuse)
      let reads = 0
      const pageType = Object.defineProperty((): null => null, 'displayName', {
        get: () => {
          reads += 1
          return 'Page'
        },
      })
      const root = node(HOST_ROOT, null, null)
      const page = node(COMPONENT, pageType, null)
      const section = node(COMPONENT, componentTypes[2], null)
      const table = node(HOST, 'tbody', null)
      const rows = Array.from({ length: 1_000 }, (_, index) =>
        node(COMPONENT, componentTypes[0], `row-${index}`),
      )
      attach(root, [page])
      attach(page, [section])
      attach(section, [table])
      attach(table, rows)
      const budget = createCommitWorkBudget({ operationLimit: 1_000_000, now: () => 0 })
      for (const row of rows) instanceForMountedFiber(asFiber(row), budget)
      return reads
    }
    const walked = ancestorNameReads(false)
    const reused = ancestorNameReads(true)

    expect(walked).toBeGreaterThanOrEqual(1_000)
    expect(reused).toBeLessThan(walked / 100)
  })

  it('does not reuse a prefix from an earlier commit after the tree is reordered', () => {
    const root = node(HOST_ROOT, null, null)
    const list = node(COMPONENT, componentTypes[3], null)
    const first = node(HOST, 'li', null)
    const second = node(HOST, 'li', null)
    const leaf = node(COMPONENT, componentTypes[1], null)
    attach(root, [list])
    attach(list, [first, second])
    attach(second, [leaf])
    const before = instanceForMountedFiber(asFiber(leaf), createCommitWorkBudget({ now: () => 0 }))
    attach(list, [second, first])
    const after = instanceForMountedFiber(asFiber(leaf), createCommitWorkBudget({ now: () => 0 }))

    expect(before.logicalPath).toContain('<li>[index=1]')
    expect(after.logicalPath).toContain('<li>[index=0]')
  })
})

describe('mounts counted while nothing observes', () => {
  beforeEach(freezeAnalysisClock)

  const PLACEMENT = 0b10

  /** A committed root over `branches`, each mounted in this commit. */
  function committedRoot(branches: TestFiber[]): TestFiber {
    const root = node(HOST_ROOT, null, null)
    Object.assign(root, { alternate: {}, flags: 0, subtreeFlags: PLACEMENT })
    attach(root, branches)
    return root
  }

  /** Count the commit's mounts, then unmount and remount each component in place and read the generation a window opened afterwards reports. */
  function remountGenerations(root: TestFiber, components: TestFiber[], reuse: boolean) {
    clearInstanceIdentityForTests()
    setCommitLineageReuseForTests(reuse)
    noteUnobservedMounts(asFiber(root))
    return components.map((component) => {
      const fiber = asFiber(component)
      releaseInstance(fiber, getFiberId(fiber))
      const { logicalPath, mountGeneration, mountGenerationEvidence } =
        instanceForMountedFiber(fiber)
      return { logicalPath, mountGeneration, mountGenerationEvidence }
    })
  }

  function expectSameAsWalkingUp(root: TestFiber, components: TestFiber[], label: string): void {
    const walked = remountGenerations(root, components, false)
    const descended = remountGenerations(root, components, true)

    expect(descended, label).toEqual(walked)
    expect(walked.filter((remount) => remount.mountGeneration === 2).length).toBeGreaterThan(
      components.length / 2,
    )
  }

  it('numbers every remount as a walk up from each mount would', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const { root: tree, components } = randomTree(seededRandom(seed))
      expectSameAsWalkingUp(committedRoot([tree]), components, `seed ${seed}`)
    }
  })

  it('numbers rows past the sibling scan limit as a walk up would', () => {
    const list = node(COMPONENT, componentTypes[3], null)
    const rows = Array.from({ length: 2_005 }, (_, index) =>
      node(COMPONENT, componentTypes[0], index % 700 === 0 ? 'duplicate' : `row-${index}`),
    )
    attach(list, rows)
    expectSameAsWalkingUp(committedRoot([list]), [list, ...rows], 'wide list')
  })

  it('numbers mounts deeper than the lineage bound as a walk up would', () => {
    const chain = Array.from({ length: 70 }, (_, depth) =>
      node(depth % 2 === 0 ? COMPONENT : HOST, depth % 2 === 0 ? componentTypes[2] : 'div', null),
    )
    chain.forEach((fiber, depth) => {
      const next = chain[depth + 1]
      if (next) attach(fiber, [next, node(COMPONENT, componentTypes[1], null)])
    })
    const components = chain.flatMap((fiber) => [fiber, fiber.child?.sibling ?? fiber])
    expectSameAsWalkingUp(
      committedRoot([chain[0] as TestFiber]),
      components.filter((fiber) => fiber.tag === COMPONENT),
      'deep chain',
    )
  })

  it('numbers a mount below a stale return link as a walk up would', () => {
    const wrapper = node(HOST, 'section', null)
    const panel = node(COMPONENT, componentTypes[2], null)
    const cell = node(COMPONENT, componentTypes[1], null)
    const leaf = node(COMPONENT, componentTypes[0], null)
    attach(wrapper, [node(HOST, 'h2', null), panel])
    attach(panel, [cell])
    attach(cell, [leaf])
    cell.return = { ...panel, sibling: null }
    const root = committedRoot([wrapper])
    const [walkedCell, walkedLeaf] = remountGenerations(root, [cell, leaf], false)

    expect(walkedCell?.logicalPath).toContain('[index=?]')
    expect(remountGenerations(root, [cell, leaf], true)).toEqual([walkedCell, walkedLeaf])
  })
})
