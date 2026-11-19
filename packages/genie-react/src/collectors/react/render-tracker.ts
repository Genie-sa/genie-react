import {
  type Fiber,
  type FiberRoot,
  getFiberId,
  getRDTHook,
  hasMemoCache,
  instrument,
  isCompositeFiber,
  type RenderPhase,
  setFiberId,
  traverseRenderedFibers,
  type Unsubscribe,
} from 'bippy'
import { compactRenderCause, newId } from '../../protocol'
import { MAXIMUM_RENDER_OBSERVATION_BUDGET as MAXIMUM_BUDGET } from '../../protocol/react-observation-schema'
import {
  registerQuerySubscriber,
  setExternalStoreObservation,
} from '../causal/external-store-registry'
import { noteRenderWindowStart } from '../causal/redux-store-registry'
import { isDataDescriptor, safeOwnPropertyDescriptor } from '../causal/safe-object'
import { safeStructuredClone } from '../structured-clone'
import { getTimings } from './bippy-compat'
import {
  instrumentClassFiber,
  restoreClassInstrumentation,
  takeClassUpdates,
} from './class-updates'
import {
  type CommitWorkBudget,
  commitWorkExhaustions,
  consumeCommitWork,
  createCommitWorkBudget,
} from './commit-budget'
import type { ComponentMatch } from './component-name'
import { recordResultingEffectCommit } from './effect-events'
import {
  clearEffects,
  type EffectScheduleObservation,
  type PreparedEffectObservation,
  prepareEffect,
  removeEffectRecord,
  scheduledEffectCount,
} from './effect-tracker'
import {
  clearErrorState,
  noteUnanalyzedRendererCommit,
  noteUnscannedCommit,
  recordBoundaryCommit,
  recordErrorState,
} from './error-tracker'
import {
  findAllCommittedRootFibers,
  isReactWorkScheduled,
  nameOf,
  noteCommit,
  noteCommittedRoot,
} from './fiber'
import {
  beginInstanceObservation,
  discardExcludedInstanceUnmount,
  getInstanceIdentityCoverage,
  invalidateLiveInstancesForRefresh,
  noteInstanceRender,
  noteUnanalyzedInstanceRender,
  noteUnobservedMounts,
  prepareInstanceRender,
  releaseInstance,
} from './instance-identity'
import { getMeasurementEnvironment } from './measurement-environment'
import {
  beginMeasurementCommit,
  clearMeasurementSpans,
  hasOpenMeasurementSpan,
  markMeasurementCollectionGap,
  markMeasurementIncomplete,
  noteMeasurementUnmount,
  recordMeasurementRender,
} from './measurement-spans'
import {
  beginObservation,
  getActiveObservation,
  getDocumentCommitId,
  hasActiveObservation,
  isCommitAnalysisHeld,
  nextCausalEventId,
  noteAnalysisInvalidation,
  noteDocumentCommit,
  type ObservationWindow,
} from './observation'
import { isRefreshCommit, noteExcludedRefreshCommit } from './refresh-tracker'
import {
  createRenderEvidenceBudget,
  inputCoverage,
  type RenderInputCoverage,
} from './render-budget'
import {
  diffContextChanges,
  diffExternalStoreChanges,
  type PendingQuerySubscriberRegistration,
  type RenderCause,
  type RenderCauseEvent,
  type RenderNecessity,
} from './render-causes'
import { type CommitAnalysisBudget, createCommitAnalysisBudget } from './render-commit-budget'
import { compareRenderInputs } from './render-equivalence'
import {
  childrenChanged,
  classStateCauseName,
  diffProps,
  diffStateChanges,
  diffUnclassifiedHooks,
  isFunctionIdentityChange,
  type PropRenderChange,
  type RenderChange,
} from './render-inputs'
import type {
  RenderRecord,
  RenderReport,
  RenderSummary,
  ReportAttribution,
  RetainedRenderCauseEvent,
} from './render-model'
import { draftRenderRecord } from './render-model'
import {
  applyOutputAssessment,
  assessRender,
  type CurrentCommitEvidence,
  type PendingRenderGrade,
  type RenderAssessment,
} from './render-outcomes'
import {
  attributeCommitOutput,
  type CommitRenderFacts,
  gradeRender,
  type NecessityGrade,
  ownUpdateScheduled,
} from './render-output'
import {
  buildCurrentAggregateMeasurement,
  buildRenderCauseEventsReport,
  buildRenderSummary,
  buildRenders,
  buildRendersLeaderboards,
  buildRendersMeasurementReport,
  buildRendersReport,
  describeRecordMatch,
  type RenderCauseQuery,
  type RenderQuery,
  renderRecordFilter,
  type SourceClassificationCoverage,
} from './render-reports'
import {
  type AnalysisFailureReason,
  buildRenderTrackingCoverage,
  type CoverageGapDetails,
  diffRenderSnapshot,
  type RenderBudgetAdvice,
  type RenderBudgetLimit,
  type RenderTrackingCoverage,
  storeRenderSnapshot,
  withSourceCoverage,
} from './render-snapshots'
import { cascadeOrigin, wrapperOf } from './render-wrappers'
import { captureReportEpoch, reportAttribution, reportStateMatches } from './report-attribution'
import { isSafeRenderer, supportedCommitHandler } from './safe-instrumentation'
import { clearSourceCache } from './source'
import { mayHaveHidden } from './suspense-hide-log'
import { canBailOutOnProps, comparesPropsShallowly, isSuspenseFiber } from './work-tags'

export type {
  RenderCause,
  RenderCauseCounts,
  RenderCauseKind,
  RenderNecessity,
} from './render-causes'
export { diffContextChanges, diffExternalStoreChanges } from './render-causes'
export type {
  ClassStateRenderChange,
  HookStateRenderChange,
  PropRenderChange,
  RenderChange,
  StateRenderChange,
} from './render-inputs'
export {
  childrenChanged,
  contextChanged,
  diffProps,
  diffStateChanges,
  stateChanged,
} from './render-inputs'
export type { RenderCauseQuery, RenderQuery } from './render-reports'
export { clearSnapshots, snapshotLabels } from './render-snapshots'
export type {
  CommitAnalysisBudget,
  RenderRecord,
  RenderReport,
  RenderSummary,
  ReportAttribution,
  RetainedRenderCauseEvent,
}
export { createCommitAnalysisBudget }

const records = new Map<number, RenderRecord>()
/** Unmounted records keep their window's renders; past the lifecycle buffer bound the oldest are evicted and counted as dropped unmount evidence. */
const unmountedRecordIds: number[] = []
let evictedUnmountedRecords = 0
const recentCauseEvents: RetainedRenderCauseEvent[] = []
let commits = 0
let installed = false
let instrumentation: Unsubscribe | null = null
let instrumentedHook: ReturnType<typeof getRDTHook> | null = null
// Stop is intentionally a soft flag: the commit handler stays wired so the client's liveness heartbeat continues while profiling is paused.
let paused = false
let renderersPresentAtInstall = false
let commitObservedSinceInstall = false
let skippedCommitFibers = 0
let droppedPendingUnmountFibers = 0
let analysisFailedFibers = 0
/** Commits React made after profiling paused; they are outside the measured window, not failed analysis. */
let pausedCommits = 0
/** Commits React made while no window, span or recording observed it; they were never analysed. */
let unobservedCommits = 0
/** Commits an observing window saw from a Fast Refresh, or close enough after one that they cannot be told apart; none of them were analysed. */
let refreshCommitsExcluded = 0
const analysisFailures = new Map<AnalysisFailureReason, number>()
const truncatedInputComponents = new Set<string>()
const propsNotEnumeratedComponents = new Set<string>()
const GAP_COMPONENT_LIMIT = 10
let truncatedInputFibers = 0
let propsNotEnumeratedFibers = 0
let budgetExhaustedCommits = 0
const budgetExhaustedSubsystems = new Map<string, number>()
let droppedRenderEvents = 0
let clears = 0
let targetedFibersProcessed = 0
let targetedFibersSkipped = 0
let droppedTargetUnmountFibers = 0
let adaptiveBudgetScale = 1
/** The scale that fits the most components this window has seen mounted or rendering at once; decay stops here. */
let treeBudgetScale = 1
/** Operation and time scale on top of the fiber scale: deep trees cost more work per analyzed component. */
let adaptiveCostScale = 1
let treeCostScale = 1
let commitsWithinAdaptiveBudget = 0
let suggestedMainScale = 0
let suggestedTargetScale = 0
/** Work a lossy commit would have needed, measured from what its analyzed components cost. */
let suggestedOperationLimit = 0
let suggestedTimeLimitMs = 0
const exhaustedBudgetLimits = new Set<RenderBudgetLimit>()

export interface RenderObservationOptions {
  /** Case-insensitive substrings of display names. */
  components?: string[]
  /** Exact, case-sensitive display names. */
  exactComponents?: string[]
  roots?: number[]
  budget?: {
    fiberLimit?: number
    operationLimit?: number
    timeLimitMs?: number
    targetOperationReserve?: number
    targetTimeReserveMs?: number
    adaptive?: boolean
  }
  lifecycle?: { bufferLimit?: number; targetReserve?: number }
}

interface RenderObservationConfiguration {
  components: string[]
  exactComponents: string[]
  roots: number[]
  budget: {
    fiberLimit: number
    operationLimit: number
    timeLimitMs: number
    targetOperationReserve: number
    targetTimeReserveMs: number
    adaptive: boolean
  }
  lifecycle: { bufferLimit: number; targetReserve: number }
}

const DEFAULT_OBSERVATION_CONFIGURATION: RenderObservationConfiguration = {
  components: [],
  exactComponents: [],
  roots: [],
  budget: {
    fiberLimit: 250,
    operationLimit: 20_000,
    timeLimitMs: 8,
    targetOperationReserve: 4_000,
    targetTimeReserveMs: 4,
    adaptive: true,
  },
  lifecycle: { bufferLimit: 1_000, targetReserve: 100 },
}

let observationConfiguration = safeStructuredClone(DEFAULT_OBSERVATION_CONFIGURATION)
/** True until a commit is analyzed, and again after any commit is not. */
let analysisCold = true
let observationRootIds = new Set<number>()
/** Bippy releases ids as React reports each unmount parent-first, so descendants read their deleted ancestors' root membership here, through either buffer a stale `return` may point at. */
let unmountedRootMembership = new WeakMap<Fiber, boolean>()

