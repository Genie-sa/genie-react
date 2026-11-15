import { type Fiber, isCompositeFiber, isHostFiber, type RenderPhase } from 'bippy'
import { type CommitWorkBudget, consumeCommitWork } from './commit-budget'
import { firstHostSelector, nameOf, registerFiber } from './fiber'
import { LruMap } from './lru-map'
import { classifyFiberFromCache, type FiberClassification } from './source'

export type LogicalIdentityEvidence = 'keyed' | 'positional' | 'unknown'
export type MountGenerationEvidence = 'exact' | 'inferred' | 'unknown'

export interface InstanceParent {
  fiberId: number
  name: string
  key: string | null
}

export interface InstanceDescriptor {
  /** Physical React Fiber identity, stable across current/alternate buffer swaps. */
  fiberId: number
  /** One physical mount in this browser document. */
  mountId: string
  key: string | null
  siblingIndex: number | null
  parent: InstanceParent | null
  keyedParent: InstanceParent | null
  logicalPath: string
  logicalIdentityEvidence: LogicalIdentityEvidence
  mountGeneration: number
  mountGenerationEvidence: MountGenerationEvidence
  /** Best-effort host locator. Null when no host exists or the instance has unmounted. */
  hostSelector: string | null
}

export interface InstanceTombstone {
  ownership: FiberClassification
  componentName: string
  observationId: string
  profileCommitId: number
  documentCommitId: number
  instance: InstanceDescriptor
}

export interface PreparedInstanceRender {
  instance: InstanceDescriptor
  publish: () => void
}

const ANCESTRY_LIMIT = 50
const SIBLING_SCAN_LIMIT = 2_000
const TOMBSTONE_LIMIT = 1_000
const GENERATION_HISTORY_LIMIT = 10_000
const UNANALYZED_RENDER_IDENTITY_LIMIT = 1_000

let mountSequence = 0
let activeObservationId: string | null = null
const liveInstances = new Map<number, InstanceDescriptor>()
const observedInstanceIds = new Set<number>()
const unanalyzedRenderIds = new Set<number>()
let seenUnanalyzedFibers = new WeakSet<Fiber>()
const tombstones: InstanceTombstone[] = []
let droppedTombstones = 0
let excludedLifecycleFibers = 0
let generationHistoryEvictions = 0
const generationsByPath = new LruMap<string, number>(GENERATION_HISTORY_LIMIT, () => {
  generationHistoryEvictions += 1
})
let unanalyzedRenderIdentityRegistrations = 0
let unanalyzedRenderIdentityComplete = true

/** Reset only the measurement cohort. Physical mount identity intentionally survives a clear. */
export function beginInstanceObservation(observationId: string): void {
  activeObservationId = observationId
  observedInstanceIds.clear()
  unanalyzedRenderIds.clear()
  seenUnanalyzedFibers = new WeakSet()
  tombstones.length = 0
  droppedTombstones = 0
  excludedLifecycleFibers = 0
  unanalyzedRenderIdentityRegistrations = 0
  unanalyzedRenderIdentityComplete = true
}

export function noteInstanceRender(
  fiber: Fiber,
  phase: RenderPhase,
  profileCommitId: number,
  documentCommitId: number,
  budget?: CommitWorkBudget,
): InstanceDescriptor {
  const prepared = prepareInstanceRender(fiber, phase, profileCommitId, documentCommitId, budget)
  prepared.publish()
  return prepared.instance
}

