import { type Fiber, getDisplayName, getFiberId, type RenderPhase } from 'bippy'
import type { Effect } from './bippy-compat'
import { type CommitWorkBudget, consumeCommitWork } from './commit-budget'
import {
  type ComponentMatch,
  type ComponentNameSelector,
  componentNameMatcher,
  describeComponentMatch,
} from './component-name'
import {
  type EffectDeclaration,
  type EffectDeclarationReason,
  type EffectHookAncestryFrame,
  resolveEffectDeclarations,
} from './effect-declarations'
import {
  compareDependencies,
  type DependencyChange,
  type DependencyComparison,
} from './effect-dependencies'
import {
  clearEffectEvents,
  markEffectInstrumentationUnavailable,
  type PassiveEffectBinding,
  type PreparedEffectSchedule,
  prepareEffectSchedule,
  publishEffectSchedule,
  runObservedPassiveEffect,
} from './effect-events'
import type { InstanceDescriptor } from './instance-identity'
import {
  classifyFibersWithinBudget,
  type FiberClassification,
  isHiddenByAppOnly,
  type OwnershipBasis,
  type ResolvedSource,
  sourceLabel,
} from './source'
import { ownsEffectList } from './work-tags'

// React's ReactHookEffectTags, stable across 16.8+/18/19 (bippy doesn't re-export them): HasEffect = will run this commit; the kind bit is fixed per effect.
const HOOK_HAS_EFFECT = 0b0001
const HOOK_INSERTION = 0b0010
const HOOK_LAYOUT = 0b0100
const HOOK_PASSIVE = 0b1000

const EFFECT_WALK_LIMIT = 100
const HOOK_WALK_LIMIT = 300
const EFFECT_REPORT_LIMIT = 500
const EFFECT_SOURCE_ATTRIBUTION_LIMIT = 80
const EFFECT_SOURCE_ATTRIBUTION_BUDGET_MS = 500
const DEFAULT_HOT_MIN_UPDATES = 3
const DEFAULT_HOT_MIN_FIRE_RATE = 1
const HOTNESS_CONFIDENCE_LEVEL = 0.95
const UNCLASSIFIED_FIBER: FiberClassification = {
  source: null,
  ownership: 'unknown',
  isLibrary: false,
}

export type EffectKind = 'effect' | 'layout' | 'insertion'
export type DepsMode = 'none' | 'empty' | 'list'

interface EffectStat {
  index: number
  /** Flat position in the component's hook list, the index react_inspect_component reports. */
  hookIndex: number
  kind: EffectKind
  depsMode: DepsMode
  depCount: number
  updates: number
  scheduled: number
  hasCleanup: boolean
  lastChangedDep: number | null
  /** Whether the last changed dep held a primitive — a value that legitimately changed, not an unstable reference. */
  lastChangedDepIsPrimitive: boolean | null
  /** Update schedules by what their changed dependencies did: a value changed, only identities changed, or the values could not be compared. */
  reruns: Record<DependencyChange, number>
}

interface EffectRecord {
  id: number
  name: string
  stats: EffectStat[]
  /** The live fiber, kept so source/library classification can run async at report time. */
  fiber: Fiber
}

const records = new Map<number, EffectRecord>()
let truncatedEffectLists = 0

export function clearEffects(): void {
  records.clear()
  truncatedEffectLists = 0
  clearEffectEvents()
}

export interface EffectScheduleObservation {
  scheduled: number
  /** Scheduled effects that occupy a hook slot, so the component or a hook it calls declared them; React's own slotless effects, such as useSyncExternalStore's snapshot bookkeeping, are excluded. */
  declaredScheduled: number
  complete: boolean
}

export interface PreparedEffectObservation {
  observation: EffectScheduleObservation
  publish: (instance?: InstanceDescriptor) => void
}

/** Records at commit time which effects will run this commit (the same `HasEffect` bit React's commit phase checks) and which dependency drove them. */
export function recordEffect(
  fiber: Fiber,
  phase: RenderPhase,
  profileCommitId = 0,
  budget?: CommitWorkBudget,
): EffectScheduleObservation {
  const prepared = prepareEffect(fiber, phase, profileCommitId, budget)
  prepared.publish()
  return prepared.observation
}

