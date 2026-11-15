import type { Fiber, MemoizedState, RenderPhase } from 'bippy'
import type { CompactRenderCause } from '../../protocol'
import { type CommitWorkBudget, consumeCommitWork } from './commit-budget'
import type { RenderCause } from './render-causes'
import type { CommitRenderFacts, NecessityGrade, OutputTally } from './render-output'
import type { RenderedComponentRef } from './render-wrappers'

const HOOK_SCAN_LIMIT = 1_000

export const UNOBSERVED_BEHAVIOR_DOMAINS = [
  'focus',
  'url',
  'network',
  'transition',
  'freshness',
  'effect-execution',
] as const

export type UnobservedBehaviorDomain = (typeof UNOBSERVED_BEHAVIOR_DOMAINS)[number]
export type RenderInputEvidence = 'mount' | 'changed' | 'none-observed' | 'incomplete'

export interface RenderAssessment {
  inputEvidence: RenderInputEvidence
  observedInputKinds: RenderCause['kind'][]
  behaviorEvidence: {
    subtreeHostMutations: {
      status: 'observed' | 'none-observed' | 'incomplete'
      /** Host writes this render's subtree performed: changed attributes, styles or text, inserts, moves and removals. */
      count: number
      /** Legacy field, always 0: the commit is attributed in one pass with no per-component bound. */
      pendingSubtrees: number
      /** Legacy alias for pendingSubtrees. */
      omittedByLimit: number
      /** Host updates whose only change was a new event handler, ref or other function. */
      callbackOnlyUpdates: number
      writes: string[]
      callbacks: string[]
    }
    scheduledEffects: {
      status: 'observed' | 'none-observed' | 'incomplete'
      count: number
    }
    subtreeScheduledEffects: {
      status: 'observed' | 'none-observed' | 'incomplete'
      count: number
    }
    unobservedDomains: UnobservedBehaviorDomain[]
  }
  optimizationSafety: 'not-proven-safe'
  requiredValidation: ('dom' | 'aria' | 'focus' | 'url' | 'network' | 'transition')[]
}

export interface CurrentCommitEvidence {
  renderedFibers: Set<Fiber>
  /** The ancestor whose update started each cascade, shared by the components it reached. */
  cascadeOrigins: Map<Fiber, RenderedComponentRef | null>
  /** Facts each analyzed component contributes when this commit's output is attributed. */
  renderFacts: Map<Fiber, CommitRenderFacts>
  /** Renders recorded in this commit whose necessity waits for the output attribution. */
  pendingGrades: PendingRenderGrade[]
}

export interface PendingRenderGrade {
  fiber: Fiber
  phase: 'mount' | 'update'
  inputsEquivalent: boolean
  assessment: RenderAssessment
  /** The higher-order component or memo wrapper rendering this one, if any. */
  wrapper: Fiber | null
  publish: (grade: NecessityGrade) => void
  relate: (relation: 'wraps' | 'wrappedBy', related: RelatedRender) => void
  describe: () => RelatedRender
}

/** The other half of a wrapper relation in the same commit, reduced to the evidence an agent needs. */
export interface RelatedRender {
  componentId: number
  componentName: string
  renderEventId: string
  causes: CompactRenderCause<RenderCause['kind'], RenderCause['evidence']>[]
  necessity: 'necessary' | 'unnecessary' | 'unknown'
  necessityReason: NecessityGrade['necessityReason']
}

/** Internal initialization value; recordRender replaces it before publishing the record. */
export function pendingRenderAssessment(): RenderAssessment {
  return {
    inputEvidence: 'incomplete',
    observedInputKinds: [],
    behaviorEvidence: {
      subtreeHostMutations: unobservedHostMutations(),
      scheduledEffects: { status: 'none-observed', count: 0 },
      subtreeScheduledEffects: { status: 'incomplete', count: 0 },
      unobservedDomains: [...UNOBSERVED_BEHAVIOR_DOMAINS],
    },
    optimizationSafety: 'not-proven-safe',
    requiredValidation: ['dom', 'aria', 'focus', 'url', 'network', 'transition'],
  }
}