const ADAPTIVE_MAX_SCALE = 4
// Measured in jsdom: an analyzed component costs about 30 operations at the root and about 150 forty layout layers deep, mostly instance identity; these bound that from above.
const OPERATIONS_PER_COMPONENT = 40
const OPERATIONS_PER_ANCESTOR = 1.5
// Headroom over a measured requirement, because components later in a commit can cost more than the ones analyzed before it ran out.
const BUDGET_ADVICE_MARGIN = 1.25
const MOUNTED_TREE_VISIT_LIMIT = 100_000
// Hysteresis: one cheap commit after a burst must not shrink the budget the next burst needs.
const ADAPTIVE_DECAY_COMMITS = 30
// Measured in Chromium at a 2x CPU throttle: the first analyzed commit after unanalyzed ones took four times a warm commit, because V8 had not compiled the analysis code or had flushed it.
const COLD_COMMIT_TIME_FACTOR = 4

const DID_CAPTURE = 0b1000_0000
const RECENT_CAUSE_EVENT_LIMIT = 1_000
interface PendingUnmount {
  rendererId: number
  fiber: Fiber
  fiberId: number
  targeted: boolean
}
const pendingUnmounts: PendingUnmount[] = []
let targetedPendingUnmounts = 0
let uncertainTraversalRoots = new WeakMap<FiberRoot, string | null>()
let traversedRoots = new WeakSet<FiberRoot>()

let commitListener: (() => void) | null = null

/** Register a per-commit callback (the client's liveness pump). Called on every commit — even while paused — because a committing thread is alive regardless of whether we record it. */
export function setCommitListener(listener: (() => void) | null): void {
  commitListener = listener
}

/** Installs commit-time instrumentation on the active DevTools hook and (re)enables tracking; the hook must already be present before React loads, or no commits are delivered. */
export function startRenderTracking(): boolean {
  paused = false
  let currentHook: ReturnType<typeof getRDTHook>
  try {
    currentHook = getRDTHook()
  } catch {
    disposeRenderTracking()
    return false
  }
  if (installed && instrumentedHook === currentHook) return true
  if (installed) disposeRenderTracking()
  renderersPresentAtInstall = (currentHook?.renderers?.size ?? 0) > 0
  try {
    instrumentation = instrument({
      name: 'genie-react',
      onCommitFiberUnmount: (rendererId: number, fiber: Fiber) => {
        if (!isSafeUnmountRenderer(rendererId)) return
        queuePendingUnmount(rendererId, fiber)
      },
      onCommitFiberRoot: supportedCommitHandler((rendererId: number, root: FiberRoot) => {
        unmountRendererVerdicts.clear()
        commitListener?.()
        noteCommit()
        noteCommittedRoot(root)
        if (!isSafeRenderer(rendererId)) {
          markMeasurementCollectionGap()
          noteUnanalyzedRendererCommit()
          if (getActiveObservation()) noteAnalysisFailure('renderer-not-analyzed')
          return
        }
        // A refresh commit is still a commit: it takes an ID so timelines and settle checks see it, though nothing joins its analysis.
        noteDocumentCommit()
        if (isRefreshCommit()) {
          if (isTracking()) refreshCommitsExcluded += 1
          clearMeasurementSpans()
          advanceExcludedCommitBaseline(root)
          noteAnalysisInvalidation()
          discardPendingUnmounts(rendererId)
          invalidateLiveInstancesForRefresh()
          noteExcludedRefreshCommit()
          return
        }
        commitObservedSinceInstall = true
        const analyzed = isTracking()
        beginMeasurementCommit(
          getDocumentCommitId(),
          analyzed && !uncertainTraversalRoots.has(root),
        )
        recordResultingEffectCommit(getDocumentCommitId())
        if (!analyzed) {
          recordUnanalyzedCommit(rendererId, root)
          return
        }
        if (uncertainTraversalRoots.has(root)) {
          const uncertaintyObservationId = uncertainTraversalRoots.get(root)
          discardPendingUnmounts(rendererId)
          const failuresBeforeRecovery = analysisFailedFibers
          advanceExcludedCommitBaseline(root)
          if (
            uncertaintyObservationId !== (getActiveObservation()?.id ?? null) &&
            analysisFailedFibers === failuresBeforeRecovery
          ) {
            noteAnalysisFailure('traversal-failed')
          }
          return
        }
        commits += 1
        const effective = commitTimeAllowance(effectiveObservationBudget())
        analysisCold = false
        const budget = createCommitAnalysisBudget(
          effective.fiberLimit,
          {
            operationLimit: effective.operationLimit,
            timeLimitMs: effective.timeLimitMs,
          },
          {
            operationLimit: effective.targetOperationReserve,
            timeLimitMs: effective.targetTimeReserveMs,
          },
        )
        recordPendingUnmounts(rendererId, budget)
        const candidates: { fiber: Fiber; phase: RenderPhase }[] = []
        const targetedCandidates: { fiber: Fiber; phase: RenderPhase }[] = []
        try {
          traverseRenderedFibers(root, (fiber, reportedPhase) => {
            recordBoundaryCommit(fiber, matchesObservedComponent)
            // Bippy reports a Suspense re-reveal as a mount; a fiber with an alternate has committed before.
            const phase = reportedPhase === 'mount' && fiber.alternate ? 'update' : reportedPhase
            const targeted = isObservationTarget(fiber)
            const traversalWork = targeted ? budget.targetWork : budget.work
            // Bippy reported this render; a declined analysis must not hide it from descendants looking for their rendered parent.
            budget.currentCommitEvidence.renderedFibers.add(fiber)
            if (
              !consumeCommitWork(traversalWork, targeted ? 'target-traversal' : 'commit-traversal')
            ) {
              if (shouldAnalyzeCommitFiber(fiber)) {
                if (targeted) {
                  budget.targetSkipped += 1
                  targetedFibersSkipped += 1
                } else {
                  budget.skipped += 1
                }
                noteSkippedCommitFiber(fiber)
              }
              return
            }
            if (!shouldAnalyzeCommitFiber(fiber)) return
            if (targeted) {
              targetedCandidates.push({ fiber, phase })
              return
            }
            if (candidates.length >= budget.limit) {
              budget.skipped += 1
              noteSkippedCommitFiber(fiber)
              return
            }
            candidates.push({ fiber, phase })
          })
        } catch {
          noteUnscannedCommit()
          budget.failed += 1
          noteAnalysisFailure('traversal-failed')
          uncertainTraversalRoots.set(root, getActiveObservation()?.id ?? null)
          finalizeCommitAnalysisBudget(budget)
          return
        }
        traversedRoots.add(root)
        for (const candidate of targetedCandidates) {
          recordCommitFiber(candidate.fiber, candidate.phase, budget, true)
        }
        for (const candidate of candidates) {
          recordCommitFiber(candidate.fiber, candidate.phase, budget)
        }
        gradeCommitRenders(budget.currentCommitEvidence, effective.timeLimitMs)
        finalizeCommitAnalysisBudget(budget)
      }),
    })
    instrumentedHook = currentHook
    installed = true
  } catch {
    disposeRenderTracking()
  }
  return installed
}

/** Whether commits get the per-component analysis: only an open render window, an open measurement span or a recording such as a timeline asks for it, and react_profile_stop freezes it even then. */
export function isTracking(): boolean {
  return (
    installed &&
    !paused &&
    (hasActiveObservation() || hasOpenMeasurementSpan() || isCommitAnalysisHeld())
  )
}

/** A commit nothing observes keeps what a reader arriving later still needs: boundary catches, Bippy's traversal baseline, and mount generations. */
function recordUnanalyzedCommit(rendererId: number, root: FiberRoot): void {
  analysisCold = true
  if (paused) {
    pausedCommits += 1
    discardPendingUnmounts(rendererId)
  } else {
    unobservedCommits += 1
    discardPendingUnmounts(rendererId, forgetUnobservedUnmount)
  }
  if (!hasSettledBaseline(root) || mayHaveCaught(root) || mayHaveHidden(root.current)) {
    advanceExcludedCommitBaseline(root)
  }
  noteUnobservedMounts(root.current)
}

/** Bippy keeps one previous Fiber per root and reads it only while the root's current Fiber has no alternate, which React sets at the root's first commit; after one clean traversal, an excluded commit can skip the walk without changing what a later traversal reports. */
function hasSettledBaseline(root: FiberRoot): boolean {
  return traversedRoots.has(root) && !uncertainTraversalRoots.has(root)
}

/** React bubbles every non-static flag of a re-rendered fiber into its ancestors' subtreeFlags, so a root without DidCapture there committed no catch. */
function mayHaveCaught(root: FiberRoot): boolean {
  const { flags, subtreeFlags } = root.current
  return ((flags | subtreeFlags) & DID_CAPTURE) !== 0
}

// React reports every deleted fiber before its commit's root callback, which clears this; a renderer's verdict cannot change inside one commit, so it is decided once per commit rather than once per deleted fiber.
const unmountRendererVerdicts = new Map<number, boolean>()

function isSafeUnmountRenderer(rendererId: number): boolean {
  let verdict = unmountRendererVerdicts.get(rendererId)
  if (verdict === undefined) {
    verdict = isSafeRenderer(rendererId)
    unmountRendererVerdicts.set(rendererId, verdict)
  }
  return verdict
}

/** Advance Bippy's per-root previous-Fiber baseline without retaining excluded commit evidence; catches and Suspense hides are still recorded, since they are screen state. */
function advanceExcludedCommitBaseline(root: FiberRoot): void {
  try {
    traverseRenderedFibers(root, (fiber) => recordBoundaryCommit(fiber, matchesObservedComponent))
    uncertainTraversalRoots.delete(root)
    traversedRoots.add(root)
  } catch {
    noteUnscannedCommit()
    uncertainTraversalRoots.set(root, getActiveObservation()?.id ?? null)
    noteAnalysisFailure('traversal-failed')
  }
}