/** Build effect stats/events without mutating shared stores; publish only with the render record. */
export function prepareEffect(
  fiber: Fiber,
  phase: RenderPhase,
  profileCommitId = 0,
  budget?: CommitWorkBudget,
): PreparedEffectObservation {
  if (!ownsEffectList(fiber)) {
    return preparedEffect({ scheduled: 0, declaredScheduled: 0, complete: true }, null)
  }

  const id = getFiberId(fiber)
  if (phase === 'unmount') {
    // Traversal unmounts can be Suspense visibility changes; the DevTools unmount callback owns exact deletion.
    return preparedEffect({ scheduled: 0, declaredScheduled: 0, complete: true }, null)
  }

  const currentList = effectHookSlots(fiber, budget)
  let truncations = currentList.truncated ? 1 : 0
  if (currentList.effects.length === 0) {
    return preparedEffect(
      { scheduled: 0, declaredScheduled: 0, complete: !currentList.truncated },
      null,
      [],
      truncations,
    )
  }
  const previousList =
    phase === 'update'
      ? previousEffectsByHookIndex(fiber.alternate, currentList.lastHookIndex, budget)
      : { effects: new Map<number, Effect>(), truncated: false }
  if (previousList.truncated) truncations += 1
  const effects = currentList.effects

  const existing = records.get(id)
  const record: EffectRecord = existing
    ? {
        ...existing,
        stats: existing.stats.map((stat) => (stat ? { ...stat } : stat)),
      }
    : { id, name: getDisplayName(fiber.type) ?? 'Anonymous', stats: [], fiber }
  record.fiber = fiber
  const schedules: PreparedEffectSchedule[] = []
  const passiveInstrumentation: { effect: Effect; binding: PassiveEffectBinding }[] = []
  let declaredScheduled = 0

  for (let i = 0; i < effects.length; i++) {
    if (!consumeCommitWork(budget, 'effects')) {
      truncations += 1
      return preparedEffect(
        { scheduled: currentList.scheduled, declaredScheduled, complete: false },
        record,
        schedules,
        truncations,
        passiveInstrumentation,
      )
    }
    const slot = effects[i]
    if (!slot) continue
    const { effect, hookIndex } = slot
    const kind = effectKind(effect.tag)
    if (!kind) continue
    const depsMode = depsModeOf(effect.deps)
    const depCount = Array.isArray(effect.deps) ? effect.deps.length : 0

    let stat = record.stats[i]
    if (!stat) {
      stat = {
        index: i,
        hookIndex,
        kind,
        depsMode,
        depCount,
        updates: 0,
        scheduled: 0,
        hasCleanup: false,
        lastChangedDep: null,
        lastChangedDepIsPrimitive: null,
        reruns: { value: 0, 'reference-only': 0, undetermined: 0 },
      }
      record.stats[i] = stat
    } else {
      stat.hookIndex = hookIndex
      stat.kind = kind
      stat.depsMode = depsMode
      stat.depCount = depCount
    }

    // Turns true once a previous run returned a cleanup — React 18.3+/19 store it at `effect.inst.destroy`, older React at `effect.destroy`.
    if (hasCleanupFn(effect)) stat.hasCleanup = true

    const scheduled = (effect.tag & HOOK_HAS_EFFECT) !== 0
    const dependencyChanges =
      scheduled && phase === 'update'
        ? compareDependencies(effect.deps, previousList.effects.get(hookIndex)?.deps, budget)
        : null
    if (scheduled) declaredScheduled += 1
    let effectEventId: string | null = null
    if (scheduled) {
      const prepared = prepareEffectSchedule({
        fiber,
        profileCommitId,
        phase,
        effectIndex: i,
        hookIndex,
        kind,
        dependencyChanges,
        budget,
      })
      if (prepared) {
        schedules.push(prepared)
        effectEventId = prepared.effectEventId
      }
    }
    if (kind === 'effect') {
      passiveInstrumentation.push({
        effect,
        binding: {
          effectEventId,
          fiber,
          effectIndex: i,
          hookIndex,
          onCleanupReturned: () => markCleanupFunctionObserved(id, i),
          ran: false,
        },
      })
    }

    if (phase === 'update') {
      stat.updates += 1
      if (scheduled) {
        stat.scheduled += 1
        stat.lastChangedDep = dependencyChanges?.changes[0]?.slot ?? null
        stat.lastChangedDepIsPrimitive =
          stat.lastChangedDep === null
            ? null
            : dependencyIsPrimitive(effect.deps, stat.lastChangedDep)
        const rerun = dependencyChanges ? rerunKind(dependencyChanges) : null
        if (rerun) stat.reruns[rerun] += 1
      }
    }
  }
  return preparedEffect(
    {
      scheduled: currentList.scheduled,
      declaredScheduled,
      complete: !currentList.truncated && !previousList.truncated,
    },
    record,
    schedules,
    truncations,
    passiveInstrumentation,
  )
}