/** Prepare identity and lifecycle evidence without mutating shared stores. */
export function prepareInstanceRender(
  fiber: Fiber,
  phase: RenderPhase,
  profileCommitId: number,
  documentCommitId: number,
  budget?: CommitWorkBudget,
): PreparedInstanceRender {
  if (phase === 'unmount') {
    const prepared = prepareInstanceDescription(fiber, false, true, budget)
    const observationId = activeObservationId
    const componentName = nameOf(fiber)
    const ownership = classifyFiberFromCache(fiber) ?? {
      source: null,
      ownership: 'unknown' as const,
      isLibrary: false,
    }
    let published = false
    return {
      instance: prepared.instance,
      publish() {
        if (published) return
        published = true
        prepared.publish()
        liveInstances.delete(prepared.instance.fiberId)
        observedInstanceIds.delete(prepared.instance.fiberId)
        forgetUnanalyzedInstance(fiber, prepared.instance.fiberId)
        if (!observationId) return
        tombstones.push({
          ownership,
          componentName,
          observationId,
          profileCommitId,
          documentCommitId,
          instance: prepared.instance,
        })
        if (tombstones.length > TOMBSTONE_LIMIT) {
          tombstones.shift()
          droppedTombstones += 1
        }
      },
    }
  }

  const prepared = prepareInstanceDescription(fiber, phase === 'mount', false, budget)
  let published = false
  return {
    instance: prepared.instance,
    publish() {
      if (published) return
      published = true
      prepared.publish()
      forgetUnanalyzedInstance(fiber, prepared.instance.fiberId)
      observedInstanceIds.add(prepared.instance.fiberId)
    },
  }
}

/** Ensure a mounted Fiber has an identity, without claiming that its mount was observed. */
export function instanceForMountedFiber(
  fiber: Fiber,
  budget?: CommitWorkBudget,
): InstanceDescriptor {
  const prepared = prepareInstanceDescription(fiber, false, false, budget)
  prepared.publish()
  return prepared.instance
}

/** Add the current nearest host selector only when a report needs it. */
export function instanceForReport(fiber: Fiber): InstanceDescriptor {
  const prepared = prepareInstanceDescription(fiber, false, false)
  prepared.publish()
  const instance = prepared.instance
  return { ...instance, hostSelector: hostSelectorFor(fiber) }
}

export function wasInstanceObserved(instanceId: number): boolean {
  return observedInstanceIds.has(instanceId)
}

export function noteUnanalyzedInstanceRender(fiber: Fiber): void {
  if (!activeObservationId || !unanalyzedRenderIdentityComplete) return
  try {
    const alternate = fiber.alternate
    if (seenUnanalyzedFibers.has(fiber) || (alternate && seenUnanalyzedFibers.has(alternate))) {
      return
    }
    if (unanalyzedRenderIdentityRegistrations >= UNANALYZED_RENDER_IDENTITY_LIMIT) {
      abandonUnanalyzedRenderIdentityDetail()
      return
    }
    const fiberId = registerFiber(fiber) as number
    unanalyzedRenderIdentityRegistrations += 1
    seenUnanalyzedFibers.add(fiber)
    if (alternate) seenUnanalyzedFibers.add(alternate)
    if (!observedInstanceIds.has(fiberId)) unanalyzedRenderIds.add(fiberId)
  } catch {
    abandonUnanalyzedRenderIdentityDetail()
  }
}

export function wasInstanceRenderUnanalyzed(instanceId: number): boolean {
  return unanalyzedRenderIds.has(instanceId)
}

export function getInstanceTombstones(): readonly InstanceTombstone[] {
  return tombstones
}

export function getInstanceIdentityCoverage(): {
  droppedTombstones: number
  excludedLifecycleFibers: number
  generationHistoryEvictions: number
  unanalyzedRenderIdentityComplete: boolean
} {
  return {
    droppedTombstones,
    excludedLifecycleFibers,
    generationHistoryEvictions,
    unanalyzedRenderIdentityComplete,
  }
}

/** Remove HMR-invalidated identity without claiming a user-visible unmount in the cohort; a caller that kept the mounted id passes it, since bippy releases the fiber's own id at unmount. */
export function discardExcludedInstanceUnmount(
  fiber: Fiber,
  fiberId: number = registerFiber(fiber),
): void {
  liveInstances.delete(fiberId)
  observedInstanceIds.delete(fiberId)
  forgetUnanalyzedInstance(fiber, fiberId)
  excludedLifecycleFibers += 1
}