/** Module/HMR teardown only. Profiling stop must keep the lightweight commit heartbeat installed. */
export function disposeRenderTracking(): void {
  analysisCold = true
  clearMeasurementSpans()
  renderPages = new Map()
  noteAnalysisInvalidation()
  for (const pending of pendingUnmounts) forgetUnmountWithoutTombstone(pending)
  replacePendingUnmounts([])
  invalidateLiveInstancesForRefresh()
  instrumentation?.()
  instrumentation = null
  instrumentedHook = null
  restoreClassInstrumentation()
  installed = false
  commitObservedSinceInstall = false
  paused = false
  unmountRendererVerdicts.clear()
  uncertainTraversalRoots = new WeakMap()
  traversedRoots = new WeakSet()
  noteRenderWindowStart(null)
}

/** Pause commit recording without uninstalling instrumentation; isTracking() reports false until startRenderTracking() resumes. */
export function stopRenderTracking(): void {
  paused = true
}

const recordingClassUpdates = (): boolean => isTracking() && getActiveObservation() !== null
export const isRenderTrackingInstalled = (): boolean => installed
export const isRecordingPaused = (): boolean => paused
export const getCommitCount = (): number => commits

/** Distinguishes "nothing re-rendered" from "the hook could not observe renders" — a zero report is only evidence when collection is available. */
export function renderCollectionStatus(): string {
  if (!installed) {
    return 'unavailable (render tracking is not installed — import genie-react/hook before React)'
  }
  if (renderersPresentAtInstall && !commitObservedSinceInstall) {
    return 'unavailable (hook installed after React initialised — import genie-react/hook, or genie-react/native on React Native, before React)'
  }
  if (renderersPresentAtInstall) {
    return 'degraded (hook installed after React initialised — commits before that point were not observed)'
  }
  return 'available'
}
export const getSkippedCommitFiberCount = (): number => skippedCommitFibers
export const getDroppedPendingUnmountFiberCount = (): number => droppedPendingUnmountFibers
export const getPendingUnmountFiberCount = (): number => pendingUnmounts.length
export const getAnalysisFailedFiberCount = (): number => analysisFailedFibers
export const getPausedCommitCount = (): number => pausedCommits
export const getUnobservedCommitCount = (): number => unobservedCommits
export const getRefreshCommitsExcludedCount = (): number => refreshCommitsExcluded

function noteAnalysisFailure(reason: AnalysisFailureReason): void {
  analysisFailedFibers += 1
  analysisFailures.set(reason, (analysisFailures.get(reason) ?? 0) + 1)
}

function noteGapComponent(names: Set<string>, name: string): void {
  if (names.size < GAP_COMPONENT_LIMIT) names.add(name)
}

/** The reasons behind the analysis-failure and input-gap counters, for coverage that says why it is incomplete. */
export function getCoverageGapDetails(): CoverageGapDetails {
  return {
    analysisFailures: [...analysisFailures].map(([reason, fibers]) => ({ reason, fibers })),
    truncatedInputComponents: [...truncatedInputComponents],
    propsNotEnumeratedComponents: [...propsNotEnumeratedComponents],
  }
}
export const getTruncatedInputFiberCount = (): number => truncatedInputFibers
export const getPropsNotEnumeratedFiberCount = (): number => propsNotEnumeratedFibers
export const getBudgetExhaustedCommitCount = (): number => budgetExhaustedCommits
export const getBudgetExhaustedSubsystems = (): { subsystem: string; commits: number }[] =>
  [...budgetExhaustedSubsystems]
    .map(([subsystem, count]) => ({ subsystem, commits: count }))
    .sort((left, right) => left.subsystem.localeCompare(right.subsystem))
export const getDroppedRenderEventCount = (): number => droppedRenderEvents

export function getRenderTrackingCoverage(
  scope: 'causal' | 'measurement' = 'causal',
): RenderTrackingCoverage {
  const coverage = buildRenderTrackingCoverage(
    {
      skippedCommitFibers,
      droppedUnmountFibers: getDroppedUnmountEvidenceCount(),
      analysisFailedFibers,
      pausedCommits,
      unobservedCommits,
      refreshCommitsExcluded,
      truncatedInputFibers,
      propsNotEnumeratedFibers,
      budgetExhaustedCommits,
      budgetExhaustedSubsystems: getBudgetExhaustedSubsystems(),
      budgetAdvice: getRenderBudgetAdvice(),
      gaps: getCoverageGapDetails(),
    },
    scope,
  )
  return {
    ...coverage,
    targeted: {
      components: [
        ...observationConfiguration.exactComponents,
        ...observationConfiguration.components,
      ],
      roots: [...observationConfiguration.roots],
      processedFibers: targetedFibersProcessed,
      skippedFibers: targetedFibersSkipped,
      complete: targetedFibersSkipped === 0 && droppedTargetUnmountFibers === 0,
    },
    observationBudget: getRenderObservationConfig(),
  }
}

function getDroppedUnmountEvidenceCount(): number {
  const identityCoverage = getInstanceIdentityCoverage()
  return (
    droppedPendingUnmountFibers +
    evictedUnmountedRecords +
    identityCoverage.droppedTombstones +
    identityCoverage.excludedLifecycleFibers
  )
}

export function clearRenders(options: RenderObservationOptions = {}): ObservationWindow {
  renderPages = new Map()
  configureRenderObservation(options)
  records.clear()
  unmountedRecordIds.length = 0
  evictedUnmountedRecords = 0
  recentCauseEvents.length = 0
  commits = 0
  skippedCommitFibers = 0
  droppedPendingUnmountFibers = 0
  analysisFailedFibers = 0
  pausedCommits = 0
  unobservedCommits = 0
  refreshCommitsExcluded = 0
  analysisFailures.clear()
  truncatedInputComponents.clear()
  propsNotEnumeratedComponents.clear()
  truncatedInputFibers = 0
  propsNotEnumeratedFibers = 0
  budgetExhaustedCommits = 0
  budgetExhaustedSubsystems.clear()
  droppedRenderEvents = 0
  targetedFibersProcessed = 0
  targetedFibersSkipped = 0
  droppedTargetUnmountFibers = 0
  const mountedTree = mountedTreeScale()
  treeBudgetScale = mountedTree.fiberScale
  adaptiveBudgetScale = treeBudgetScale
  treeCostScale = mountedTree.costScale
  adaptiveCostScale = treeCostScale
  commitsWithinAdaptiveBudget = 0
  suggestedMainScale = 0
  suggestedTargetScale = 0
  suggestedOperationLimit = 0
  suggestedTimeLimitMs = 0
  exhaustedBudgetLimits.clear()
  for (const pending of pendingUnmounts) forgetUnmountWithoutTombstone(pending)
  replacePendingUnmounts([])
  clears++
  clearEffects()
  clearErrorState()
  clearSourceCache()
  instrumentMountedClasses()
  const observation = beginObservation()
  setExternalStoreObservation(observation)
  const openedAt = globalThis.performance?.now?.()
  noteRenderWindowStart(
    openedAt === undefined ? null : { at: openedAt, settled: !isReactWorkScheduled() },
  )
  beginInstanceObservation(observation.id)
  return observation
}

export function getRenderObservationConfig(): NonNullable<
  RenderTrackingCoverage['observationBudget']
> {
  const effective = effectiveObservationBudget()
  return {
    adaptive: observationConfiguration.budget.adaptive,
    adaptiveScale: adaptiveBudgetScale,
    fiberLimit: effective.fiberLimit,
    operationLimit: effective.operationLimit,
    timeLimitMs: effective.timeLimitMs,
    targetOperationReserve: effective.targetOperationReserve,
    targetTimeReserveMs: effective.targetTimeReserveMs,
    lifecycleBufferLimit: observationConfiguration.lifecycle.bufferLimit,
    lifecycleTargetReserve: observationConfiguration.lifecycle.targetReserve,
  }
}

function configureRenderObservation(options: RenderObservationOptions): void {
  observationConfiguration = {
    components: [...new Set(options.components ?? [])].map((name) => name.toLowerCase()),
    exactComponents: [...new Set(options.exactComponents ?? [])],
    roots: [...new Set(options.roots ?? [])],
    budget: {
      fiberLimit: options.budget?.fiberLimit ?? DEFAULT_OBSERVATION_CONFIGURATION.budget.fiberLimit,
      operationLimit:
        options.budget?.operationLimit ?? DEFAULT_OBSERVATION_CONFIGURATION.budget.operationLimit,
      timeLimitMs:
        options.budget?.timeLimitMs ?? DEFAULT_OBSERVATION_CONFIGURATION.budget.timeLimitMs,
      targetOperationReserve:
        options.budget?.targetOperationReserve ??
        DEFAULT_OBSERVATION_CONFIGURATION.budget.targetOperationReserve,
      targetTimeReserveMs:
        options.budget?.targetTimeReserveMs ??
        DEFAULT_OBSERVATION_CONFIGURATION.budget.targetTimeReserveMs,
      adaptive: options.budget?.adaptive ?? DEFAULT_OBSERVATION_CONFIGURATION.budget.adaptive,
    },
    lifecycle: {
      bufferLimit:
        options.lifecycle?.bufferLimit ?? DEFAULT_OBSERVATION_CONFIGURATION.lifecycle.bufferLimit,
      targetReserve:
        options.lifecycle?.targetReserve ??
        DEFAULT_OBSERVATION_CONFIGURATION.lifecycle.targetReserve,
    },
  }
  observationRootIds = new Set(observationConfiguration.roots)
  unmountedRootMembership = new WeakMap()
}

function grown(configured: number, scale: number, ceiling: number): number {
  return Math.max(configured, Math.min(ceiling, configured * scale))
}

function scaledBudget(scale: number, costScale = 1): RenderObservationConfiguration['budget'] {
  const configured = observationConfiguration.budget
  const workScale = scale * costScale
  return {
    ...configured,
    fiberLimit: grown(configured.fiberLimit, scale, MAXIMUM_BUDGET.fiberLimit),
    operationLimit: grown(configured.operationLimit, workScale, MAXIMUM_BUDGET.operationLimit),
    timeLimitMs: grown(configured.timeLimitMs, workScale, MAXIMUM_BUDGET.timeLimitMs),
  }
}

function effectiveObservationBudget(): RenderObservationConfiguration['budget'] {
  return observationConfiguration.budget.adaptive
    ? scaledBudget(adaptiveBudgetScale, adaptiveCostScale)
    : scaledBudget(1)
}