function preparedEffect(
  observation: EffectScheduleObservation,
  record: EffectRecord | null,
  schedules: PreparedEffectSchedule[] = [],
  truncations = 0,
  passiveInstrumentation: { effect: Effect; binding: PassiveEffectBinding }[] = [],
): PreparedEffectObservation {
  let published = false
  return {
    observation,
    publish(instance) {
      if (published) return
      published = true
      truncatedEffectLists += truncations
      if (record) records.set(record.id, record)
      for (const schedule of schedules) publishEffectSchedule(schedule, instance)
      for (const { effect, binding } of passiveInstrumentation) {
        instrumentPassiveEffect(effect, binding)
      }
    },
  }
}

function markCleanupFunctionObserved(fiberId: number, slot: number): void {
  const stat = records.get(fiberId)?.stats[slot]
  if (stat) stat.hasCleanup = true
}

type EffectCreate = (...args: unknown[]) => unknown
const originalCreates = new WeakMap<EffectCreate, EffectCreate>()

/** Every passive hook effect is wrapped, not only scheduled ones: React re-runs unscheduled effects when a hidden subtree is shown again. */
function instrumentPassiveEffect(effect: Effect, binding: PassiveEffectBinding): void {
  const mutable = effect as Effect & { create?: unknown }
  const current = mutable.create
  if (typeof current !== 'function') {
    markEffectInstrumentationUnavailable(binding.effectEventId)
    return
  }
  const original = originalCreates.get(current as EffectCreate) ?? (current as EffectCreate)
  const wrapped: EffectCreate = function (this: unknown, ...args: unknown[]): unknown {
    return runObservedPassiveEffect(binding, () => original.apply(this, args))
  }
  originalCreates.set(wrapped, original)
  try {
    mutable.create = wrapped
    if (mutable.create !== wrapped) markEffectInstrumentationUnavailable(binding.effectEventId)
  } catch {
    markEffectInstrumentationUnavailable(binding.effectEventId)
  }
}

/** Remove an effect owner only after React's exact onCommitFiberUnmount callback. */
export function removeEffectRecord(fiber: Fiber, fiberId?: number): void {
  if (ownsEffectList(fiber)) records.delete(fiberId ?? getFiberId(fiber))
}

/** Exact commit-time count of this component's effects scheduled by React. */
export function scheduledEffectCount(fiber: Fiber): number {
  return ownsEffectList(fiber) ? countScheduled(listEffects(fiber).effects) : 0
}

function countScheduled(effects: Effect[]): number {
  return effects.filter(
    (effect) => effectKind(effect.tag) !== null && (effect.tag & HOOK_HAS_EFFECT) !== 0,
  ).length
}

export function getEffectTrackingCoverage(): { truncatedEffectLists: number } {
  return { truncatedEffectLists }
}

export interface EffectAuditQuery extends ComponentNameSelector {
  limit: number
  /** Only components with an effect scheduled at the configured hot rate. */
  onlyHot?: boolean
  /** Exclude library components (node_modules, incl. Vite pre-bundled deps). Default true. */
  appOnly?: boolean
  /** Exact library provenance package to retain; callers must disable appOnly. */
  packageName?: string
  /** Minimum observed component updates before an effect can be classified hot. */
  minUpdates?: number
  /** Minimum observed effect fire rate across updates before it is classified hot. */
  minFireRate?: number
  /** Preferred name for the minimum observed schedule rate. */
  minScheduleRate?: number
  /** Internal guard: false means live Fiber attribution advanced while this report awaited source maps. */
  isAttributionCurrent?: () => boolean
}

export type EffectOwnership = 'app' | 'library' | 'unknown'
export type ProvenanceEvidence = 'exact' | 'inferred' | 'unknown'
export type EffectProvenanceReason = EffectDeclarationReason
export type { EffectHookAncestryFrame }

