import { type Fiber, getReactWorkTagsForFiber, isCompositeFiber } from 'bippy'
import { formatSourceLocation, type ToolOutput } from '../../protocol'
import { type ComponentMatch, componentNameMatcher, describeComponentMatch } from './component-name'
import { findAllCommittedRootFibers, nameOf } from './fiber'
import { hasReactFreezeAdapter, isReactFreeze } from './freeze-identity'
import {
  getInstanceIdentityCoverage,
  getInstanceTombstones,
  type InstanceDescriptor,
  instanceForReport,
  wasInstanceObserved,
  wasInstanceRenderUnanalyzed,
} from './instance-identity'
import { type RendererBundle, rendererBundleOf } from './measurement-environment'
import { getActiveObservation, type ObservationWindow } from './observation'
import type { reactComponentCohortContract } from './render-contract'
import type { SourceClassificationEffect } from './render-reports'
import { captureReportEpoch, reportAttribution, reportStateMatches } from './report-attribution'
import {
  classifyFibersWithinBudget,
  type FiberClassification,
  isHiddenByAppOnly,
  ownershipCoverage,
  type SourceProvenance,
  sourceProvenanceForSource,
} from './source'

export type CohortStatus =
  | 'not-started'
  | 'absent'
  | 'mounted-idle'
  | 'updated'
  | 'unmounted'
  | 'mixed'
  | 'unknown'

export interface CohortInstance {
  sourceOwnership: FiberClassification['ownership']
  source: FiberClassification['source']
  sourceProvenance: SourceProvenance
  componentName: string
  renderingState:
    | 'mounted-rendering'
    | 'mounted-frozen'
    | 'mounted-hidden'
    | 'mounted-unknown'
    | 'unmounted'
  reactVisibility: 'hidden' | 'not-hidden' | 'unknown'
  status: 'mounted-idle' | 'mounted-updated' | 'mounted-unknown' | 'unmounted'
  instance: InstanceDescriptor
  profileCommitId?: number
  documentCommitId?: number
}

export interface RenderCohort {
  attribution: ReturnType<typeof reportAttribution>
  documentCommitId: number
  ownershipCoverage: ReturnType<typeof ownershipCoverage> & { affects: SourceClassificationEffect }
  observation: ObservationWindow | null
  query: { component: string; exact: boolean }
  componentMatch: ComponentMatch
  status: CohortStatus
  matched: number
  mountedUpdated: number
  mountedIdle: number
  mountedUnknown: number
  unmounted: number
  returned: number
  omittedByLimit: number
  rendererBundle: RendererBundle | null
  instances: CohortInstance[]
  coverage: {
    complete: boolean
    freezeDetection: 'react-freeze-identity' | 'disabled'
    scannedFibers: number
    scanLimit: number
    scanTruncated: boolean
    rootAvailable: boolean
    rootCount: number
    scannedRootCount: number
    rootLimit: number
    rootScope: 'committed' | 'committed+fallback' | 'fallback' | 'missing'
    rootScopeComplete: boolean
    rootScopeTruncated: boolean
    inputAttributionComplete: boolean
    skippedCommitFibers: number
    droppedUnmountFibers: number
    analysisFailedFibers: number
    pausedCommits: number
    unobservedCommits: number
    refreshCommitsExcluded: number
    truncatedInputFibers: number
    propsNotEnumeratedFibers: number
    budgetExhaustedCommits: number
    budgetExhaustedSubsystems: { subsystem: string; commits: number }[]
    generationHistoryEvictions: number
  }
}

export interface RenderCoverageGaps {
  skippedCommitFibers: number
  droppedUnmountFibers: number
  analysisFailedFibers: number
  /** Commits after profiling paused: an instance may have updated unseen, so idle cannot be proven. */
  pausedCommits?: number
  /** Commits no window observed: an instance may have updated unseen, so idle cannot be proven. */
  unobservedCommits?: number
  /** Fast Refresh commits the window did not analyse: an instance may have updated unseen, so idle cannot be proven. */
  refreshCommitsExcluded?: number
  truncatedInputFibers: number
  propsNotEnumeratedFibers?: number
  budgetExhaustedCommits?: number
  budgetExhaustedSubsystems?: { subsystem: string; commits: number }[]
  /** Internal live queue depth; intentionally omitted from the public coverage payload. */
  pendingUnmountFibers?: number
}