/** A cold commit gets more time so a window's first interaction keeps its input evidence; the operation limit still bounds its work. */
function commitTimeAllowance(
  budget: RenderObservationConfiguration['budget'],
): RenderObservationConfiguration['budget'] {
  if (!analysisCold) return budget
  return {
    ...budget,
    timeLimitMs: Math.min(MAXIMUM_BUDGET.timeLimitMs, budget.timeLimitMs * COLD_COMMIT_TIME_FACTOR),
    targetTimeReserveMs: Math.min(
      MAXIMUM_BUDGET.targetTimeReserveMs,
      budget.targetTimeReserveMs * COLD_COMMIT_TIME_FACTOR,
    ),
  }
}

const currentBudgetScale = (): number =>
  observationConfiguration.budget.adaptive ? adaptiveBudgetScale : 1

const maxAdaptiveScale = (): number =>
  Math.max(
    ADAPTIVE_MAX_SCALE,
    Math.ceil(MAXIMUM_BUDGET.fiberLimit / observationConfiguration.budget.fiberLimit),
  )

/** The scale whose fiber limit fits `fibers` analyzable components, so one commit that re-renders them all loses none. */
function scaleFittingFibers(fibers: number): number {
  return Math.min(
    maxAdaptiveScale(),
    Math.max(1, Math.ceil(fibers / observationConfiguration.budget.fiberLimit)),
  )
}

/** An analyzed render wraps its class's prototype to record setState calls; a class that rendered only while nothing observed is wrapped here, so the window records its first update. */
function instrumentMountedClasses(): void {
  const stack = [...findAllCommittedRootFibers().roots]
  for (let visited = 0; stack.length > 0 && visited < MOUNTED_TREE_VISIT_LIMIT; visited++) {
    const fiber = stack.pop() as Fiber
    instrumentClassFiber(fiber, recordingClassUpdates)
    if (fiber.sibling) stack.push(fiber.sibling)
    if (fiber.child) stack.push(fiber.child)
  }
}

/** Size an adaptive window from the tree already mounted, because growth after an exhausted commit cannot restore that commit; a component's analysis walks its ancestors, so deeper trees get proportionally more work per component. */
function mountedTreeScale(): { fiberScale: number; costScale: number } {
  if (!observationConfiguration.budget.adaptive) return { fiberScale: 1, costScale: 1 }
  const stack: [Fiber, number][] = findAllCommittedRootFibers().roots.map((root) => [root, 0])
  let analyzable = 0
  let analyzableDepth = 0
  let visited = 0
  while (
    stack.length > 0 &&
    visited < MOUNTED_TREE_VISIT_LIMIT &&
    analyzable < MAXIMUM_BUDGET.fiberLimit
  ) {
    const [fiber, depth] = stack.pop() as [Fiber, number]
    visited += 1
    if (shouldAnalyzeCommitFiber(fiber)) {
      analyzable += 1
      analyzableDepth += depth
    }
    if (fiber.sibling) stack.push([fiber.sibling, depth])
    if (fiber.child) stack.push([fiber.child, depth + 1])
  }
  const averageDepth = analyzable === 0 ? 0 : analyzableDepth / analyzable
  return {
    fiberScale: scaleFittingFibers(analyzable),
    costScale: costScaleFor(OPERATIONS_PER_COMPONENT + OPERATIONS_PER_ANCESTOR * averageDepth),
  }
}

/** How much more work than the configured per-component share one analyzed component needs, in half steps. */
function costScaleFor(operationsPerComponent: number): number {
  const configured = observationConfiguration.budget
  const configuredShare = configured.operationLimit / configured.fiberLimit
  return Math.max(1, Math.ceil((2 * operationsPerComponent) / configuredShare) / 2)
}

/** Which limit lost evidence in this window, and a budget estimated to fit the largest lossy commit. */
export function getRenderBudgetAdvice(): RenderBudgetAdvice | undefined {
  if (exhaustedBudgetLimits.size === 0) return undefined
  const configured = observationConfiguration.budget
  const main = scaledBudget(suggestedMainScale, adaptiveCostScale)
  const suggestedBudget = {
    fiberLimit: main.fiberLimit,
    operationLimit: Math.min(
      MAXIMUM_BUDGET.operationLimit,
      Math.max(main.operationLimit, suggestedOperationLimit),
    ),
    timeLimitMs: Math.min(
      MAXIMUM_BUDGET.timeLimitMs,
      Math.max(main.timeLimitMs, suggestedTimeLimitMs),
    ),
    targetOperationReserve: grown(
      configured.targetOperationReserve,
      suggestedTargetScale,
      MAXIMUM_BUDGET.targetOperationReserve,
    ),
    targetTimeReserveMs: grown(
      configured.targetTimeReserveMs,
      suggestedTargetScale,
      MAXIMUM_BUDGET.targetTimeReserveMs,
    ),
  }
  const exhaustedLimits = [...exhaustedBudgetLimits].sort()
  const atMaximum = exhaustedLimits.every(
    (limit) => suggestedBudget[limit] >= MAXIMUM_BUDGET[limit],
  )
  return {
    exhaustedLimits,
    suggestedBudget,
    next: atMaximum
      ? `${exhaustedLimits.join(', ')} ran out at the maximum. Pass components or roots to react_clear_renders so the targeted reserve covers what you measure, then repeat the step.`
      : `${exhaustedLimits.join(', ')} ran out. Run react_clear_renders with {"budget":${JSON.stringify(suggestedBudget)}}, repeat the step, and read again.`,
  }
}

function isObservationTarget(fiber: Fiber): boolean {
  return matchesObservedComponent(fiber) || isWithinObservationRoot(fiber)
}

function matchesObservedComponent(fiber: Fiber): boolean {
  const { components, exactComponents } = observationConfiguration
  if (components.length === 0 && exactComponents.length === 0) return false
  const name = nameOf(fiber)
  if (exactComponents.includes(name)) return true
  const lowered = name.toLowerCase()
  return components.some((needle) => lowered.includes(needle))
}

function isWithinObservationRoot(fiber: Fiber): boolean {
  if (observationRootIds.size === 0) return false
  let current: Fiber | null = fiber
  for (let depth = 0; current && depth < 100; depth += 1) {
    const recorded = unmountedRootMembership.get(current)
    if (recorded !== undefined) return recorded
    try {
      if (observationRootIds.has(getFiberId(current))) return true
    } catch {
      return false
    }
    current = current.return
  }
  return false
}

export async function getRenders(query: RenderQuery): Promise<RenderReport[]> {
  return buildRenders(records, query)
}

export async function getRendersReport(
  query: RenderQuery,
): Promise<{ components: RenderReport[]; libraryHidden: number; omittedByLimit: number }> {
  return buildRendersReport(records, query)
}

interface RenderMeasurement {
  measurementEnvironment: ReturnType<typeof getMeasurementEnvironment>
  sort: RenderQuery['sort']
  appOnly: boolean
  tracking: boolean
  renderCollection: string
  commits: number
  documentCommitId: number
  observation: ObservationWindow | null
  attribution: ReportAttribution
  componentMatch: ComponentMatch | undefined
  summary: RenderSummary
  sourceClassification: SourceClassificationCoverage
  components: RenderReport[]
  libraryHidden: number
  omittedByLimit: number
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
  budgetAdvice: RenderBudgetAdvice | undefined
  coverageGaps: CoverageGapDetails
}

interface RenderMeasurementPage extends RenderMeasurement {
  nextCursor: string | null
  pagination: {
    snapshotId: string | null
    offset: number
    totalComponents: number
    expiresAt: number | null
    cursorOmitted?: 'candidate-limit'
  }
}

const RENDER_PAGE_SNAPSHOT_LIMIT = 3
const RENDER_PAGE_COMPONENT_LIMIT = 5000
const RENDER_PAGE_TTL_MS = 5 * 60_000
let renderPages = new Map<string, { expiresAt: number; report: RenderMeasurement }>()

function renderMeasurementPage(
  snapshotId: string,
  snapshot: { expiresAt: number; report: RenderMeasurement },
  offset: number,
  limit: number,
): RenderMeasurementPage {
  const totalComponents = snapshot.report.components.length
  const end = Math.min(totalComponents, offset + limit)
  return safeStructuredClone({
    ...snapshot.report,
    components: snapshot.report.components.slice(offset, end),
    omittedByLimit: totalComponents - end,
    nextCursor: end < totalComponents ? `${snapshotId}:${end}` : null,
    pagination: { snapshotId, offset, totalComponents, expiresAt: snapshot.expiresAt },
  })
}