export interface EffectProvenance {
  ownership: EffectOwnership
  evidence: ProvenanceEvidence
  reason: EffectProvenanceReason
  hookSource: ResolvedSource | null
  packageName: string | null
  hookAncestry: EffectHookAncestryFrame[]
  definitionSource: null
  allocationCallsite: null
  hookDefinitionOwner: ResolvedSource | null
  hookCallsite: ResolvedSource | null
  package: string | null
  sourceMapConfidence: 'mapped' | 'served' | 'unknown'
  failureReason: 'hook-provenance-unavailable' | null
}

export type EffectHotnessLabel = 'hot' | 'not-hot' | 'insufficient-data'
export type EffectScheduleReason =
  | 'meets-threshold'
  | 'below-schedule-rate'
  | 'below-minimum-updates'

/** Why the label holds, from the question "does this effect run more often than its inputs justify?". */
export type EffectHotnessBasis =
  | 'reference-only-reruns'
  | 'no-dependency-array'
  | 'value-change-reruns'
  | 'dependency-values-not-compared'
  | 'not-rescheduled'
  | 'below-schedule-rate'
  | 'below-minimum-updates'

export interface EffectHotness {
  label: EffectHotnessLabel
  basis: EffectHotnessBasis
  /** Update re-runs by what their changed dependencies did. */
  reruns: { valueChanged: number; referenceOnly: number; undetermined: number }
  samples: number
  observedRate: number
  minUpdates: number
  minScheduleRate: number
  /** Legacy alias for minScheduleRate. */
  minFireRate: number
  confidenceInterval: { level: number; lower: number; upper: number }
  scheduleReason: EffectScheduleReason
  /** Legacy alias whose below-fire-rate value means below schedule rate, not execution. */
  reason: 'meets-threshold' | 'below-fire-rate' | 'below-minimum-updates'
}

export interface EffectFinding {
  index: number
  /** Flat hook index, the one react_inspect_component and react_effect_timeline report. */
  hookIndex: number
  /** The React hook that created this effect, e.g. useEffect or useSyncExternalStore. */
  hook: string | null
  /** Custom hooks around the call, outermost first; null when the hook inspector could not attribute it. */
  customHooks: string[] | null
  kind: EffectKind
  depsMode: DepsMode
  depCount: number
  scheduled: number
  schedulesEveryUpdate: boolean
  /** Legacy aliases retained for wire compatibility; both mean scheduled, not executed. */
  fired: number
  updates: number
  firesEveryUpdate: boolean
  lastChangedDep: number | null
  cleanupFunctionObserved: boolean
  /** Legacy alias for cleanupFunctionObserved. */
  hasCleanup: boolean
  note?: string
  /** This effect's own call-site (the `useEffect` call), or null when it cannot be attributed. */
  source: ResolvedSource | null
  /** True when the effect was created inside a library hook (node_modules), not your component. */
  isLibrary: boolean
  provenance: EffectProvenance
  hotness: EffectHotness
}

export interface EffectAuditRecord {
  id: number
  name: string
  source: ResolvedSource | null
  isLibrary: boolean
  componentProvenance: {
    ownership: EffectOwnership
    evidence: 'inferred' | 'unknown'
    reason: 'nearest-symbolicated-fiber' | 'source-unresolved'
    basis: OwnershipBasis | null
    source: ResolvedSource | null
  }
  effects: EffectFinding[]
  effectsOmitted: number
}

export interface EffectHotnessCriteria {
  minUpdates: number
  minScheduleRate: number
  /** Legacy alias for minScheduleRate. */
  minFireRate: number
  confidenceLevel: number
}

const totalEffects = (findings: EffectAuditRecord[]): number =>
  findings.reduce((sum, record) => sum + record.effects.length, 0)