/** Invalidate identities across a refresh commit whose synthetic lifecycle cannot be reported exactly. */
export function invalidateLiveInstancesForRefresh(): void {
  if (liveInstances.size > 0) excludedLifecycleFibers += liveInstances.size
  else if (activeObservationId && excludedLifecycleFibers === 0) excludedLifecycleFibers = 1
  liveInstances.clear()
  observedInstanceIds.clear()
  if (unanalyzedRenderIds.size > 0) unanalyzedRenderIdentityComplete = false
  unanalyzedRenderIds.clear()
  seenUnanalyzedFibers = new WeakSet()
  unanalyzedRenderIdentityRegistrations = 0
}

export function clearInstanceIdentityForTests(): void {
  mountSequence = 0
  activeObservationId = null
  liveInstances.clear()
  generationsByPath.clear()
  observedInstanceIds.clear()
  unanalyzedRenderIds.clear()
  seenUnanalyzedFibers = new WeakSet()
  tombstones.length = 0
  droppedTombstones = 0
  excludedLifecycleFibers = 0
  generationHistoryEvictions = 0
  unanalyzedRenderIdentityRegistrations = 0
  unanalyzedRenderIdentityComplete = true
}

function forgetUnanalyzedInstance(fiber: Fiber, fiberId: number): void {
  unanalyzedRenderIds.delete(fiberId)
  seenUnanalyzedFibers.delete(fiber)
  try {
    if (fiber.alternate) seenUnanalyzedFibers.delete(fiber.alternate)
  } catch {
    abandonUnanalyzedRenderIdentityDetail()
  }
}

function abandonUnanalyzedRenderIdentityDetail(): void {
  unanalyzedRenderIdentityComplete = false
  unanalyzedRenderIds.clear()
  seenUnanalyzedFibers = new WeakSet()
}

function prepareInstanceDescription(
  fiber: Fiber,
  mountObserved: boolean,
  captureHostSelector: boolean,
  budget?: CommitWorkBudget,
): PreparedInstanceRender {
  const fiberId = registerFiber(fiber) as number
  const existing = liveInstances.get(fiberId)
  if (existing && captureHostSelector) {
    const instance = {
      ...existing,
      hostSelector: consumeCommitWork(budget, 'host-selector')
        ? (hostSelectorFor(fiber) ?? existing.hostSelector)
        : existing.hostSelector,
    }
    return { instance, publish: () => liveInstances.set(fiberId, instance) }
  }
  const structure = structuralIdentity(fiber, budget)
  if (existing) {
    const instance = {
      ...existing,
      ...structure,
      mountGenerationEvidence:
        existing.mountGenerationEvidence === 'unknown'
          ? 'unknown'
          : mountObserved || existing.mountGenerationEvidence === 'exact'
            ? 'exact'
            : 'inferred',
      hostSelector: existing.hostSelector,
    } satisfies InstanceDescriptor
    return {
      instance,
      publish: () => liveInstances.set(fiberId, instance),
    }
  }

  const previousGeneration = generationsByPath.get(structure.logicalPath)
  const mountGeneration = (previousGeneration ?? 0) + 1
  const willEvict =
    previousGeneration === undefined && generationsByPath.size >= GENERATION_HISTORY_LIMIT
  const created: InstanceDescriptor = {
    fiberId,
    mountId: `mount:${mountSequence + 1}`,
    ...structure,
    mountGeneration,
    mountGenerationEvidence:
      previousGeneration === undefined && (generationHistoryEvictions > 0 || willEvict)
        ? 'unknown'
        : mountObserved
          ? 'exact'
          : 'inferred',
    hostSelector:
      captureHostSelector && consumeCommitWork(budget, 'host-selector')
        ? hostSelectorFor(fiber)
        : null,
  }
  let published = false
  return {
    instance: created,
    publish() {
      if (published) return
      published = true
      generationsByPath.set(structure.logicalPath, mountGeneration)
      mountSequence += 1
      liveInstances.set(fiberId, created)
    },
  }
}