const COHORT_SCAN_LIMIT = 20_000

export async function getRenderCohort(
  fallbackRoot: Fiber | null,
  query: { component: string; exact: boolean; limit: number; appOnly?: boolean },
  coverageGaps: RenderCoverageGaps,
): Promise<RenderCohort> {
  const freezeDetection = hasReactFreezeAdapter() ? 'react-freeze-identity' : 'disabled'
  const epoch = captureReportEpoch()
  const observation = getActiveObservation()
  const named = componentNameMatcher(query)
  const seenNames = new Set<string>()
  const mountedCandidates: Array<{
    fiber: Fiber
    reactVisibility: CohortInstance['reactVisibility']
    frozen: boolean
    componentName: string
    instance: InstanceDescriptor
    observed: boolean
    renderUnanalyzed: boolean
  }> = []
  const committedScope = findAllCommittedRootFibers()
  const fallbackInCommittedScope = fallbackRoot
    ? committedScope.roots.includes(fallbackRoot)
    : false
  const rootScope =
    committedScope.rootCount > 0
      ? fallbackRoot && !fallbackInCommittedScope
        ? 'committed+fallback'
        : 'committed'
      : fallbackRoot
        ? 'fallback'
        : 'missing'
  // Give the selected DOM root first claim on the shared budget when commit capture missed it.
  const rootCandidates = fallbackRoot
    ? [fallbackRoot, ...committedScope.roots.filter((root) => root !== fallbackRoot)]
    : committedScope.roots
  const rootScopeTruncated =
    committedScope.truncated || rootCandidates.length > committedScope.rootLimit
  const roots = rootCandidates.slice(0, committedScope.rootLimit)
  const rootFibers = new Set(roots)
  const scannedRoots = new Set<Fiber>()
  const visitedFibers = new Set<Fiber>()
  const mountedFiberIds = new Set<number>()
  // Reverse once so the oldest committed root remains first in the LIFO walk.
  const frozenPrimaries = new Set<Fiber>()
  const stack: Array<{
    fiber: Fiber
    reactVisibility: CohortInstance['reactVisibility']
    frozen: boolean
  }> = [...roots]
    .reverse()
    .map((fiber) => ({ fiber, reactVisibility: 'not-hidden', frozen: false }))
  let scannedFibers = 0

  while (stack.length > 0 && scannedFibers < COHORT_SCAN_LIMIT) {
    const entry = stack.pop()
    if (!entry || visitedFibers.has(entry.fiber)) continue
    const { fiber } = entry
    const childFrozen = entry.frozen || frozenPrimaries.has(fiber)
    // react-freeze 1.x suspends its direct Suspense primary; fallbacks and siblings remain eligible.
    if (isReactFreeze(fiber.type) && fiber.memoizedProps?.freeze === true) {
      const suspense = fiber.child
      const tags = getReactWorkTagsForFiber(fiber)
      if (
        suspense?.tag === tags.SuspenseComponent &&
        suspense.memoizedState != null &&
        suspense.child?.tag === tags.OffscreenComponent &&
        suspense.child.memoizedState != null
      ) {
        frozenPrimaries.add(suspense.child)
      }
    }
    let childVisibility = entry.reactVisibility
    if (
      childVisibility !== 'hidden' &&
      fiber.tag === getReactWorkTagsForFiber(fiber).OffscreenComponent
    ) {
      childVisibility =
        fiber.memoizedState === undefined
          ? 'unknown'
          : fiber.memoizedState === null
            ? entry.reactVisibility
            : 'hidden'
    }
    visitedFibers.add(fiber)
    if (rootFibers.has(fiber)) scannedRoots.add(fiber)
    scannedFibers += 1
    if (isCompositeFiber(fiber)) {
      const componentName = nameOf(fiber)
      seenNames.add(componentName)
      if (named(componentName)) {
        const instance = instanceForReport(fiber)
        if (!mountedFiberIds.has(instance.fiberId)) {
          mountedFiberIds.add(instance.fiberId)
          mountedCandidates.push({
            fiber,
            reactVisibility: entry.reactVisibility,
            frozen: entry.frozen,
            componentName,
            instance,
            observed: wasInstanceObserved(instance.fiberId),
            renderUnanalyzed: wasInstanceRenderUnanalyzed(instance.fiberId),
          })
        }
      }
    }
    if (fiber.sibling)
      stack.push({
        fiber: fiber.sibling,
        reactVisibility: entry.reactVisibility,
        frozen: entry.frozen,
      })
    if (fiber.child)
      stack.push({ fiber: fiber.child, reactVisibility: childVisibility, frozen: childFrozen })
  }

  // Duplicate roots/fibers left on the stack do not represent missing data.
  const scanTruncated = stack.some(({ fiber }) => !visitedFibers.has(fiber))
  const identityCoverage = getInstanceIdentityCoverage()
  const { pendingUnmountFibers = 0, ...reportedCoverageGaps } = coverageGaps
  const effectiveCoverageGaps = {
    ...reportedCoverageGaps,
    droppedUnmountFibers:
      coverageGaps.droppedUnmountFibers +
      identityCoverage.droppedTombstones +
      identityCoverage.excludedLifecycleFibers,
    generationHistoryEvictions: identityCoverage.generationHistoryEvictions,
    pausedCommits: coverageGaps.pausedCommits ?? 0,
    unobservedCommits: coverageGaps.unobservedCommits ?? 0,
    refreshCommitsExcluded: coverageGaps.refreshCommitsExcluded ?? 0,
    propsNotEnumeratedFibers: coverageGaps.propsNotEnumeratedFibers ?? 0,
    budgetExhaustedCommits: coverageGaps.budgetExhaustedCommits ?? 0,
    budgetExhaustedSubsystems: coverageGaps.budgetExhaustedSubsystems ?? [],
  }
  const rootCount = roots.length
  const scannedRootCount = scannedRoots.size
  const rootAvailable = rootCount > 0
  const rootScopeComplete = committedScope.rootCount > 0 && !rootScopeTruncated
  const renderCoverageComplete =
    rootAvailable &&
    rootScopeComplete &&
    scannedRootCount === rootCount &&
    !scanTruncated &&
    pendingUnmountFibers === 0 &&
    identityCoverage.unanalyzedRenderIdentityComplete &&
    effectiveCoverageGaps.droppedUnmountFibers === 0 &&
    effectiveCoverageGaps.analysisFailedFibers === 0 &&
    effectiveCoverageGaps.pausedCommits === 0 &&
    effectiveCoverageGaps.unobservedCommits === 0 &&
    effectiveCoverageGaps.refreshCommitsExcluded === 0 &&
    effectiveCoverageGaps.generationHistoryEvictions === 0
  const complete =
    renderCoverageComplete &&
    effectiveCoverageGaps.skippedCommitFibers === 0 &&
    effectiveCoverageGaps.budgetExhaustedCommits === 0
  const inputAttributionComplete =
    complete &&
    effectiveCoverageGaps.truncatedInputFibers === 0 &&
    effectiveCoverageGaps.propsNotEnumeratedFibers === 0
  const mountedUnclassified: Omit<
    CohortInstance,
    'source' | 'sourceOwnership' | 'sourceProvenance'
  >[] = mountedCandidates.map((entry) => ({
    renderingState: entry.frozen
      ? 'mounted-frozen'
      : entry.reactVisibility === 'hidden'
        ? 'mounted-hidden'
        : entry.reactVisibility === 'unknown'
          ? 'mounted-unknown'
          : 'mounted-rendering',
    reactVisibility: entry.reactVisibility,
    componentName: entry.componentName,
    status: entry.observed
      ? ('mounted-updated' as const)
      : renderCoverageComplete && !entry.renderUnanalyzed
        ? ('mounted-idle' as const)
        : ('mounted-unknown' as const),
    instance: entry.instance,
  }))
  const unmountedUnfiltered: CohortInstance[] = observation
    ? getInstanceTombstones()
        .filter((entry) => entry.observationId === observation.id)
        .filter((entry) => {
          seenNames.add(entry.componentName)
          return named(entry.componentName)
        })
        .map((entry) => ({
          componentName: entry.componentName,
          sourceOwnership: entry.ownership.ownership,
          source: entry.ownership.source,
          sourceProvenance: sourceProvenanceForSource(entry.ownership.source),
          status: 'unmounted' as const,
          renderingState: 'unmounted' as const,
          reactVisibility: 'unknown' as const,
          instance: entry.instance,
          profileCommitId: entry.profileCommitId,
          documentCommitId: entry.documentCommitId,
        }))
    : []

  const { classes } = await classifyFibersWithinBudget(
    mountedCandidates.map((entry) => entry.fiber),
  )
  const current = reportStateMatches(epoch)
  const mountedUnfiltered: CohortInstance[] = mountedUnclassified.map((entry, index) => {
    const classification = current
      ? (classes[index] ?? { ownership: 'unknown' as const, source: null })
      : { ownership: 'unknown' as const, source: null }
    return {
      ...entry,
      sourceOwnership: classification.ownership,
      source: classification.source,
      sourceProvenance: sourceProvenanceForSource(classification.source),
    }
  })
  const ownership = ownershipCoverage(
    [...mountedUnfiltered, ...unmountedUnfiltered].map((entry) => entry.sourceOwnership),
  )
  const mounted = mountedUnfiltered.filter(
    (entry) => !query.appOnly || !isHiddenByAppOnly(entry.sourceOwnership),
  )
  const unmounted = unmountedUnfiltered.filter(
    (entry) => !query.appOnly || !isHiddenByAppOnly(entry.sourceOwnership),
  )
  const all = [...mounted, ...unmounted]
  const mountedUpdated = mounted.filter((entry) => entry.status === 'mounted-updated').length
  const mountedIdle = mounted.filter((entry) => entry.status === 'mounted-idle').length
  const mountedUnknown = mounted.filter((entry) => entry.status === 'mounted-unknown').length
  const matched = all.length
  const instances = all.slice(0, query.limit)

  return {
    attribution: reportAttribution(epoch),
    documentCommitId: epoch.documentCommitId,
    ownershipCoverage: { ...ownership, affects: query.appOnly ? 'result' : 'ownership-labels' },
    observation,
    query: { component: query.component, exact: query.exact },
    componentMatch: describeComponentMatch(query, seenNames),
    status: cohortStatus({
      observation,
      mountedUpdated,
      mountedIdle,
      mountedUnknown,
      unmounted: unmounted.length,
      renderCoverageComplete: renderCoverageComplete && (!query.appOnly || ownership.complete),
    }),
    matched,
    mountedUpdated,
    mountedIdle,
    mountedUnknown,
    unmounted: unmounted.length,
    returned: instances.length,
    omittedByLimit: Math.max(0, matched - instances.length),
    rendererBundle: rendererBundleOf(mountedCandidates.map((entry) => entry.fiber)),
    instances,
    coverage: {
      complete: complete && current && (!query.appOnly || ownership.complete),
      freezeDetection,
      scannedFibers,
      scanLimit: COHORT_SCAN_LIMIT,
      scanTruncated,
      rootAvailable,
      rootCount,
      scannedRootCount,
      rootLimit: committedScope.rootLimit,
      rootScope,
      rootScopeComplete,
      rootScopeTruncated,
      inputAttributionComplete,
      ...effectiveCoverageGaps,
    },
  }
}