export async function getRendersMeasurement(
  query: RenderQuery & { cursor?: string; includeCursor?: boolean },
): Promise<RenderMeasurementPage> {
  for (const [id, snapshot] of renderPages) {
    if (snapshot.expiresAt <= Date.now()) renderPages.delete(id)
  }
  if (query.cursor) {
    const match = /^([0-9a-f-]{36}):([1-9][0-9]*)$/.exec(query.cursor)
    const snapshotId = match?.[1]
    const snapshot = snapshotId ? renderPages.get(snapshotId) : undefined
    const offset = Number(match?.[2])
    if (
      !snapshotId ||
      !snapshot ||
      !Number.isSafeInteger(offset) ||
      offset >= snapshot.report.components.length
    ) {
      throw new Error(
        'Render cursor is invalid, expired, evicted, or cleared. Run react_get_renders without cursor to start a fresh report.',
      )
    }
    return renderMeasurementPage(snapshotId, snapshot, offset, query.limit)
  }
  const measurementEnvironment = getMeasurementEnvironment()
  const pagesAtStart = renderPages
  const candidates: RenderRecord[] = []
  const matches = renderRecordFilter(query)
  for (const record of records.values()) {
    if (matches(record)) candidates.push(record)
  }
  // A frozen cursor snapshot is bounded, so a larger match reads as one bounded page that says no cursor was kept.
  const cursorOmitted =
    query.includeCursor !== false && candidates.length > RENDER_PAGE_COMPONENT_LIMIT
  const retainCursor = query.includeCursor !== false && !cursorOmitted
  const componentMatch = describeRecordMatch(records, query)
  const recordsAtStart = snapshotRenderRecords(candidates)
  const commitsAtStart = commits
  const epoch = captureReportEpoch()
  const observation = getActiveObservation()
  const tracking = isTracking()
  const skippedAtStart = skippedCommitFibers
  const droppedUnmountsAtStart = getDroppedUnmountEvidenceCount()
  const failedAtStart = analysisFailedFibers
  const pausedAtStart = pausedCommits
  const unobservedAtStart = unobservedCommits
  const refreshExcludedAtStart = refreshCommitsExcluded
  const truncatedAtStart = truncatedInputFibers
  const propsNotEnumeratedAtStart = propsNotEnumeratedFibers
  const budgetCommitsAtStart = budgetExhaustedCommits
  const budgetSubsystemsAtStart = getBudgetExhaustedSubsystems()
  const budgetAdviceAtStart = getRenderBudgetAdvice()
  const coverageGapsAtStart = getCoverageGapDetails()
  const report = await buildRendersMeasurementReport(
    recordsAtStart,
    commitsAtStart,
    {
      sort: query.sort,
      appOnly: query.appOnly,
      limit: retainCursor ? RENDER_PAGE_COMPONENT_LIMIT : query.limit,
    },
    {
      isCurrent: () => reportStateMatches(epoch),
    },
  )
  if (pagesAtStart !== renderPages && report.components.length > query.limit) {
    throw new Error(
      'Render observation was cleared while preparing the report. Run react_get_renders again.',
    )
  }
  const measurement: RenderMeasurement = {
    measurementEnvironment,
    sort: query.sort,
    appOnly: query.appOnly === true,
    tracking,
    renderCollection: renderCollectionStatus(),
    commits: commitsAtStart,
    documentCommitId: epoch.documentCommitId,
    observation,
    attribution: reportAttribution(epoch),
    ...report,
    componentMatch,
    skippedCommitFibers: skippedAtStart,
    droppedUnmountFibers: droppedUnmountsAtStart,
    analysisFailedFibers: failedAtStart,
    pausedCommits: pausedAtStart,
    unobservedCommits: unobservedAtStart,
    refreshCommitsExcluded: refreshExcludedAtStart,
    truncatedInputFibers: truncatedAtStart,
    propsNotEnumeratedFibers: propsNotEnumeratedAtStart,
    budgetExhaustedCommits: budgetCommitsAtStart,
    budgetExhaustedSubsystems: budgetSubsystemsAtStart,
    budgetAdvice: budgetAdviceAtStart,
    coverageGaps: coverageGapsAtStart,
  }
  if (!retainCursor) {
    return {
      ...measurement,
      nextCursor: null,
      pagination: {
        snapshotId: null,
        offset: 0,
        totalComponents: measurement.summary.trackedComponents,
        expiresAt: null,
        ...(cursorOmitted ? { cursorOmitted: 'candidate-limit' as const } : {}),
      },
    }
  }
  const snapshotId = newId()
  const snapshot = { expiresAt: Date.now() + RENDER_PAGE_TTL_MS, report: measurement }
  if (measurement.components.length > query.limit) {
    if (renderPages.size >= RENDER_PAGE_SNAPSHOT_LIMIT) {
      const oldest = renderPages.keys().next().value
      if (oldest) renderPages.delete(oldest)
    }
    renderPages.set(snapshotId, snapshot)
  }
  return renderMeasurementPage(snapshotId, snapshot, 0, query.limit)
}

/** Each render publishes new instance, change, cause, assessment and coverage objects and never mutates them, so a snapshot copies only the fields a later render or unmount rewrites in place. */
function snapshotRenderRecords(candidates = [...records.values()]): Map<number, RenderRecord> {
  return new Map(
    candidates.map((record) => [record.id, { ...record, causeCounts: { ...record.causeCounts } }]),
  )
}

/** The cause report reads only the records its retained events name, not the whole store. */
function recordsOfEvents(events: readonly RetainedRenderCauseEvent[]): RenderRecord[] {
  const named: RenderRecord[] = []
  const seen = new Set<number>()
  for (const event of events) {
    if (seen.has(event.componentId)) continue
    seen.add(event.componentId)
    const record = records.get(event.componentId)
    if (record) named.push(record)
  }
  return named
}

export async function getRenderCauseEventsReport(query: RenderCauseQuery): Promise<{
  events: RenderCauseEvent[]
  libraryHidden: number
  omittedByLimit: number
}> {
  return buildRenderCauseEventsReport(records, recentCauseEvents, query)
}

export async function getRenderCauseMeasurement(query: RenderCauseQuery): Promise<{
  componentMatch: ComponentMatch | undefined
  tracking: boolean
  commits: number
  documentCommitId: number
  observation: ObservationWindow | null
  attribution: ReportAttribution
  events: RenderCauseEvent[]
  libraryHidden: number
  omittedByLimit: number
  sourceClassification: SourceClassificationCoverage
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
  budgetAdvice: RenderBudgetAdvice | undefined
  coverageGaps: CoverageGapDetails
  renderEventRetention: {
    evictedEvents: number
    earliestDocumentCommitId: number | null
    latestDocumentCommitId: number | null
  }
}> {
  const eventsAtStart = [...recentCauseEvents]
  const recordsAtStart = snapshotRenderRecords(recordsOfEvents(eventsAtStart))
  const commitsAtStart = commits
  const epoch = captureReportEpoch()
  const observation = getActiveObservation()
  const tracking = isTracking()
  const skippedAtStart = skippedCommitFibers
  const droppedUnmountsAtStart = getDroppedUnmountEvidenceCount()
  const failedAtStart = analysisFailedFibers
  const pausedAtStart = pausedCommits
  const unobservedAtStart = unobservedCommits
  const refreshExcludedAtStart = refreshCommitsExcluded
  const truncatedAtStart = truncatedInputFibers
  const propsNotEnumeratedAtStart = propsNotEnumeratedFibers
  const budgetCommitsAtStart = budgetExhaustedCommits
  const budgetSubsystemsAtStart = getBudgetExhaustedSubsystems()
  const budgetAdviceAtStart = getRenderBudgetAdvice()
  const evictedAtStart = droppedRenderEvents
  const coverageGapsAtStart = getCoverageGapDetails()
  const report = await buildRenderCauseEventsReport(recordsAtStart, eventsAtStart, query, {
    isCurrent: () => reportStateMatches(epoch),
  })
  return {
    tracking,
    commits: commitsAtStart,
    documentCommitId: epoch.documentCommitId,
    observation,
    attribution: reportAttribution(epoch),
    ...report,
    skippedCommitFibers: skippedAtStart,
    droppedUnmountFibers: droppedUnmountsAtStart,
    analysisFailedFibers: failedAtStart,
    pausedCommits: pausedAtStart,
    unobservedCommits: unobservedAtStart,
    refreshCommitsExcluded: refreshExcludedAtStart,
    truncatedInputFibers: truncatedAtStart,
    propsNotEnumeratedFibers: propsNotEnumeratedAtStart,
    budgetExhaustedCommits: budgetCommitsAtStart,
    budgetExhaustedSubsystems: budgetSubsystemsAtStart,
    budgetAdvice: budgetAdviceAtStart,
    coverageGaps: coverageGapsAtStart,
    renderEventRetention: {
      evictedEvents: evictedAtStart,
      earliestDocumentCommitId: eventsAtStart[0]?.documentCommitId ?? null,
      latestDocumentCommitId: eventsAtStart.at(-1)?.documentCommitId ?? null,
    },
  }
}

export async function getRendersLeaderboards(limit: number): Promise<{
  slowest: RenderReport[]
  mostRerendered: RenderReport[]
  mostUnnecessary: RenderReport[]
  mostUnstable: RenderReport[]
}> {
  return buildRendersLeaderboards(records, limit)
}

export async function getRendersLeaderboardsMeasurement(
  limit: number,
  selection: Pick<RenderQuery, 'component' | 'exact' | 'appOnly'> = {},
): Promise<{
  commits: number
  tracking: boolean
  documentCommitId: number
  attribution: ReportAttribution
  coverage: RenderTrackingCoverage
  boards: Awaited<ReturnType<typeof buildRendersLeaderboards>>
}> {
  const recordsAtStart = snapshotRenderRecords()
  const commitsAtStart = commits
  const epoch = captureReportEpoch()
  const tracking = isTracking()
  const coverage = getRenderTrackingCoverage('measurement')
  const boards = await buildRendersLeaderboards(
    recordsAtStart,
    limit,
    {
      isCurrent: () => reportStateMatches(epoch),
    },
    selection,
  )
  return {
    commits: commitsAtStart,
    tracking,
    documentCommitId: epoch.documentCommitId,
    attribution: reportAttribution(epoch),
    coverage: withSourceCoverage(coverage, boards.sourceClassification),
    boards,
  }
}

export async function getRenderSummary(appOnly = true): Promise<RenderSummary> {
  return buildRenderSummary(records, commits, appOnly)
}

/** Store the current aggregates under `label` (overwriting a prior snapshot of the same label) so a later react_renders_diff can measure change against it. */
export async function takeSnapshot(
  label: string,
  appOnly = true,
): Promise<{
  label: string
  commits: number
  components: number
  coverage: RenderTrackingCoverage
}> {
  const recordsAtStart = snapshotRenderRecords()
  const commitsAtStart = commits
  const clearsAtStart = clears
  const epoch = captureReportEpoch()
  const coverage = getRenderTrackingCoverage('measurement')
  const measurement = await buildCurrentAggregateMeasurement(recordsAtStart, appOnly, {
    isCurrent: () => reportStateMatches(epoch),
  })
  if (!reportStateMatches(epoch)) {
    throw new Error(
      'React analysis changed while the snapshot was resolving. Retry after commits, clears, or refreshes settle.',
    )
  }
  return storeRenderSnapshot(
    label,
    commitsAtStart,
    clearsAtStart,
    measurement.components,
    withSourceCoverage(coverage, measurement.sourceClassification),
    appOnly,
  )
}

/** Compare a stored snapshot against the current live aggregates: total self-time change plus per-component regressions/improvements past a threshold, and components that appeared/vanished. */
export async function rendersDiff(baseline: string, thresholdMs: number, appOnly = true) {
  const recordsAtStart = snapshotRenderRecords()
  const commitsAtStart = commits
  const clearsAtStart = clears
  const epoch = captureReportEpoch()
  const coverage = getRenderTrackingCoverage('measurement')
  const measurement = await buildCurrentAggregateMeasurement(recordsAtStart, appOnly, {
    isCurrent: () => reportStateMatches(epoch),
  })
  if (!reportStateMatches(epoch)) {
    throw new Error(
      'React analysis changed while the render diff was resolving. Retry after commits, clears, or refreshes settle.',
    )
  }
  return diffRenderSnapshot(
    baseline,
    thresholdMs,
    commitsAtStart,
    clearsAtStart,
    measurement.components,
    withSourceCoverage(coverage, measurement.sourceClassification),
    appOnly,
  )
}