function structuralIdentity(
  fiber: Fiber,
  budget?: CommitWorkBudget,
): Pick<
  InstanceDescriptor,
  'key' | 'siblingIndex' | 'parent' | 'keyedParent' | 'logicalPath' | 'logicalIdentityEvidence'
> {
  const key = typeof fiber.key === 'string' ? fiber.key : null
  const siblingIndex = indexAmongSiblings(fiber, budget)
  const keyUnique = key !== null && isUniqueSiblingKey(fiber, key, budget)
  const parentFiber = nearestComposite(fiber.return, budget)
  const keyedParentFiber = nearestKeyedComposite(fiber.return, budget)
  const reused = budget && reuseCommitLineage ? lineageFromCommitPrefix(fiber, budget) : null
  const lineage = reused ?? walkLineage(fiber, budget)
  const ownEvidence: LogicalIdentityEvidence = keyUnique
    ? 'keyed'
    : siblingIndex === null
      ? 'unknown'
      : 'positional'

  return {
    key,
    siblingIndex,
    parent: parentFiber ? parentOf(parentFiber) : null,
    keyedParent: keyedParentFiber ? parentOf(keyedParentFiber) : null,
    logicalPath: lineage.path,
    logicalIdentityEvidence: lineage.unknown ? 'unknown' : ownEvidence,
  }
}

interface ResolvedLineage {
  path: string
  /** A segment had no position, or the walk stopped before the root. */
  unknown: boolean
}

/** A lineage node's path from the root within one commit, with the operations a fresh walk from that node charges once its sibling scans are done. */
interface LineagePrefix extends ResolvedLineage {
  /** Ancestor-loop steps from this node to the root, inclusive. */
  steps: number
  /** Composite and host nodes from this node to the root, inclusive. */
  nodes: number
  /** One position lookup per node, plus one uniqueness check per keyed node. */
  siblingOperations: number
}

// Sibling order and keys are fixed within one commit, so prefixes are reused only under the commit's own work budget, like the sibling scans.
const lineagePrefixes = new WeakMap<CommitWorkBudget, WeakMap<Fiber, LineagePrefix>>()
let reuseCommitLineage = true

/** Test-only: resolve every lineage with a fresh walk, the reference the commit-scoped reuse must match. */
export function setCommitLineageReuseForTests(enabled: boolean): void {
  reuseCommitLineage = enabled
}

const isLineageNode = (fiber: Fiber): boolean => isCompositeFiber(fiber) || isHostFiber(fiber)

interface ResolvedSegment {
  segment: string
  unknown: boolean
  operations: number
}

/** The same position and uniqueness calls a walk makes for one lineage node, charged to the same budget. */
function resolveSegment(node: Fiber, budget?: CommitWorkBudget): ResolvedSegment {
  const key = typeof node.key === 'string' ? node.key : null
  const index = indexAmongSiblings(node, budget)
  const unique = key !== null && isUniqueSiblingKey(node, key, budget)
  return {
    segment: unique
      ? `${identityName(node)}[key=${JSON.stringify(key)}]`
      : `${identityName(node)}[index=${index ?? '?'}]`,
    unknown: !unique && index === null,
    operations: key === null ? 1 : 2,
  }
}

function rememberPrefixes(budget: CommitWorkBudget, resolved: [Fiber, LineagePrefix][]): void {
  if (budget.exhaustedLimit !== null) return
  let prefixes = lineagePrefixes.get(budget)
  if (!prefixes) {
    prefixes = new WeakMap()
    lineagePrefixes.set(budget, prefixes)
  }
  for (const [node, prefix] of resolved) prefixes.set(node, prefix)
}