/** The audited components plus the count of library-origin effects appOnly hid — for react_effect_audit's filteredNote. */
export async function getEffectAuditReport(query: EffectAuditQuery): Promise<{
  componentMatch: ComponentMatch | undefined
  components: EffectAuditRecord[]
  omittedByLimit: number
  effectsOmittedByLimit: number
  libraryEffectsHidden: number
  /** Effects appOnly kept, by ownership, before onlyHot narrows them further. */
  shownByAppOnly: { app: number; unknown: number }
  hotnessCriteria: EffectHotnessCriteria
  packageFilter?: {
    packageName: string
    matchedEffects: number
    excludedEffects: number
    unknownPackageEffects: number
  }
}> {
  const allRecords = snapshotEffectRecords()
  const componentMatch = describeComponentMatch(
    query,
    allRecords.map((record) => record.name),
  )
  const named = componentNameMatcher(query)
  const list = allRecords.filter((record) => named(record.name))

  // Public contracts pass their default explicitly; internal reads default to the complete provenance view so diagnostics never silently drop unknown rows.
  const appOnly = query.appOnly ?? false
  const minScheduleRate = query.minScheduleRate ?? query.minFireRate ?? DEFAULT_HOT_MIN_FIRE_RATE
  const hotnessCriteria: EffectHotnessCriteria = {
    minUpdates: query.minUpdates ?? DEFAULT_HOT_MIN_UPDATES,
    minScheduleRate,
    minFireRate: minScheduleRate,
    confidenceLevel: HOTNESS_CONFIDENCE_LEVEL,
  }
  const isCurrent = () => query.isAttributionCurrent?.() !== false
  const { classes: resolvedClasses } = await classifyFibersWithinBudget(
    list.map((record) => record.fiber),
    { limit: EFFECT_SOURCE_ATTRIBUTION_LIMIT, budgetMs: EFFECT_SOURCE_ATTRIBUTION_BUDGET_MS },
  )
  const declarationsByRecord = await resolveEffectDeclarations(
    list.map((record, index) => ({
      fiber: record.fiber,
      hookIndices: record.stats.filter(Boolean).map((stat) => stat.hookIndex),
      componentOwnership: resolvedClasses[index]?.ownership ?? 'unknown',
    })),
    isCurrent,
  )
  const classes = isCurrent() ? resolvedClasses : list.map(() => UNCLASSIFIED_FIBER)
  const all: EffectAuditRecord[] = list.map((record, index) => {
    const classification = classes[index] ?? UNCLASSIFIED_FIBER
    const { source, ownership, isLibrary } = classification
    const name = record.name === 'Anonymous' ? (sourceLabel(source) ?? record.name) : record.name
    const declarations = declarationsByRecord[index]
    return {
      id: record.id,
      name,
      source,
      isLibrary,
      componentProvenance: {
        ownership,
        evidence: ownership === 'unknown' ? 'unknown' : 'inferred',
        reason: ownership === 'unknown' ? 'source-unresolved' : 'nearest-symbolicated-fiber',
        basis: classification.ownershipBasis ?? null,
        source,
      },
      effects: record.stats.filter(Boolean).map((stat) => {
        const declaration = declarations?.get(stat.hookIndex)
        const provenance = effectProvenance(declaration)
        return {
          ...toFinding(stat, hotnessCriteria),
          hook: declaration?.hook ?? null,
          customHooks: declaration?.customHooks ?? null,
          source: provenance.hookSource,
          isLibrary: provenance.ownership === 'library',
          provenance,
        }
      }),
      effectsOmitted: 0,
    }
  })

  let findings = all
  let libraryEffectsHidden = 0
  let shownByAppOnly = { app: 0, unknown: 0 }
  let packageFilter:
    | {
        packageName: string
        matchedEffects: number
        excludedEffects: number
        unknownPackageEffects: number
      }
    | undefined
  if (query.packageName !== undefined) {
    const allEffects = all.flatMap((record) => record.effects)
    const unknownPackageEffects = allEffects.filter(
      (effect) => effect.provenance.packageName === null,
    ).length
    findings = all
      .map((record) => ({
        ...record,
        effects: record.effects.filter(
          (effect) => effect.provenance.packageName === query.packageName,
        ),
        effectsOmitted: record.effectsOmitted,
      }))
      .filter((record) => record.effects.length > 0)
    const matchedEffects = totalEffects(findings)
    packageFilter = {
      packageName: query.packageName,
      matchedEffects,
      excludedEffects: allEffects.length - matchedEffects,
      unknownPackageEffects,
    }
  }
  if (appOnly) {
    findings = all
      .map((record) => ({
        ...record,
        effects: record.effects.filter(isAppOwnedEffect),
        effectsOmitted: record.effectsOmitted,
      }))
      .filter((record) => record.effects.length > 0)
    libraryEffectsHidden = totalEffects(all) - totalEffects(findings)
    const kept = findings.flatMap((record) => record.effects)
    shownByAppOnly = {
      app: kept.filter((effect) => effect.provenance.ownership === 'app').length,
      unknown: kept.filter((effect) => effect.provenance.ownership === 'unknown').length,
    }
  }
  if (query.onlyHot) {
    findings = findings
      .map((record) => ({
        ...record,
        effects: record.effects.filter((effect) => effect.hotness.label === 'hot'),
        effectsOmitted: record.effectsOmitted,
      }))
      .filter((record) => record.effects.length > 0)
  }
  findings.sort((a, b) => score(b) - score(a))
  const omittedByLimit = Math.max(0, findings.length - query.limit)
  const selected = findings.slice(0, query.limit)
  let remainingEffects = EFFECT_REPORT_LIMIT
  let effectsOmittedByLimit = 0
  const components = selected.map((record) => {
    const effects = record.effects.slice(0, remainingEffects)
    const effectsOmitted = record.effectsOmitted + record.effects.length - effects.length
    remainingEffects -= effects.length
    effectsOmittedByLimit += effectsOmitted
    return { ...record, effects, effectsOmitted }
  })
  return {
    componentMatch,
    components,
    omittedByLimit,
    effectsOmittedByLimit,
    libraryEffectsHidden,
    shownByAppOnly,
    hotnessCriteria,
    ...(packageFilter === undefined ? {} : { packageFilter }),
  }
}