/** The commit walk reached this fiber and the budget declined it. It rendered, so the cohort must not read it as idle. */
function noteSkippedCommitFiber(fiber: Fiber): void {
  skippedCommitFibers += 1
  noteUnanalyzedInstanceRender(fiber)
}

function shouldAnalyzeCommitFiber(fiber: Fiber): boolean {
  return (
    isCompositeFiber(fiber) || isSuspenseFiber(fiber) || ((fiber.flags ?? 0) & DID_CAPTURE) !== 0
  )
}

export function recordCommitFiber(
  fiber: Fiber,
  phase: RenderPhase,
  budget: CommitAnalysisBudget,
  targeted = isObservationTarget(fiber),
): boolean {
  if (!shouldAnalyzeCommitFiber(fiber)) return false
  if (!targeted && budget.processed >= budget.limit) {
    budget.skipped += 1
    noteSkippedCommitFiber(fiber)
    return false
  }
  const work = targeted ? budget.targetWork : budget.work
  if (!consumeCommitWork(work, targeted ? 'target-fibers' : 'commit-fibers')) {
    if (targeted) {
      budget.targetSkipped += 1
      targetedFibersSkipped += 1
    } else {
      budget.skipped += 1
    }
    noteSkippedCommitFiber(fiber)
    return false
  }
  if (targeted) {
    budget.targetProcessed += 1
    targetedFibersProcessed += 1
  } else {
    budget.processed += 1
  }
  try {
    const effectPreparation = prepareEffect(fiber, phase, commits, work)
    if (!consumeCommitWork(work, targeted ? 'target-render-record' : 'render-record')) {
      if (targeted) {
        budget.targetSkipped += 1
        targetedFibersSkipped += 1
      } else {
        budget.skipped += 1
      }
      noteSkippedCommitFiber(fiber)
      return false
    }
    recordRender(
      fiber,
      phase,
      effectPreparation,
      work,
      budget.currentCommitEvidence,
      budget.attributionWork,
      targeted ? budget.targetAttributionWork : undefined,
    )
    if (consumeCommitWork(work, targeted ? 'target-error-state' : 'error-state')) {
      recordErrorState(fiber)
    }
    return true
  } catch {
    budget.failed += 1
    noteAnalysisFailure('analysis-failed')
    return false
  }
}

export function recordRender(
  fiber: Fiber,
  phase: RenderPhase,
  effectPreparation?: PreparedEffectObservation,
  commitWork?: CommitWorkBudget,
  commitEvidence?: CurrentCommitEvidence,
  attributionWork?: CommitWorkBudget,
  attributionReserve?: CommitWorkBudget,
): void {
  if (!isCompositeFiber(fiber)) return
  const id = getFiberId(fiber)
  const previous = records.get(id)
  const checkpoint = previous ? { ...previous, causeCounts: { ...previous.causeCounts } } : null
  try {
    recordRenderAtomic(
      fiber,
      phase,
      effectPreparation,
      commitWork,
      commitEvidence,
      attributionWork,
      attributionReserve,
    )
    const recorded = records.get(id)
    if (recorded && recorded !== previous) recordMeasurementRender(recorded, previous)
  } catch (error) {
    if (checkpoint) records.set(id, checkpoint)
    else records.delete(id)
    throw error
  }
}

function recordRenderAtomic(
  fiber: Fiber,
  phase: RenderPhase,
  effectPreparation?: PreparedEffectObservation,
  commitWork?: CommitWorkBudget,
  commitEvidence?: CurrentCommitEvidence,
  attributionWork?: CommitWorkBudget,
  attributionReserve?: CommitWorkBudget,
): void {
  if (!isCompositeFiber(fiber)) return

  // Ignore simulated Suspense unmounts; recordPendingUnmounts handles exact lifecycle tombstones.
  if (phase === 'unmount') {
    return
  }
  instrumentClassFiber(fiber, recordingClassUpdates)
  const id = getFiberId(fiber)
  const existing = records.get(id)
  const recordName = existing?.name ?? nameOf(fiber)
  const forget = existing?.forget ?? hasMemoCache(fiber)
  const timings = getTimings(fiber)
  const instancePreparation = prepareInstanceRender(
    fiber,
    phase,
    commits,
    getDocumentCommitId(),
    commitWork,
  )
  const instance = instancePreparation.instance

  if (phase === 'mount') {
    const inputCoverage = {
      complete: true,
      omittedInputs: 0,
      scanTruncated: false,
      propsNotEnumerated: false,
    } as const
    const eventId = nextCausalEventId('render')
    const causes: RenderCause[] = [{ kind: 'mount', evidence: 'exact' }]
    const effects: EffectScheduleObservation = effectPreparation?.observation ?? {
      scheduled: scheduledEffectCount(fiber),
      declaredScheduled: scheduledEffectCount(fiber),
      complete: true,
    }
    const assessment = assessRender(
      fiber,
      phase,
      causes,
      effects.scheduled,
      true,
      commitWork,
      effects.complete,
    )
    const retained = prepareCauseEventEvidence(causes, assessment, inputCoverage)
    const record = draftRenderRecord(existing, {
      id,
      name: recordName,
      instance,
      fiber,
      forget,
      timings,
      commitId: commits,
      documentCommitId: getDocumentCommitId(),
    })
    record.renders += 1
    record.mounts += 1
    record.causes = causes
    applyGrade(record, gradeRender('mount', false, null))
    record.assessment = assessment
    record.inputCoverage = inputCoverage
    const event = publishCauseEvent(record, retained, eventId)
    awaitCommitOutput(commitEvidence, fiber, 'mount', false, record, event, {
      propsEquivalent: false,
      ownUpdate: null,
      changedContexts: [],
      effects: effects.declaredScheduled,
      effectsComplete: effects.complete,
    })
    instancePreparation.publish()
    effectPreparation?.publish(instance)
    return
  }

  const renderEventId = nextCausalEventId('render')
  const evidenceBudget = createRenderEvidenceBudget(attributionWork, commitWork, attributionReserve)
  const pendingQuerySubscribers: PendingQuerySubscriberRegistration[] = []
  const propChanges = diffProps(fiber, evidenceBudget)
  const stateChanges = diffStateChanges(fiber, evidenceBudget)
  const classUpdates = takeClassUpdates(fiber)
  const changedContexts: unknown[] = []
  const contextChanges = diffContextChanges(fiber, evidenceBudget, (context) =>
    changedContexts.push(context),
  )
  const externalStoreChanges = diffExternalStoreChanges(
    fiber,
    evidenceBudget,
    { renderEventId, commitId: commits },
    pendingQuerySubscribers,
    instance,
  )
  const childrenDidChange = childrenChanged(fiber, evidenceBudget)
  const unclassifiedHookCauses = diffUnclassifiedHooks(fiber, evidenceBudget).map(
    (hookIndex): RenderCause => ({
      kind: 'unknown',
      evidence: 'unknown',
      reason: 'unclassified-hook-changed',
      hookIndex,
    }),
  )
  const coverage = inputCoverage(evidenceBudget)
  const changes: RenderChange[] = [...propChanges, ...stateChanges]
  const propCauses = propChanges.map(
    (change): RenderCause => ({
      kind: 'props',
      evidence: 'exact',
      name: change.name,
      referenceChanged: change.referenceChanged,
      referenceOnly: change.referenceOnly,
      unstable: change.unstable,
      beforePresent: change.beforePresent,
      afterPresent: change.afterPresent,
      before: change.before,
      after: change.after,
      deepDiff: change.deepDiff,
    }),
  )
  // Only a fiber that can bail out on equal props renders because of them, children included; any other fiber re-renders with its parent.
  const bailsOutOnProps = canBailOutOnProps(fiber)
  const childrenCauses: RenderCause[] = childrenDidChange
    ? [{ kind: 'children', evidence: 'exact' }]
    : []
  const otherCauses: RenderCause[] = [
    ...stateChanges.map(
      (change): RenderCause => ({
        kind: 'state',
        evidence: 'exact',
        name: 'hook' in change ? change.name : classStateCauseName(change),
        before: change.before,
        after: change.after,
        deepDiff: change.deepDiff,
        ...('hook' in change ? { hook: change.hook } : classUpdates),
      }),
    ),
    ...(bailsOutOnProps ? childrenCauses : []),
    ...contextChanges,
    ...externalStoreChanges,
  ]
  const propsCauseRender = bailsOutOnProps && propCauses.length > 0
  // With every prop equal, React bails out of such a fiber however its parent rendered, so the trigger is an input Genie cannot see, such as forceUpdate.
  const parentCannotExplain =
    coverage.complete && propChanges.length === 0 && comparesPropsShallowly(fiber)
  const parentResult =
    otherCauses.length === 0 && !propsCauseRender && !parentCannotExplain
      ? renderedParentCause(fiber, commitWork, commitEvidence)
      : { cause: null, complete: true }
  const parentCause = parentResult.cause
  const causalAnalysisComplete = coverage.complete && parentResult.complete
  const observedCauses: RenderCause[] = [
    ...(propsCauseRender
      ? [...propCauses, ...otherCauses]
      : [...otherCauses, ...propCauses, ...(bailsOutOnProps ? [] : childrenCauses)]),
    ...unclassifiedHookCauses,
  ]
  const causes: RenderCause[] = parentCause
    ? [parentCause, ...observedCauses]
    : observedCauses.length > 0
      ? observedCauses
      : !causalAnalysisComplete
        ? [{ kind: 'unknown', evidence: 'unknown', reason: 'causal-analysis-incomplete' }]
        : [
            {
              kind: 'unknown',
              evidence: 'unknown',
              reason: 'no-observable-fiber-input-change',
              ...classUpdates,
            },
          ]
  const valueCauses = otherCauses.filter((cause) => !isIdentityOnlyCause(cause))
  // React renders a fiber on its own only for an input it saw change, so a render with no observed trigger is unexplained, not unnecessary.
  const noObservedInputChange =
    causalAnalysisComplete &&
    unclassifiedHookCauses.length === 0 &&
    (parentCause !== null || otherCauses.length > 0) &&
    propChanges.length === 0 &&
    !childrenDidChange &&
    valueCauses.length === 0
  const ownUpdate = ownUpdateScheduled(fiber)
  const propsEquivalent =
    coverage.complete && propsRenderEquivalently(fiber, propChanges, childrenDidChange, commitWork)
  // Without a readable update lane, only an observed own input that kept its contents proves equal inputs.
  const inputsEquivalent =
    propsEquivalent &&
    unclassifiedHookCauses.length === 0 &&
    valueCauses.length === 0 &&
    (ownUpdate === false || otherCauses.length > 0)
  const effects: EffectScheduleObservation = effectPreparation?.observation ?? {
    scheduled: scheduledEffectCount(fiber),
    declaredScheduled: scheduledEffectCount(fiber),
    complete: true,
  }
  const assessment = assessRender(
    fiber,
    phase,
    causes,
    effects.scheduled,
    causalAnalysisComplete,
    commitWork,
    effects.complete,
  )
  const retained = prepareCauseEventEvidence(causes, assessment, coverage)
  const record = draftRenderRecord(existing, {
    id,
    name: recordName,
    instance,
    fiber,
    forget,
    timings,
    commitId: commits,
    documentCommitId: getDocumentCommitId(),
  })
  record.renders += 1
  record.updates += 1
  record.changes = changes
  record.causes = causes
  applyGrade(record, gradeRender('update', inputsEquivalent, null))
  record.assessment = assessment
  record.inputCoverage = coverage
  if (noObservedInputChange) record.unnecessary += 1
  if (bailsOutOnProps && otherCauses.length === 0) {
    countPropOnlyMemoRender(record, fiber, propChanges, coverage.complete)
  }
  const event = publishCauseEvent(record, retained, renderEventId)
  awaitCommitOutput(commitEvidence, fiber, 'update', inputsEquivalent, record, event, {
    propsEquivalent,
    ownUpdate,
    changedContexts,
    effects: effects.declaredScheduled,
    effectsComplete: effects.complete,
  })
  instancePreparation.publish()
  for (const pending of pendingQuerySubscribers) {
    registerQuerySubscriber(pending.observer, pending.subscriber)
  }
  effectPreparation?.publish(instance)
  if (coverage.scanTruncated || coverage.omittedInputs > 0) {
    truncatedInputFibers += 1
    noteGapComponent(truncatedInputComponents, recordName)
  }
  if (coverage.propsNotEnumerated) {
    propsNotEnumeratedFibers += 1
    noteGapComponent(propsNotEnumeratedComponents, recordName)
  }
}