/** Continues the nearest ancestor prefix already resolved in this commit. A walk charges every ancestor step, then each node's sibling lookups root first, so the cached prefix is charged in bulk and only the nodes below it are resolved; anything a walk could resolve differently falls back to the walk. */
function lineageFromCommitPrefix(fiber: Fiber, budget: CommitWorkBudget): ResolvedLineage | null {
  const prefixes = lineagePrefixes.get(budget)
  if (!prefixes) return null
  const below: Fiber[] = []
  const stepsBelow: number[] = []
  let steps = 0
  let prefix: LineagePrefix | undefined
  for (let current: Fiber | null = fiber; current; current = current.return) {
    if (isLineageNode(current)) {
      prefix = prefixes.get(current)
      if (prefix) break
      if (below.length >= ANCESTRY_LIMIT) return null
      below.push(current)
      stepsBelow.push(steps)
    }
    steps += 1
  }
  if (!prefix || prefix.nodes + below.length >= ANCESTRY_LIMIT) return null
  const totalSteps = steps + prefix.steps
  if (budget.remainingOperations < totalSteps + prefix.siblingOperations) return null
  if (
    !consumeCommitWork(budget, 'instance-ancestry', totalSteps) ||
    !consumeCommitWork(budget, 'instance-siblings', prefix.siblingOperations)
  ) {
    return { path: '', unknown: true }
  }
  let { path, unknown, siblingOperations } = prefix
  const resolved: [Fiber, LineagePrefix][] = []
  for (let position = below.length - 1; position >= 0; position -= 1) {
    const node = below[position] as Fiber
    const segment = resolveSegment(node, budget)
    path = `${path} > ${segment.segment}`
    unknown ||= segment.unknown
    siblingOperations += segment.operations
    resolved.push([
      node,
      {
        path,
        unknown,
        steps: totalSteps - (stepsBelow[position] ?? 0),
        nodes: prefix.nodes + below.length - position,
        siblingOperations,
      },
    ])
  }
  rememberPrefixes(budget, resolved)
  return { path, unknown }
}

function walkLineage(fiber: Fiber, budget?: CommitWorkBudget): ResolvedLineage {
  const lineage: Fiber[] = []
  const stepOfNode: number[] = []
  let steps = 0
  let current: Fiber | null = fiber
  while (current && lineage.length < ANCESTRY_LIMIT) {
    if (!consumeCommitWork(budget, 'instance-ancestry')) break
    steps += 1
    if (isLineageNode(current)) {
      lineage.push(current)
      stepOfNode.push(steps)
    }
    current = current.return
  }
  lineage.reverse()
  stepOfNode.reverse()

  const resolved: [Fiber, LineagePrefix][] = []
  let path = ''
  let unknown = false
  let siblingOperations = 0
  for (const [position, node] of lineage.entries()) {
    const segment = resolveSegment(node, budget)
    path = position === 0 ? segment.segment : `${path} > ${segment.segment}`
    unknown ||= segment.unknown
    siblingOperations += segment.operations
    resolved.push([
      node,
      {
        path,
        unknown,
        steps: steps - (stepOfNode[position] ?? steps) + 1,
        nodes: position + 1,
        siblingOperations,
      },
    ])
  }
  if (current) unknown = true
  else if (budget) rememberPrefixes(budget, resolved)
  return { path, unknown }
}

function identityName(fiber: Fiber): string {
  return isHostFiber(fiber) && typeof fiber.type === 'string' ? `<${fiber.type}>` : nameOf(fiber)
}

function parentOf(fiber: Fiber): InstanceParent {
  return {
    fiberId: registerFiber(fiber) as number,
    name: nameOf(fiber),
    key: typeof fiber.key === 'string' ? fiber.key : null,
  }
}