/** The effect's own declaration decides; an unresolved declaration stays visible and labelled unknown. */
function isAppOwnedEffect(effect: EffectAuditRecord['effects'][number]): boolean {
  return !isHiddenByAppOnly(effect.provenance.ownership)
}

function snapshotEffectRecords(): EffectRecord[] {
  return [...records.values()].map((record) => ({
    ...record,
    stats: record.stats.map((stat) => (stat ? { ...stat } : stat)),
  }))
}

// Surface re-run/loop smells first, then the most active effects.
function score(record: EffectAuditRecord): number {
  let total = 0
  for (const effect of record.effects) {
    if (effect.hotness.label === 'hot') total += 1_000_000
    total += effect.scheduled
  }
  return total
}

function toFinding(
  stat: EffectStat,
  criteria: EffectHotnessCriteria,
): Omit<EffectFinding, 'source' | 'isLibrary' | 'provenance' | 'hook' | 'customHooks'> {
  const schedulesEveryUpdate = stat.updates > 0 && stat.scheduled === stat.updates
  const hotness = classifyHotness(stat, criteria)
  return {
    index: stat.index,
    hookIndex: stat.hookIndex,
    kind: stat.kind,
    depsMode: stat.depsMode,
    depCount: stat.depCount,
    scheduled: stat.scheduled,
    schedulesEveryUpdate,
    fired: stat.scheduled,
    updates: stat.updates,
    firesEveryUpdate: schedulesEveryUpdate,
    lastChangedDep: stat.lastChangedDep,
    cleanupFunctionObserved: stat.hasCleanup,
    hasCleanup: stat.hasCleanup,
    note: noteFor(stat, hotness),
    hotness,
  }
}

const EFFECT_HOOK_NAMES: Record<EffectKind, string> = {
  effect: 'useEffect',
  layout: 'useLayoutEffect',
  insertion: 'useInsertionEffect',
}

function noteFor(stat: EffectStat, hotness: EffectHotness): string | undefined {
  if (hotness.label !== 'hot') return undefined
  const hookName = EFFECT_HOOK_NAMES[stat.kind]
  if (hotness.basis === 'no-dependency-array') {
    return `no dependency array — React scheduled this ${hookName} on ${stat.scheduled}/${stat.updates} updates; add dependencies only if repeated scheduling is unintended`
  }
  const slot = stat.lastChangedDep === null ? 'a dependency' : `dependency [${stat.lastChangedDep}]`
  return `re-ran ${hotness.reruns.referenceOnly} times when no dependency changed value — ${slot} is a new reference with equal contents; trace its producer and stabilize it or depend on its primitive fields`
}