/** Classify a memo or pure render whose only input change was props; value changes are legitimate and not counted. */
function countPropOnlyMemoRender(
  record: RenderRecord,
  fiber: Fiber,
  propChanges: PropRenderChange[],
  coverageComplete: boolean,
): void {
  if (propChanges.length === 0) return
  if (coverageComplete) {
    const notReferenceOnly = propChanges.filter((change) => !change.referenceOnly)
    if (notReferenceOnly.every((change) => isFunctionIdentityChange(fiber, change))) {
      // A new closure is the one change that cannot be proven equal, so it outranks reference-only siblings.
      if (notReferenceOnly.length > 0) {
        record.functionIdentityPropRenders += 1
      } else {
        record.referenceOnlyPropRenders += 1
        record.unstableRenders += 1
      }
      return
    }
  }
  if (propChanges.every((change) => change.referenceOnly || isUndeterminedReference(change))) {
    record.undeterminedReferencePropRenders += 1
  }
}

/** Every changed prop, children included, would render the same: a reference-only diff, or equal contents under React element comparison. */
function propsRenderEquivalently(
  fiber: Fiber,
  propChanges: PropRenderChange[],
  childrenDidChange: boolean,
  commitWork?: CommitWorkBudget,
): boolean {
  const before: unknown = fiber.alternate?.memoizedProps
  const after: unknown = fiber.memoizedProps
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null)
    return propChanges.length === 0 && !childrenDidChange
  const equivalent = (name: string): boolean =>
    compareRenderInputs(ownDataValue(before, name), ownDataValue(after, name), commitWork) ===
    'equal'
  return (
    propChanges.every((change) => change.referenceOnly || equivalent(change.name)) &&
    (!childrenDidChange || equivalent('children'))
  )
}

function ownDataValue(props: object, name: string): unknown {
  const descriptor = safeOwnPropertyDescriptor(props, name)
  return isDataDescriptor(descriptor) ? descriptor.value : undefined
}

function applyGrade(
  target: { necessity: RenderNecessity; necessityReason: NecessityGrade['necessityReason'] },
  grade: NecessityGrade,
): void {
  target.necessity = grade.necessity
  target.necessityReason = grade.necessityReason
}

/** Necessity needs the whole commit's host output, so the commit handler grades every render once traversal ends. */
function awaitCommitOutput(
  commitEvidence: CurrentCommitEvidence | undefined,
  fiber: Fiber,
  phase: 'mount' | 'update',
  inputsEquivalent: boolean,
  record: RenderRecord,
  event: RetainedRenderCauseEvent,
  facts: CommitRenderFacts,
): void {
  record.wraps = undefined
  record.wrappedBy = undefined
  if (!commitEvidence) return
  commitEvidence.renderFacts.set(fiber, facts)
  commitEvidence.pendingGrades.push({
    fiber,
    phase,
    inputsEquivalent,
    assessment: record.assessment,
    wrapper: wrapperOf(fiber),
    publish: (grade) => {
      applyGrade(record, grade)
      applyGrade(event, grade)
    },
    relate: (relation, related) => {
      record[relation] = related
      event[relation] = related
    },
    describe: () => ({
      componentId: record.id,
      componentName: record.name,
      renderEventId: event.renderEventId,
      causes: event.causes.map(compactRenderCause),
      necessity: event.necessity,
      necessityReason: event.necessityReason,
    }),
  })
}

const OUTPUT_OPERATION_LIMIT = 200_000

/** A wrapper and the component it wraps that rendered in the same commit each carry the other's causes, so asking about either one finds the real cause. */
function linkWrappedRenders(grades: PendingRenderGrade[]): void {
  const byFiber = new Map(grades.map((grade) => [grade.fiber, grade]))
  for (const inner of grades) {
    if (!inner.wrapper) continue
    const wrapper =
      byFiber.get(inner.wrapper) ??
      (inner.wrapper.alternate ? byFiber.get(inner.wrapper.alternate) : undefined)
    if (!wrapper) continue
    wrapper.relate('wraps', inner.describe())
    inner.relate('wrappedBy', wrapper.describe())
  }
}

function gradeCommitRenders(evidence: CurrentCommitEvidence, timeLimitMs: number): void {
  if (evidence.pendingGrades.length === 0) return
  const commitWork = createCommitWorkBudget({ operationLimit: OUTPUT_OPERATION_LIMIT, timeLimitMs })
  const tallies = attributeCommitOutput({
    rendered: evidence.renderedFibers,
    facts: evidence.renderFacts,
    commitWork,
  })
  for (const pending of evidence.pendingGrades) {
    const output = tallies.get(pending.fiber) ?? null
    if (output) applyOutputAssessment(pending.assessment, output)
    pending.publish(gradeRender(pending.phase, pending.inputsEquivalent, output))
  }
  linkWrappedRenders(evidence.pendingGrades)
  if (commitWork.exhaustedLimit) {
    budgetExhaustedSubsystems.set(
      'render-output',
      (budgetExhaustedSubsystems.get('render-output') ?? 0) + 1,
    )
  }
}

/** State, context or a store snapshot replaced by a new object whose contents a complete diff found equal. */
function isIdentityOnlyCause(cause: RenderCause): boolean {
  if (!('deepDiff' in cause) || cause.kind === 'props') return false
  const { changes, truncated } = cause.deepDiff
  return !truncated && changes.length > 0 && changes.every((diff) => diff.kind === 'reference-only')
}

function hasObservedValueChange(change: PropRenderChange): boolean {
  return change.deepDiff.changes.some(
    (diff) => diff.kind !== 'reference-only' && diff.kind !== 'identity-changed-uninspected',
  )
}

/** A reference change whose bounded diff stopped before it could rule a value change in or out. */
function isUndeterminedReference(change: PropRenderChange): boolean {
  return change.referenceChanged && change.deepDiff.truncated && !hasObservedValueChange(change)
}

interface PreparedCauseEventEvidence {
  causes: RenderCause[]
  assessment: RenderAssessment
  inputCoverage: RenderInputCoverage
}

// Retained evidence is shared rather than copied per render: only the commit handler that published it grades it, and every read clones it.
function prepareCauseEventEvidence(
  causes: RenderCause[],
  assessment: RenderAssessment,
  coverage: RenderInputCoverage,
): PreparedCauseEventEvidence {
  return { causes, assessment, inputCoverage: { ...coverage } }
}

function recordPendingUnmounts(rendererId: number, budget: CommitAnalysisBudget): void {
  const retained: PendingUnmount[] = []
  for (const pending of pendingUnmounts) {
    if (pending.rendererId !== rendererId) {
      retained.push(pending)
      continue
    }
    const work = pending.targeted ? budget.targetWork : budget.work
    if (
      !consumeCommitWork(work, pending.targeted ? 'target-pending-unmounts' : 'pending-unmounts')
    ) {
      retained.push(pending)
      if (pending.targeted) {
        budget.targetSkipped += 1
        targetedFibersSkipped += 1
      }
      continue
    }
    if (!isCompositeFiber(pending.fiber)) continue
    const instance = noteInstanceRender(
      restoreFiberId(pending),
      'unmount',
      commits,
      getDocumentCommitId(),
      work,
    )
    removeEffectRecord(pending.fiber)
    retainUnmountedRecord(instance.fiberId)
  }
  replacePendingUnmounts(retained)
}

function replacePendingUnmounts(retained: PendingUnmount[]): void {
  pendingUnmounts.length = 0
  pendingUnmounts.push(...retained)
  targetedPendingUnmounts = retained.filter((pending) => pending.targeted).length
}

function retainUnmountedRecord(id: number): void {
  const record = records.get(id)
  if (!record || record.unmounted) return
  record.unmounted = true
  noteMeasurementUnmount(id)
  unmountedRecordIds.push(id)
  if (unmountedRecordIds.length <= observationConfiguration.lifecycle.bufferLimit) return
  const evicted = unmountedRecordIds.shift()
  if (evicted !== undefined && records.delete(evicted)) evictedUnmountedRecords += 1
}