function nearestComposite(fiber: Fiber | null, budget?: CommitWorkBudget): Fiber | null {
  let current = fiber
  while (current && !isCompositeFiber(current)) {
    if (!consumeCommitWork(budget, 'instance-ancestry')) return null
    current = current.return
  }
  return current
}

function nearestKeyedComposite(fiber: Fiber | null, budget?: CommitWorkBudget): Fiber | null {
  let current = fiber
  while (current) {
    if (!consumeCommitWork(budget, 'instance-ancestry')) return null
    if (isCompositeFiber(current) && typeof current.key === 'string') return current
    current = current.return
  }
  return null
}

interface SiblingIdentityScan {
  indices: Map<Fiber, number>
  keyCounts: Map<string, number>
  complete: boolean
  current: Fiber | null
  advance: boolean
  scanned: number
}

// A work budget belongs to one synchronous commit; sibling order can change on the next one.
const siblingScans = new WeakMap<CommitWorkBudget, WeakMap<Fiber, SiblingIdentityScan>>()

function commitSiblingScan(
  first: Fiber,
  budget: CommitWorkBudget,
  target?: Fiber,
): SiblingIdentityScan {
  let scans = siblingScans.get(budget)
  if (!scans) {
    scans = new WeakMap()
    siblingScans.set(budget, scans)
  }
  let scan = scans.get(first)
  if (!scan) {
    scan = {
      indices: new Map(),
      keyCounts: new Map(),
      complete: false,
      current: first,
      advance: false,
      scanned: 0,
    }
    scans.set(first, scan)
  }

  // Position lookup needs only a prefix; key uniqueness needs the complete bounded list.
  while (!scan.complete && (!target || !scan.indices.has(target))) {
    if (scan.advance) {
      scan.current = scan.current?.sibling ?? null
      scan.advance = false
    }
    const current = scan.current
    if (!current) {
      scan.complete = true
      break
    }
    if (scan.scanned >= SIBLING_SCAN_LIMIT) break
    if (!consumeCommitWork(budget, 'instance-siblings')) break
    const key = current.key
    scan.indices.set(current, scan.scanned)
    if (current.alternate) scan.indices.set(current.alternate, scan.scanned)
    if (typeof key === 'string') {
      scan.keyCounts.set(key, (scan.keyCounts.get(key) ?? 0) + 1)
    }
    scan.scanned += 1
    scan.advance = true
  }
  return scan
}

function indexAmongSiblings(fiber: Fiber, budget?: CommitWorkBudget): number | null {
  const first = fiber.return?.child
  if (!first) return fiber.return ? null : 0
  if (budget) {
    if (!consumeCommitWork(budget, 'instance-siblings')) return null
    return commitSiblingScan(first, budget, fiber).indices.get(fiber) ?? null
  }
  let current: Fiber | null = first
  let index = 0
  while (current && index < SIBLING_SCAN_LIMIT) {
    if (!consumeCommitWork(budget, 'instance-siblings')) return null
    if (current === fiber || current.alternate === fiber || current === fiber.alternate)
      return index
    current = current.sibling
    index += 1
  }
  return null
}

function isUniqueSiblingKey(fiber: Fiber, key: string, budget?: CommitWorkBudget): boolean {
  const first = fiber.return?.child
  if (!first) return false
  if (budget) {
    if (!consumeCommitWork(budget, 'instance-siblings')) return false
    const scan = commitSiblingScan(first, budget)
    return scan.complete && scan.keyCounts.get(key) === 1
  }
  let current: Fiber | null = first
  let matches = 0
  let scanned = 0
  while (current && scanned < SIBLING_SCAN_LIMIT) {
    if (!consumeCommitWork(budget, 'instance-siblings')) return false
    if (current.key === key) matches += 1
    if (matches > 1) return false
    current = current.sibling
    scanned += 1
  }
  return current === null && matches === 1
}

function hostSelectorFor(fiber: Fiber): string | null {
  try {
    return firstHostSelector(fiber)
  } catch {
    return null
  }
}