function classifyHotness(stat: EffectStat, criteria: EffectHotnessCriteria): EffectHotness {
  const samples = stat.updates
  const observedRate = samples === 0 ? 0 : stat.scheduled / samples
  const scheduleReason: EffectScheduleReason =
    samples < criteria.minUpdates
      ? 'below-minimum-updates'
      : observedRate >= criteria.minScheduleRate
        ? 'meets-threshold'
        : 'below-schedule-rate'
  const reruns = {
    valueChanged: stat.reruns.value,
    referenceOnly: stat.reruns['reference-only'],
    undetermined: stat.reruns.undetermined,
  }
  const basis = hotnessBasis(stat, reruns, criteria, scheduleReason)
  const label: EffectHotnessLabel =
    basis === 'reference-only-reruns' || basis === 'no-dependency-array'
      ? 'hot'
      : basis === 'below-minimum-updates' || basis === 'dependency-values-not-compared'
        ? 'insufficient-data'
        : 'not-hot'
  const [lower, upper] = wilsonInterval(stat.scheduled, samples)
  return {
    label,
    basis,
    reruns,
    samples,
    observedRate: roundRate(observedRate),
    minUpdates: criteria.minUpdates,
    minScheduleRate: criteria.minScheduleRate,
    minFireRate: criteria.minFireRate,
    confidenceInterval: {
      level: criteria.confidenceLevel,
      lower: roundRate(lower),
      upper: roundRate(upper),
    },
    scheduleReason,
    reason: scheduleReason === 'below-schedule-rate' ? 'below-fire-rate' : scheduleReason,
  }
}

/** An effect with dependencies is hot when it keeps re-running while none of them changed value; one without dependencies runs after every render by design, so only its rate can make it hot. */
function hotnessBasis(
  stat: EffectStat,
  reruns: EffectHotness['reruns'],
  criteria: EffectHotnessCriteria,
  scheduleReason: EffectScheduleReason,
): EffectHotnessBasis {
  if (stat.depsMode === 'none') {
    if (scheduleReason === 'below-minimum-updates') return 'below-minimum-updates'
    return scheduleReason === 'meets-threshold' ? 'no-dependency-array' : 'below-schedule-rate'
  }
  if (reruns.referenceOnly >= criteria.minUpdates) return 'reference-only-reruns'
  if (reruns.referenceOnly + reruns.undetermined >= criteria.minUpdates) {
    return 'dependency-values-not-compared'
  }
  if (stat.updates < criteria.minUpdates) return 'below-minimum-updates'
  return stat.scheduled === 0 ? 'not-rescheduled' : 'value-change-reruns'
}

/** 95% Wilson score interval for a binomial schedule rate; stable even at 0/n and n/n. */
function wilsonInterval(successes: number, samples: number): [number, number] {
  if (samples === 0) return [0, 1]
  const z = 1.959963984540054
  const rate = successes / samples
  const zSquared = z * z
  const denominator = 1 + zSquared / samples
  const center = (rate + zSquared / (2 * samples)) / denominator
  const margin =
    (z * Math.sqrt((rate * (1 - rate) + zSquared / (4 * samples)) / samples)) / denominator
  return [Math.max(0, center - margin), Math.min(1, center + margin)]
}

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function effectProvenance(declaration: EffectDeclaration | undefined): EffectProvenance {
  const hookAncestry = declaration?.hookAncestry ?? []
  const hookCallsite = declaration?.evidence === 'exact' ? declaration.source : null
  const hookDefinitionOwner =
    [...hookAncestry].reverse().find((frame) => frame.source)?.source ?? null
  const strongest = hookCallsite ?? hookDefinitionOwner
  return {
    ownership: declaration?.ownership ?? 'unknown',
    evidence: declaration?.evidence ?? 'unknown',
    reason: declaration?.reason ?? 'attribution-budget-exhausted',
    hookSource: declaration?.source ?? null,
    packageName: declaration?.packageName ?? null,
    hookAncestry,
    definitionSource: null,
    allocationCallsite: null,
    hookDefinitionOwner,
    hookCallsite,
    package: declaration?.packageName ?? null,
    sourceMapConfidence: strongest?.sourceMapConfidence ?? (strongest ? 'served' : 'unknown'),
    failureReason: hookCallsite ? null : 'hook-provenance-unavailable',
  }
}