function cohortStatus(input: {
  observation: ObservationWindow | null
  mountedUpdated: number
  mountedIdle: number
  mountedUnknown: number
  unmounted: number
  renderCoverageComplete: boolean
}): CohortStatus {
  if (!input.observation) return 'not-started'
  const populated = [
    input.mountedUpdated,
    input.mountedIdle,
    input.mountedUnknown,
    input.unmounted,
  ].filter((count) => count > 0).length
  if (populated > 1) return 'mixed'
  if (input.mountedUpdated > 0) return 'updated'
  if (input.mountedIdle > 0) return 'mounted-idle'
  if (input.mountedUnknown > 0) return 'unknown'
  if (input.unmounted > 0) return 'unmounted'
  return input.renderCoverageComplete ? 'absent' : 'unknown'
}

type CohortSummary = ToolOutput<typeof reactComponentCohortContract> & { view: 'summary' }
type CohortSummaryInstance = CohortSummary['instances'][number]
type CohortShared = CohortSummary['shared']
type SharedField = Exclude<keyof CohortShared, 'logicalPathPrefix'>

const PATH_SEPARATOR = ' > '
/** Shared fields a row repeats when its own value differs; the identity-evidence fields stay shared-only. */
const ROW_FIELDS = [
  'componentName',
  'sourceOwnership',
  'source',
  'parent',
  'renderingState',
  'reactVisibility',
] as const satisfies readonly SharedField[]