/** Record every fiber's root membership for its descendants, but queue only component lifecycles; host-node unmounts cannot produce cohort tombstones. */
export function queuePendingUnmount(rendererId: number, fiber: Fiber): void {
  const withinRoot = isWithinObservationRoot(fiber)
  if (observationRootIds.size > 0) {
    unmountedRootMembership.set(fiber, withinRoot)
    if (fiber.alternate) unmountedRootMembership.set(fiber.alternate, withinRoot)
  }
  if (!isCompositeFiber(fiber)) return
  const targeted = withinRoot || matchesObservedComponent(fiber)
  pendingUnmounts.push({ rendererId, fiber, fiberId: getFiberId(fiber), targeted })
  if (targeted) targetedPendingUnmounts += 1
  if (pendingUnmounts.length <= observationConfiguration.lifecycle.bufferLimit) return
  const [dropped] = pendingUnmounts.splice(pendingUnmountEvictionIndex(), 1)
  if (dropped) forgetUnmountWithoutTombstone(dropped)
  if (dropped?.targeted) {
    targetedPendingUnmounts -= 1
    droppedTargetUnmountFibers += 1
  }
  droppedPendingUnmountFibers += 1
}

/** The newest `targetReserve` targeted unmounts are protected; evict the oldest entry outside them, or the oldest entry when every entry is protected. */
function pendingUnmountEvictionIndex(): number {
  if (targetedPendingUnmounts > observationConfiguration.lifecycle.targetReserve) return 0
  const firstUntargeted = pendingUnmounts.findIndex((pending) => !pending.targeted)
  return Math.max(0, firstUntargeted)
}

/** An unmount that cannot be reported still has to release its record, or the record pins the detached fiber. */
function forgetUnmountWithoutTombstone({ fiber, fiberId }: PendingUnmount): void {
  discardExcludedInstanceUnmount(fiber, fiberId)
  removeEffectRecord(fiber, fiberId)
  records.delete(fiberId)
}

/** Bippy 0.7.3+ forgets a fiber's id once its unmount callbacks return; the deferred lifecycle needs the mounted id. */
function restoreFiberId({ fiber, fiberId }: PendingUnmount): Fiber {
  setFiberId(fiber, fiberId)
  return fiber
}

/** An unmount outside every window has no window to lose it, so it releases its record without counting excluded lifecycle evidence. */
function forgetUnobservedUnmount({ fiber, fiberId }: PendingUnmount): void {
  releaseInstance(fiber, fiberId)
  removeEffectRecord(fiber, fiberId)
  records.delete(fiberId)
}

function discardPendingUnmounts(
  rendererId: number,
  forget: (pending: PendingUnmount) => void = forgetUnmountWithoutTombstone,
): void {
  const retained: PendingUnmount[] = []
  for (const pending of pendingUnmounts) {
    if (pending.rendererId === rendererId) forget(pending)
    else retained.push(pending)
  }
  replacePendingUnmounts(retained)
}

function publishCauseEvent(
  record: RenderRecord,
  retained: PreparedCauseEventEvidence,
  eventId: string,
): RetainedRenderCauseEvent {
  for (const cause of retained.causes) record.causeCounts[cause.kind] += 1
  record.latestRenderEventId = eventId
  const event: RetainedRenderCauseEvent = {
    renderEventId: eventId,
    observationId: getActiveObservation()?.id ?? null,
    commitId: commits,
    documentCommitId: getDocumentCommitId(),
    componentId: record.id,
    componentName: record.name,
    instance: {
      ...record.instance,
      parent: record.instance.parent ? { ...record.instance.parent } : null,
      keyedParent: record.instance.keyedParent ? { ...record.instance.keyedParent } : null,
    },
    causes: retained.causes,
    necessity: record.necessity,
    necessityReason: record.necessityReason,
    assessment: retained.assessment,
    inputCoverage: retained.inputCoverage,
  }
  records.set(record.id, record)
  recentCauseEvents.push(event)
  if (recentCauseEvents.length > RECENT_CAUSE_EVENT_LIMIT) {
    recentCauseEvents.shift()
    droppedRenderEvents += 1
  }
  return event
}

/** Finalize once after traversal so report coverage names every subsystem the shared guard stopped. */
export function finalizeCommitAnalysisBudget(budget: CommitAnalysisBudget): void {
  if (budget.skipped > 0 || budget.targetSkipped > 0 || budget.failed > 0)
    markMeasurementIncomplete()
  const exhausted = [
    ...commitWorkExhaustions(budget.work),
    ...commitWorkExhaustions(budget.targetWork).map((subsystem) => `target:${subsystem}`),
  ]
  const fibersToAnalyze = budget.processed + budget.skipped
  treeBudgetScale = Math.max(treeBudgetScale, scaleFittingFibers(fibersToAnalyze))
  const fiberLimitReached = fibersToAnalyze > budget.limit
  if (exhausted.length === 0 && !fiberLimitReached) {
    decayAdaptiveBudget()
    return
  }
  const scale = currentBudgetScale()
  if (fiberLimitReached) exhaustedBudgetLimits.add('fiberLimit')
  if (budget.work.exhaustedLimit) {
    exhaustedBudgetLimits.add(budget.work.exhaustedLimit)
    suggestedMainScale = Math.max(suggestedMainScale, scale, treeBudgetScale)
    const required = measuredRequirement(budget, fibersToAnalyze)
    suggestedOperationLimit = Math.max(suggestedOperationLimit, required.operations)
    suggestedTimeLimitMs = Math.max(suggestedTimeLimitMs, required.timeLimitMs)
    if (observationConfiguration.budget.adaptive) {
      const configured = observationConfiguration.budget
      adaptiveCostScale = Math.max(
        adaptiveCostScale,
        required.operations / (configured.operationLimit * adaptiveBudgetScale),
        required.timeLimitMs / (configured.timeLimitMs * adaptiveBudgetScale),
      )
    }
  }
  suggestedMainScale = Math.max(suggestedMainScale, treeBudgetScale)
  if (budget.targetWork.exhaustedLimit) {
    exhaustedBudgetLimits.add(
      budget.targetWork.exhaustedLimit === 'operationLimit'
        ? 'targetOperationReserve'
        : 'targetTimeReserveMs',
    )
    suggestedTargetScale = Math.max(
      suggestedTargetScale,
      2,
      Math.ceil(
        (budget.targetProcessed + budget.targetSkipped) / Math.max(1, budget.targetProcessed),
      ),
    )
  }
  commitsWithinAdaptiveBudget = 0
  if (observationConfiguration.budget.adaptive) {
    adaptiveBudgetScale = Math.min(
      maxAdaptiveScale(),
      Math.max(adaptiveBudgetScale, treeBudgetScale),
    )
  }
  if (exhausted.length === 0) return
  markMeasurementIncomplete()
  budgetExhaustedCommits += 1
  for (const subsystem of exhausted) {
    budgetExhaustedSubsystems.set(subsystem, (budgetExhaustedSubsystems.get(subsystem) ?? 0) + 1)
  }
}

function decayAdaptiveBudget(): void {
  if (adaptiveBudgetScale <= treeBudgetScale && adaptiveCostScale <= treeCostScale) return
  commitsWithinAdaptiveBudget += 1
  if (commitsWithinAdaptiveBudget < ADAPTIVE_DECAY_COMMITS) return
  commitsWithinAdaptiveBudget = 0
  adaptiveBudgetScale = Math.max(treeBudgetScale, adaptiveBudgetScale - 1)
  adaptiveCostScale = Math.max(treeCostScale, adaptiveCostScale - 1)
}

/** Work the whole commit needed, extrapolated from what each analyzed component cost before the budget ran out (traversal costs one operation per rendered fiber), and at least double the configured limit that ran out. */
function measuredRequirement(
  budget: CommitAnalysisBudget,
  fibersToAnalyze: number,
): { operations: number; timeLimitMs: number } {
  const work = budget.work
  const effective = effectiveObservationBudget()
  const consumed = work.operationLimit - work.remainingOperations
  const traversal = Math.min(consumed, budget.currentCommitEvidence.renderedFibers.size)
  const perComponent = budget.processed > 0 ? fibersToAnalyze / budget.processed : 0
  const operations = traversal + (consumed - traversal) * perComponent
  const milliseconds = (work.now() - work.startedAt) * perComponent
  const floor = (limit: number, exhausted: boolean): number => (exhausted ? 2 * limit : 0)
  return {
    operations: Math.ceil(
      Math.max(
        operations * BUDGET_ADVICE_MARGIN,
        floor(effective.operationLimit, work.exhaustedLimit === 'operationLimit'),
      ),
    ),
    timeLimitMs: Math.ceil(
      Math.max(
        milliseconds * BUDGET_ADVICE_MARGIN,
        floor(effective.timeLimitMs, work.exhaustedLimit === 'timeLimitMs'),
      ),
    ),
  }
}

function renderedParentCause(
  fiber: Fiber,
  budget?: CommitWorkBudget,
  commitEvidence?: CurrentCommitEvidence,
): { cause: RenderCause | null; complete: boolean } {
  const renderedFibers = commitEvidence?.renderedFibers
  try {
    let parent = fiber.return
    while (parent && !isCompositeFiber(parent)) {
      if (!consumeCommitWork(budget, 'parent-ancestry')) return { cause: null, complete: false }
      parent = parent.return
    }
    if (!parent) return { cause: null, complete: true }
    if (!renderedFibers) return { cause: null, complete: false }
    if (!consumeCommitWork(budget, 'parent-ancestry')) return { cause: null, complete: false }
    if (!renderedFibers.has(parent)) return { cause: null, complete: true }
    return {
      cause: {
        kind: 'parent',
        evidence: 'inferred',
        parentId: getFiberId(parent),
        parentName: nameOf(parent),
        reason: 'nearest-rendered-ancestor',
        origin: cascadeOrigin(
          parent,
          renderedFibers,
          commitEvidence?.cascadeOrigins ?? new Map(),
          budget,
        ),
      },
      complete: true,
    }
  } catch {
    noteAnalysisFailure('analysis-failed')
    return { cause: null, complete: false }
  }
}