function unobservedHostMutations(): RenderAssessment['behaviorEvidence']['subtreeHostMutations'] {
  return {
    status: 'incomplete',
    count: 0,
    pendingSubtrees: 0,
    omittedByLimit: 0,
    callbackOnlyUpdates: 0,
    writes: [],
    callbacks: [],
  }
}

/** Record what this commit wrote below the component once the whole commit has been attributed. */
export function applyOutputAssessment(assessment: RenderAssessment, output: OutputTally): void {
  assessment.behaviorEvidence.subtreeHostMutations = {
    status: output.writes > 0 ? 'observed' : output.complete ? 'none-observed' : 'incomplete',
    count: output.writes,
    pendingSubtrees: 0,
    omittedByLimit: 0,
    callbackOnlyUpdates: output.callbackOnlyUpdates,
    writes: output.writeLabels,
    callbacks: output.callbackLabels,
  }
  assessment.behaviorEvidence.subtreeScheduledEffects = {
    status: output.effects > 0 ? 'observed' : output.complete ? 'none-observed' : 'incomplete',
    count: output.effects,
  }
}

/** Hook pairing is complete only when both Fiber buffers line up within the bound, and context pairing when no previously read Context went unread. */
export function inputComparisonComplete(fiber: Fiber, budget?: CommitWorkBudget): boolean {
  try {
    let currentHook: MemoizedState | null = fiber.memoizedState
    let previousHook: MemoizedState | null = fiber.alternate?.memoizedState ?? null
    let hooksVisited = 0
    while ((currentHook || previousHook) && hooksVisited < HOOK_SCAN_LIMIT) {
      if (!consumeCommitWork(budget, 'input-completeness')) return false
      if (!currentHook || !previousHook) return false
      currentHook = currentHook.next
      previousHook = previousHook.next
      hooksVisited += 1
    }
    if (currentHook || previousHook) return false

    const currentContexts = new Set<unknown>()
    let currentContext = fiber.dependencies?.firstContext ?? null
    for (let visited = 0; currentContext; visited += 1) {
      if (visited >= HOOK_SCAN_LIMIT || !consumeCommitWork(budget, 'input-completeness')) {
        return false
      }
      currentContexts.add(currentContext.context)
      currentContext = currentContext.next
    }
    // Reads pair by Context identity; only a Context this render stopped reading leaves its change unseen.
    let previousContext = fiber.alternate?.dependencies?.firstContext ?? null
    for (let visited = 0; previousContext; visited += 1) {
      if (visited >= HOOK_SCAN_LIMIT || !consumeCommitWork(budget, 'input-completeness')) {
        return false
      }
      if (!currentContexts.has(previousContext.context)) return false
      previousContext = previousContext.next
    }
    return true
  } catch {
    return false
  }
}

export function assessRender(
  fiber: Fiber,
  phase: RenderPhase,
  causes: RenderCause[],
  scheduledEffects: number,
  inputComplete = true,
  budget?: CommitWorkBudget,
  effectAnalysisComplete = true,
): RenderAssessment {
  const observedInputKinds = causes
    .filter(
      (cause) =>
        (cause.evidence === 'exact' && cause.kind !== 'mount') ||
        (cause.kind === 'unknown' && cause.reason === 'unclassified-hook-changed'),
    )
    .map((cause) => cause.kind)
  const inputEvidence: RenderInputEvidence =
    phase === 'mount'
      ? 'mount'
      : !inputComplete
        ? 'incomplete'
        : observedInputKinds.length > 0
          ? 'changed'
          : inputComparisonComplete(fiber, budget)
            ? 'none-observed'
            : 'incomplete'
  return {
    inputEvidence,
    observedInputKinds: [...new Set(observedInputKinds)],
    behaviorEvidence: {
      subtreeHostMutations: unobservedHostMutations(),
      scheduledEffects: {
        status: !effectAnalysisComplete
          ? 'incomplete'
          : scheduledEffects > 0
            ? 'observed'
            : 'none-observed',
        count: scheduledEffects,
      },
      subtreeScheduledEffects: { status: 'incomplete', count: 0 },
      unobservedDomains: [...UNOBSERVED_BEHAVIOR_DOMAINS],
    },
    optimizationSafety: 'not-proven-safe',
    requiredValidation: ['dom', 'aria', 'focus', 'url', 'network', 'transition'],
  }
}