const SHARED_FIELDS: { [Field in SharedField]: (row: CohortInstance) => CohortShared[Field] } = {
  componentName: (row) => row.componentName,
  sourceOwnership: (row) => row.sourceOwnership,
  source: (row) => formatSourceLocation(row.source),
  parent: (row) => row.instance.parent,
  keyedParent: (row) => row.instance.keyedParent,
  logicalIdentityEvidence: (row) => row.instance.logicalIdentityEvidence,
  mountGenerationEvidence: (row) => row.instance.mountGenerationEvidence,
  renderingState: (row) => row.renderingState,
  reactVisibility: (row) => row.reactVisibility,
}

/** State the value most instances share once and keep on each row only what tells it apart, so a list of a hundred rows stays readable; a row whose value differs carries its own. */
export function summarizeCohort(cohort: RenderCohort): CohortSummary {
  const { instances, ...report } = cohort
  const shared = sharedCohortFields(instances)
  const prefix = shared.logicalPathPrefix
  return {
    ...report,
    view: 'summary',
    shared,
    instances: instances.map((row): CohortSummaryInstance => {
      const { instance } = row
      const underPrefix =
        prefix !== '' && instance.logicalPath.startsWith(`${prefix}${PATH_SEPARATOR}`)
      const own: Partial<CohortSummaryInstance> = {}
      for (const field of ROW_FIELDS) {
        const value = SHARED_FIELDS[field](row)
        if (!(field in shared) || !sameValue(value, shared[field])) {
          Object.assign(own, { [field]: value })
        }
      }
      return {
        status: row.status,
        mountId: instance.mountId,
        fiberId: instance.fiberId,
        ...(instance.key === null ? {} : { key: instance.key }),
        ...(instance.siblingIndex === null ? {} : { siblingIndex: instance.siblingIndex }),
        logicalPath: underPrefix
          ? instance.logicalPath.slice(prefix.length + PATH_SEPARATOR.length)
          : instance.logicalPath,
        ...(underPrefix || prefix === '' ? {} : { outsidePrefix: true as const }),
        mountGeneration: instance.mountGeneration,
        hostSelector: instance.hostSelector,
        ...(row.documentCommitId === undefined ? {} : { documentCommitId: row.documentCommitId }),
        ...own,
      }
    }),
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** The most common value of each field, and the parent path most instances sit under. */
function sharedCohortFields(instances: CohortInstance[]): CohortShared {
  const parentPaths = instances.map((row) =>
    row.instance.logicalPath.split(PATH_SEPARATOR).slice(0, -1).join(PATH_SEPARATOR),
  )
  const fields: CohortShared = { logicalPathPrefix: mostCommon(parentPaths) ?? '' }
  for (const field of Object.keys(SHARED_FIELDS) as SharedField[]) {
    const read = SHARED_FIELDS[field]
    const values = instances.map((row) => JSON.stringify(read(row)))
    const common = mostCommon(values)
    const sample = instances[values.indexOf(common ?? '')]
    if (common !== undefined && sample) Object.assign(fields, { [field]: read(sample) })
  }
  return fields
}

function mostCommon(values: string[]): string | undefined {
  const counts = new Map<string, number>()
  let best: string | undefined
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1
    counts.set(value, count)
    if (best === undefined || count > (counts.get(best) ?? 0)) best = value
  }
  return best
}