function listEffects(
  fiber: Fiber | null | undefined,
  budget?: CommitWorkBudget,
): {
  effects: Effect[]
  truncated: boolean
} {
  // bippy 0.7 types `updateQueue` members as `unknown`; the hook effect list shape is React-internal.
  const last = (fiber?.updateQueue?.lastEffect ?? null) as Effect | null
  const first = last?.next ?? null
  if (!first) return { effects: [], truncated: false }
  const list: Effect[] = []
  let effect: Effect | null = first
  let guard = 0
  while (effect && guard < EFFECT_WALK_LIMIT) {
    if (!consumeCommitWork(budget, 'effect-list')) {
      return { effects: list, truncated: true }
    }
    list.push(effect)
    effect = effect.next
    guard += 1
    if (effect === first) break
  }
  return { effects: list, truncated: effect !== first }
}

interface HookNode {
  memoizedState: unknown
  next: HookNode | null
}

interface EffectSlot {
  effect: Effect
  hookIndex: number
}

/** Effects in hook call order, keyed by hook slot: React also pushes hookless effects (useSyncExternalStore's snapshot check, useActionState's action sync) on only some renders, so list positions shift; those count as scheduled work but are never reported as app effects. */
function effectHookSlots(
  fiber: Fiber | null | undefined,
  budget?: CommitWorkBudget,
): { effects: EffectSlot[]; scheduled: number; truncated: boolean; lastHookIndex: number } {
  const list = listEffects(fiber, budget)
  const scheduled = countScheduled(list.effects)
  const listed = new Set<unknown>(list.effects)
  const effects: EffectSlot[] = []
  let hook = (list.effects.length > 0 ? (fiber?.memoizedState ?? null) : null) as HookNode | null
  for (let walked = 0; hook; walked += 1) {
    if (walked >= HOOK_WALK_LIMIT || !consumeCommitWork(budget, 'effect-list')) {
      return { effects, scheduled, truncated: true, lastHookIndex: walked - 1 }
    }
    if (listed.has(hook.memoizedState)) {
      effects.push({ effect: hook.memoizedState as Effect, hookIndex: walked })
    }
    hook = hook.next
  }
  return {
    effects,
    scheduled,
    truncated: list.truncated,
    lastHookIndex: effects.at(-1)?.hookIndex ?? -1,
  }
}

/** The effect each hook slot held in the previous render, read from the hook list React compares against: after a render that bailed out, the previous fiber keeps an older effect queue beside its new hooks. */
function previousEffectsByHookIndex(
  fiber: Fiber | null | undefined,
  lastHookIndex: number,
  budget?: CommitWorkBudget,
): { effects: Map<number, Effect>; truncated: boolean } {
  const effects = new Map<number, Effect>()
  let hook = (fiber?.memoizedState ?? null) as HookNode | null
  for (let index = 0; hook && index <= lastHookIndex; index += 1) {
    if (index >= HOOK_WALK_LIMIT || !consumeCommitWork(budget, 'effect-list')) {
      return { effects, truncated: true }
    }
    if (isEffectObject(hook.memoizedState)) effects.set(index, hook.memoizedState)
    hook = hook.next
  }
  return { effects, truncated: false }
}

function isEffectObject(value: unknown): value is Effect {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tag' in value &&
    typeof value.tag === 'number' &&
    'deps' in value &&
    'create' in value
  )
}

function hasCleanupFn(effect: Effect): boolean {
  if (typeof effect.destroy === 'function') return true
  const inst = (effect as { inst?: { destroy?: unknown } }).inst
  return typeof inst?.destroy === 'function'
}

function effectKind(tag: number): EffectKind | null {
  if ((tag & HOOK_PASSIVE) !== 0) return 'effect'
  if ((tag & HOOK_LAYOUT) !== 0) return 'layout'
  if ((tag & HOOK_INSERTION) !== 0) return 'insertion'
  return null
}

function depsModeOf(deps: unknown[] | null): DepsMode {
  if (deps == null) return 'none'
  return deps.length === 0 ? 'empty' : 'list'
}

function isPrimitive(value: unknown): boolean {
  return (typeof value !== 'object' && typeof value !== 'function') || value === null
}

function rerunKind(comparison: DependencyComparison): DependencyChange | null {
  if (comparison.status !== 'compared') return 'undetermined'
  if (comparison.changes.length === 0) return null
  if (comparison.changes.some((change) => change.change === 'value')) return 'value'
  if (comparison.changes.some((change) => change.change === 'undetermined')) return 'undetermined'
  return 'reference-only'
}

function dependencyIsPrimitive(dependencies: unknown[] | null, index: number): boolean | null {
  try {
    return isPrimitive(dependencies?.[index])
  } catch {
    return null
  }
}
