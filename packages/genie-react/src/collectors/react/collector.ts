import { type Fiber, getRDTHook } from 'bippy'
import type { z } from 'zod'
import { defineCollector, defineCollectorTool, type GenieCollector } from '../../client'
import { reactPendingWorkContract, roundMilliseconds } from '../../protocol'
import { withBundlerRenameProof } from './bundler-renames'
import { findComponents } from './component-search'
import type { NodeId } from './contracts'
import {
  reactClearRendersContract,
  reactComponentCohortContract,
  reactComponentForDomContract,
  reactDomForComponentContract,
  reactEffectAuditContract,
  reactEffectEventsContract,
  reactEffectTimelineContract,
  reactErrorStateContract,
  reactFindComponentsContract,
  reactForceErrorBoundaryContract,
  reactGetRendersContract,
  reactGetTreeContract,
  reactHydrationContract,
  reactInspectComponentContract,
  reactInspectContextContract,
  reactListOverridesContract,
  reactOverrideContextContract,
  reactOverrideHookStateContract,
  reactOverridePropsContract,
  reactProfileReportContract,
  reactProfileSnapshotContract,
  reactProfileStartContract,
  reactProfileStopContract,
  reactProvenanceContract,
  reactRefreshEventsContract,
  reactRenderCausesContract,
  reactRendersDiffContract,
  reactResetOverridesContract,
  reactSuspenseContract,
  reactToggleSuspenseFallbackContract,
  stylexInspectContract,
} from './contracts'
import type { EffectEventsInput } from './effect-contract'
import { getEffectScheduleEventsWithOwnership } from './effect-events'
import { getEffectAuditReport, getEffectTrackingCoverage } from './effect-tracker'
import { getErrorState } from './error-tracker'
import {
  appOnlyFilteredNote,
  buildProvenanceReport,
  buildTree,
  contextsForFiber,
  describeOtherRoot,
  domForFiber,
  findAllRootFibers,
  findFiberById,
  findRootFiber,
  hostElementsWithin,
  hostSelectorOf,
  inspectFiber,
  nameOf,
  owningComponentFor,
  registerFiber,
} from './fiber'
import { getHydrationReport } from './hydration-report'
import { getMeasurementEnvironment, getStrictModeStatus } from './measurement-environment'
import { openMeasurementSpan, readMeasurementSpan } from './measurement-spans'
import { getActiveObservation, getAnalysisGeneration, getDocumentCommitId } from './observation'
import {
  applyContextOverride,
  applyErrorOverride,
  applyHookStateOverride,
  applySuspenseOverride,
  listOverrides,
  overrideFiberProps,
  resetOverrides,
} from './overrides'
import { getPendingReactWork } from './pending-work'
import { getRefreshEvents, startRefreshTracking } from './refresh-tracker'
import { getRenderCohort, summarizeCohort } from './render-cohort'
import {
  reactMeasureContract,
  reactRendersSinceContract,
  type renderObservationInputSchema,
} from './render-contract'
import {
  buildRenderTrackingCoverage,
  renderEvidenceComparability,
  renderSummarySemantics,
} from './render-snapshots'
import { summarizeRenderCauseEvent, summarizeRenderComponent } from './render-summary'
import {
  clearRenders,
  getAnalysisFailedFiberCount,
  getBudgetExhaustedCommitCount,
  getBudgetExhaustedSubsystems,
  getCommitCount,
  getDroppedPendingUnmountFiberCount,
  getPausedCommitCount,
  getPendingUnmountFiberCount,
  getPropsNotEnumeratedFiberCount,
  getRenderCauseMeasurement,
  getRenderObservationConfig,
  getRendersLeaderboardsMeasurement,
  getRendersMeasurement,
  getRenderTrackingCoverage,
  getSkippedCommitFiberCount,
  getTruncatedInputFiberCount,
  getUnobservedCommitCount,
  isRecordingPaused,
  isTracking,
  renderCollectionStatus,
  rendersDiff,
  setCommitListener,
  startRenderTracking,
  stopRenderTracking,
  takeSnapshot,
} from './render-tracker'
import { classifyFibersWithinBudget, isHiddenByAppOnly, ownershipCoverage } from './source'
import {
  describeElementStyles,
  indexStyleRules,
  parseStyleSources,
  styleProvenanceStatus,
} from './style-provenance'
import { getSuspenseReport } from './suspense-boundaries'
import { startSuspenseCapture } from './suspense-capture'

const COMPONENTS_DEPRECATION =
  'components is deprecated: pass component with a name or list of names, and exact:false to keep substring matching.'

/** One handler for react_clear_renders and react_profile_start, so `component` means the same thing as in the read tools. */
function startObservation({
  component,
  exact = true,
  components = [],
  roots,
  budget,
  lifecycle,
}: z.output<typeof renderObservationInputSchema>) {
  startRefreshTracking()
  startRenderTracking()
  const named = component === undefined ? [] : [component].flat()
  const observation = clearRenders({
    components: exact ? components : [...components, ...named],
    exactComponents: exact ? named : [],
    roots,
    budget,
    lifecycle,
  })
  return {
    ok: true,
    tracking: isTracking(),
    documentCommitId: getDocumentCommitId(),
    observation,
    observationConfig: getRenderObservationConfig(),
    strictMode: getStrictModeStatus(),
    ...(components.length > 0 ? { deprecations: [COMPONENTS_DEPRECATION] } : {}),
  }
}

function currentEffectCoverage() {
  const renderCoverage = getRenderTrackingCoverage('measurement')
  const { truncatedEffectLists } = getEffectTrackingCoverage()
  return {
    ...renderCoverage,
    complete: renderCoverage.complete && truncatedEffectLists === 0,
    truncatedEffectLists,
  }
}

async function effectTimeline({
  component,
  exact,
  afterDocumentCommitId,
  limit,
  appOnly,
}: EffectEventsInput) {
  const tracking = isTracking()
  const documentCommitId = getDocumentCommitId()
  const coverage = currentEffectCoverage()
  const report = await getEffectScheduleEventsWithOwnership({
    appOnly,
    component,
    exact,
    afterDocumentCommitId,
    limit,
  })
  return {
    tracking,
    documentCommitId,
    ...report,
    filteredNote: appOnly
      ? appOnlyFilteredNote(
          report.events.length,
          report.libraryEventsHidden,
          'effects',
          report.events.filter((event) => event.sourceOwnership === 'app').length,
          report.events.filter((event) => event.sourceOwnership === 'unknown').length,
        )
      : undefined,
    coverage: {
      ...coverage,
      complete:
        coverage.complete && report.evictedEvents === 0 && report.refreshCommitsExcluded === 0,
    },
  }
}

function styleTargets(
  selector: string | undefined,
  id: NodeId | undefined,
): { target: string; candidates: Element[] } {
  if (selector !== undefined) {
    try {
      return { target: selector, candidates: Array.from(document.querySelectorAll(selector)) }
    } catch {
      throw new Error(`Invalid CSS selector: ${JSON.stringify(selector)}`)
    }
  }
  const root = findRootFiber()
  const fiber = root && id !== undefined ? findFiberById(root, id) : null
  if (!fiber) throw new Error(`Component ${id} not found (it may have unmounted).`)
  // Only elements that carry styling, so a wrapper-heavy tree does not spend the limit on bare divs.
  const styled = hostElementsWithin(fiber).filter(
    (element) => element.classList.length > 0 || element.hasAttribute('data-style-src'),
  )
  return { target: `#${id} ${nameOf(fiber)}`, candidates: styled }
}

export function hasDomLookupRuntime(): boolean {
  const globals = globalThis as {
    navigator?: { product?: string }
    document?: { querySelectorAll?: unknown; body?: unknown }
    Element?: unknown
  }
  if (globals.navigator?.product === 'ReactNative') return false
  return (
    typeof globals.document?.querySelectorAll === 'function' &&
    globals.document.body !== undefined &&
    typeof globals.Element === 'function'
  )
}

const MOUNT_POLL_MS = 1000

/** The hello usually goes out before the app mounts, so the first tree Genie can see is announced again. A commit announces it at once; the slow poll covers a React that loaded before the DevTools hook and so never reports commits. */
function watchFirstMount(announce: () => void): { onCommit: () => void; stop: () => void } {
  let announced = findRootFiber() !== null
  let timer: ReturnType<typeof setInterval> | null = null
  const stop = () => {
    if (timer !== null) clearInterval(timer)
    timer = null
  }
  const check = () => {
    if (announced || findRootFiber() === null) return
    announced = true
    stop()
    announce()
  }
  if (!announced) {
    timer = setInterval(check, MOUNT_POLL_MS)
    if (typeof timer === 'object' && 'unref' in timer) timer.unref()
  }
  return {
    onCommit: () => {
      if (!announced) queueMicrotask(check)
    },
    stop,
  }
}

/** React collector: tree, search, inspection, live overrides; why-did-render + profiling need commit instrumentation from `genie-react/hook`. */
export function reactCollector(): GenieCollector {
  return defineCollector({
    meta: {
      id: 'react',
      title: 'React',
      description: 'Tree, inspect, renders, profiling',
    },
    capabilities: ['react'],
    appInfo: () => {
      const reactVersion = detectReactVersion()
      return { ...(reactVersion ? { reactVersion } : {}), reactMounted: findRootFiber() !== null }
    },
    start: (ctx) => {
      // Fallback for setups that did not load the hook early — captures future commits only.
      startRefreshTracking()
      startRenderTracking()
      startSuspenseCapture()
      const mountWatch = watchFirstMount(ctx.refreshTools)
      // Ride the commit loop with a throttled heartbeat so an animation- or list-saturated thread stays live.
      setCommitListener(() => {
        ctx.markActivity()
        mountWatch.onCommit()
      })
      return () => {
        setCommitListener(null)
        mountWatch.stop()
      }
    },
    tools: [
      defineCollectorTool({
        contract: reactGetTreeContract,
        handler: async ({ rootId, depth, includeHost, maxNodes, appOnly }) => {
          const root = findRootFiber()
          if (!root)
            return {
              rootId: null,
              nodes: [],
              total: 0,
              truncated: false,
              truncatedBy: null,
              omitted: { depth: 0, maxNodes: 0 },
            }
          if (rootId === undefined) {
            const otherRoots = findAllRootFibers(root).slice(1).flatMap(describeOtherRoot)
            return {
              ...(await buildTree(root, { depth, includeHost, maxNodes, appOnly })),
              ...(otherRoots.length > 0 ? { otherRoots } : {}),
            }
          }
          const subtreeRoot = findFiberById(root, rootId)
          if (!subtreeRoot) {
            throw new Error(`Component ${rootId} not found (it may have unmounted).`)
          }
          return buildTree(subtreeRoot, {
            depth,
            includeHost,
            maxNodes,
            appOnly,
            includeRoot: true,
          })
        },
      }),
      defineCollectorTool({
        contract: reactProvenanceContract,
        handler: ({ component, exact, limit, appOnly }) =>
          buildProvenanceReport(findAllRootFibers(), { component, exact, limit, appOnly }),
      }),
      defineCollectorTool({
        contract: reactFindComponentsContract,
        handler: (input) => findComponents(input),
      }),
      defineCollectorTool({
        contract: reactInspectComponentContract,
        handler: ({ id, path, depth }) => {
          const root = findRootFiber()
          const fiber = root ? findFiberById(root, id) : null
          if (!fiber) throw new Error(`Component ${id} not found (it may have unmounted).`)
          return inspectFiber(fiber, { path, depth })
        },
      }),
      defineCollectorTool({
        contract: reactOverridePropsContract,
        handler: ({ id, props }) => {
          overrideFiberProps(requireFiber(id), props)
          return { ok: true }
        },
      }),
      defineCollectorTool({
        contract: reactOverrideHookStateContract,
        handler: async ({ id, hookIndex, stateIndex, path, value }) => {
          const fiber = requireFiber(id)
          const commitsBefore = getDocumentCommitId()
          const resolved = applyHookStateOverride(fiber, { hookIndex, stateIndex }, path, value)
          const commitObserved = await observeCommitAfterOverride(commitsBefore)
          return {
            ok: true,
            name: nameOf(fiber),
            hookIndex: resolved.flatIndex,
            stateIndex: resolved.stateIndex,
            commitObserved,
            ...(commitObserved === false
              ? {
                  warning:
                    'the override was applied but no commit was observed — the new value may not have propagated to children (memo boundaries keep their last render); verify with react_inspect_component on a child',
                }
              : {}),
          }
        },
      }),
      defineCollectorTool({
        contract: reactOverrideContextContract,
        handler: ({ id, context, value }) => {
          const match = applyContextOverride(requireFiber(id), context, value)
          return {
            ok: true,
            providerId: registerFiber(match.provider),
            contextName: match.contextName,
          }
        },
      }),
      defineCollectorTool({
        contract: reactToggleSuspenseFallbackContract,
        handler: ({ id, showFallback }) => {
          const { boundary, active } = applySuspenseOverride(
            requireFiberForToggle(id, showFallback),
            showFallback,
          )
          return {
            ok: true,
            boundaryId: registerFiber(boundary),
            showingFallback: showFallback,
            activeOverrides: active,
          }
        },
      }),
      defineCollectorTool({
        contract: reactForceErrorBoundaryContract,
        handler: ({ id, forceError }) => {
          const { boundary, active } = applyErrorOverride(
            requireFiberForToggle(id, forceError),
            forceError,
          )
          return {
            ok: true,
            boundaryId: registerFiber(boundary),
            boundaryName: nameOf(boundary),
            erroring: forceError,
            activeOverrides: active,
          }
        },
      }),
      defineCollectorTool({
        contract: reactListOverridesContract,
        handler: () => listOverrides(),
      }),
      defineCollectorTool({
        contract: reactResetOverridesContract,
        handler: async () => {
          const commitsBefore = getDocumentCommitId()
          const result = resetOverrides()
          const rerendered = result.cleared.some((entry) => entry.outcome !== 'skipped-unmounted')
          return rerendered
            ? { ...result, commitObserved: await observeCommitAfterOverride(commitsBefore) }
            : result
        },
      }),
      defineCollectorTool({
        contract: reactDomForComponentContract,
        handler: ({ id, limit }) => {
          const root = findRootFiber()
          const fiber = root ? findFiberById(root, id) : null
          if (!fiber) throw new Error(`Component ${id} not found (it may have unmounted).`)
          return domForFiber(fiber, { limit })
        },
      }),
      defineCollectorTool({
        contract: reactComponentForDomContract,
        handler: async ({ selector, limit, propsDepth, appOnly }) => {
          if (!hasDomLookupRuntime()) throw new Error('No DOM in this environment.')
          let elements: Element[]
          try {
            elements = Array.from(document.querySelectorAll(selector))
          } catch {
            throw new Error(`Invalid CSS selector: ${JSON.stringify(selector)}`)
          }
          const seen = new Set<number>()
          const owners = []
          for (const element of elements.slice(0, 5000)) {
            const owner = owningComponentFor(element, propsDepth)
            if (!owner || seen.has(owner.id)) continue
            seen.add(owner.id)
            owners.push({
              owner,
              tag: element.tagName.toLowerCase(),
              styleSources: parseStyleSources(element.getAttribute?.('data-style-src') ?? null),
            })
          }
          const { classes } = await classifyFibersWithinBudget(
            owners.map((entry) => entry.owner.fiber),
          )
          const selected = owners.flatMap(({ owner, tag, styleSources }, index) => {
            const classification = classes[index]
            if (appOnly && isHiddenByAppOnly(classification?.ownership ?? 'unknown')) return []
            return [
              {
                id: owner.id as number,
                name: owner.name,
                kind: owner.kind,
                tag,
                props: owner.props,
                source: classification?.source ?? null,
                isLibrary: classification?.isLibrary ?? false,
                styleSources,
              },
            ]
          })
          return {
            selector,
            matched: elements.length,
            components: selected.slice(0, limit),
            omittedByLimit: Math.max(0, selected.length - limit),
            scanTruncated: elements.length > 5000,
            ownershipCoverage: ownershipCoverage(classes.map((entry) => entry.ownership)),
          }
        },
      }),
      defineCollectorTool({
        contract: stylexInspectContract,
        handler: ({ selector, id, limit }) => {
          if (!hasDomLookupRuntime()) throw new Error('No DOM in this environment.')
          const { target, candidates } = styleTargets(selector, id)
          const targets = candidates.slice(0, limit)
          const index = indexStyleRules(
            document,
            new Set(targets.flatMap((element) => Array.from(element.classList))),
          )
          const elements = targets.map((element) => {
            const owner = owningComponentFor(element, 0)
            return {
              tag: element.tagName.toLowerCase(),
              selector: hostSelectorOf(element),
              owner: owner ? { id: owner.id as number, name: owner.name } : null,
              ...describeElementStyles(element, index),
            }
          })
          return {
            target,
            matched: candidates.length,
            status: styleProvenanceStatus(elements),
            elements,
          }
        },
      }),
      defineCollectorTool({
        contract: reactInspectContextContract,
        handler: ({ id, depth }) => {
          const root = findRootFiber()
          const fiber = root ? findFiberById(root, id) : null
          if (!fiber) throw new Error(`Component ${id} not found (it may have unmounted).`)
          return contextsForFiber(fiber, { depth })
        },
      }),
      defineCollectorTool({
        contract: reactMeasureContract,
        handler: ({ label }) => {
          if (renderCollectionStatus().startsWith('unavailable')) {
            throw new Error(
              `Cannot open measurement: ${renderCollectionStatus()}. Enable render tracking and observe a commit first.`,
            )
          }
          if (isRecordingPaused()) {
            throw new Error(
              'Cannot open measurement: react_profile_stop paused recording. Run react_profile_start or react_clear_renders first.',
            )
          }
          return openMeasurementSpan(label)
        },
      }),
      defineCollectorTool({
        contract: reactRendersSinceContract,
        handler: ({ handle, close, component, exact, appOnly, limit }) =>
          readMeasurementSpan(handle, close, {
            component,
            exact,
            appOnly,
            limit,
            sort: 'renders',
          }),
      }),
      defineCollectorTool({
        contract: reactGetRendersContract,
        handler: async ({
          component,
          exact,
          nameFilter,
          excludeNames,
          minUpdates,
          cursor,
          includeCursor,
          sort,
          limit,
          appOnly,
          view,
        }) => {
          const report = await getRendersMeasurement({
            component,
            exact,
            nameFilter,
            excludeNames,
            minUpdates,
            cursor,
            includeCursor,
            sort,
            limit,
            appOnly,
          })
          const { summary, components, libraryHidden, omittedByLimit, sourceClassification } =
            report
          const classificationIncomplete = report.appOnly && !sourceClassification.complete
          const filteredNote = report.appOnly
            ? appOnlyFilteredNote(
                components.length,
                libraryHidden,
                'components',
                components.filter((entry) => entry.sourceOwnership === 'app').length,
                components.filter((entry) => entry.sourceOwnership === 'unknown').length,
              )
            : undefined
          const coverageInput = {
            skippedCommitFibers: report.skippedCommitFibers,
            droppedUnmountFibers: report.droppedUnmountFibers,
            analysisFailedFibers: report.analysisFailedFibers,
            pausedCommits: report.pausedCommits,
            unobservedCommits: report.unobservedCommits,
            truncatedInputFibers: report.truncatedInputFibers,
            propsNotEnumeratedFibers: report.propsNotEnumeratedFibers,
            budgetExhaustedCommits: report.budgetExhaustedCommits,
            budgetExhaustedSubsystems: report.budgetExhaustedSubsystems,
            budgetAdvice: report.budgetAdvice,
            gaps: report.coverageGaps,
          }
          const coverage = buildRenderTrackingCoverage(coverageInput, 'causal')
          const measurementCoverage = buildRenderTrackingCoverage(coverageInput, 'measurement')
          const comparability = renderEvidenceComparability(coverage, report.attribution.status)
          if (classificationIncomplete) {
            comparability.comparable = false
            comparability.notComparableReasons.push('app-source-classification-incomplete')
          }
          const reportSummary = {
            ...summary,
            semantics: classificationIncomplete
              ? ('unknown' as const)
              : renderSummarySemantics(measurementCoverage, summary.totalRenders),
            coverageDomain: 'render-measurement' as const,
          }
          const { unstableComponents, unnecessaryComponents, topUnstableProps, ...summaryView } =
            reportSummary
          return {
            componentMatch: report.componentMatch,
            tracking: report.tracking,
            renderCollection: report.renderCollection,
            ...report.measurementEnvironment,
            commits: report.commits,
            documentCommitId: report.documentCommitId,
            observation: report.observation,
            attribution: report.attribution,
            ...(view === 'full'
              ? { view, summary: reportSummary, components }
              : {
                  view,
                  summary: summaryView,
                  components: components.map((component) =>
                    summarizeRenderComponent(component, report.sort),
                  ),
                }),
            sourceClassification,
            omittedByLimit,
            nextCursor: report.nextCursor,
            pagination: report.pagination,
            ...comparability,
            coverage,
            filteredNote,
          }
        },
      }),
      defineCollectorTool({
        contract: reactRenderCausesContract,
        handler: async ({ commit, afterCommit, component, exact, limit, appOnly, view }) => {
          const report = await getRenderCauseMeasurement({
            commit,
            afterCommit,
            component,
            exact,
            limit,
            appOnly,
          })
          const { events, libraryHidden, omittedByLimit } = report
          const coverage = buildRenderTrackingCoverage(
            {
              skippedCommitFibers: report.skippedCommitFibers,
              droppedUnmountFibers: report.droppedUnmountFibers,
              analysisFailedFibers: report.analysisFailedFibers,
              pausedCommits: report.pausedCommits,
              unobservedCommits: report.unobservedCommits,
              truncatedInputFibers: report.truncatedInputFibers,
              propsNotEnumeratedFibers: report.propsNotEnumeratedFibers,
              budgetExhaustedCommits: report.budgetExhaustedCommits,
              budgetExhaustedSubsystems: report.budgetExhaustedSubsystems,
              budgetAdvice: report.budgetAdvice,
              gaps: report.coverageGaps,
            },
            'causal',
          )
          return {
            componentMatch: report.componentMatch,
            tracking: report.tracking,
            commits: report.commits,
            documentCommitId: report.documentCommitId,
            observation: report.observation,
            attribution: report.attribution,
            ...(view === 'full'
              ? { view, events }
              : {
                  view,
                  events: events.map((event) =>
                    summarizeRenderCauseEvent(event, report.observation?.id ?? null),
                  ),
                }),
            omittedByLimit,
            renderEventRetention: report.renderEventRetention,
            coverage: {
              ...coverage,
              complete: coverage.complete && report.renderEventRetention.evictedEvents === 0,
              semantics:
                coverage.complete && report.renderEventRetention.evictedEvents === 0
                  ? ('exact' as const)
                  : ('lower-bound' as const),
              droppedRenderEvents: report.renderEventRetention.evictedEvents,
            },
            filteredNote: appOnly
              ? appOnlyFilteredNote(
                  events.length,
                  libraryHidden,
                  'components',
                  events.filter((event) => event.sourceOwnership === 'app').length,
                  events.filter((event) => event.sourceOwnership === 'unknown').length,
                )
              : undefined,
          }
        },
      }),
      defineCollectorTool({
        contract: reactComponentCohortContract,
        handler: async ({ component, exact, limit, appOnly, view }) => {
          const cohort = await getRenderCohort(
            findRootFiber(),
            { component, exact, limit, appOnly },
            {
              skippedCommitFibers: getSkippedCommitFiberCount(),
              droppedUnmountFibers: getDroppedPendingUnmountFiberCount(),
              analysisFailedFibers: getAnalysisFailedFiberCount(),
              pausedCommits: getPausedCommitCount(),
              unobservedCommits: getUnobservedCommitCount(),
              truncatedInputFibers: getTruncatedInputFiberCount(),
              propsNotEnumeratedFibers: getPropsNotEnumeratedFiberCount(),
              budgetExhaustedCommits: getBudgetExhaustedCommitCount(),
              budgetExhaustedSubsystems: getBudgetExhaustedSubsystems(),
              pendingUnmountFibers: getPendingUnmountFiberCount(),
            },
          )
          return view === 'full' ? { ...cohort, view } : summarizeCohort(cohort)
        },
      }),
      defineCollectorTool({
        contract: reactEffectAuditContract,
        handler: async ({
          component,
          exact,
          onlyHot,
          appOnly,
          packageName,
          minUpdates,
          minFireRate,
          minScheduleRate,
          limit,
        }) => {
          const tracking = isTracking()
          const commits = getCommitCount()
          const documentCommitId = getDocumentCommitId()
          const analysisGeneration = getAnalysisGeneration()
          const coverage = currentEffectCoverage()
          const {
            componentMatch,
            components,
            omittedByLimit,
            effectsOmittedByLimit,
            libraryEffectsHidden,
            shownByAppOnly,
            hotnessCriteria,
            packageFilter,
          } = await getEffectAuditReport({
            component,
            exact,
            onlyHot,
            appOnly,
            packageName,
            minUpdates,
            minFireRate,
            minScheduleRate,
            limit,
            isAttributionCurrent: () =>
              getDocumentCommitId() === documentCommitId &&
              getAnalysisGeneration() === analysisGeneration,
          })
          const completedAtDocumentCommitId = getDocumentCommitId()
          const completedAtAnalysisGeneration = getAnalysisGeneration()
          const filteredNote = appOnly
            ? appOnlyFilteredNote(
                components.reduce((sum, entry) => sum + entry.effects.length, 0),
                libraryEffectsHidden,
                'effects',
                shownByAppOnly.app,
                shownByAppOnly.unknown,
              )
            : undefined
          return {
            componentMatch,
            tracking,
            commits,
            documentCommitId,
            attribution: {
              status:
                completedAtDocumentCommitId === documentCommitId &&
                completedAtAnalysisGeneration === analysisGeneration
                  ? ('current' as const)
                  : ('stale' as const),
              startedAtDocumentCommitId: documentCommitId,
              completedAtDocumentCommitId,
              startedAtAnalysisGeneration: analysisGeneration,
              completedAtAnalysisGeneration,
            },
            hotnessCriteria,
            components,
            omittedByLimit,
            effectsOmittedByLimit,
            coverage,
            filteredNote,
            packageFilter,
          }
        },
      }),
      defineCollectorTool({ contract: reactEffectEventsContract, handler: effectTimeline }),
      defineCollectorTool({
        contract: reactEffectTimelineContract,
        handler: effectTimeline,
      }),
      defineCollectorTool({
        contract: reactErrorStateContract,
        handler: ({ includeSource, limit, appOnly, afterDocumentCommitId }) =>
          getErrorState({ includeSource, limit, appOnly, afterDocumentCommitId }),
      }),
      defineCollectorTool({ contract: reactSuspenseContract, handler: getSuspenseReport }),
      defineCollectorTool({ contract: reactHydrationContract, handler: getHydrationReport }),
      defineCollectorTool({
        contract: reactPendingWorkContract,
        handler: () => getPendingReactWork(),
      }),
      defineCollectorTool({
        contract: reactRefreshEventsContract,
        handler: ({ afterSequence, limit, includeSource, appOnly }) =>
          getRefreshEvents({ afterSequence, limit, includeSource, appOnly }),
      }),
      defineCollectorTool({
        contract: reactClearRendersContract,
        handler: startObservation,
      }),
      defineCollectorTool({
        contract: reactProfileStartContract,
        handler: startObservation,
      }),
      defineCollectorTool({
        contract: reactProfileStopContract,
        handler: () => {
          stopRenderTracking()
          return {
            ok: true as const,
            tracking: false as const,
            commits: getCommitCount(),
            documentCommitId: getDocumentCommitId(),
            observation: getActiveObservation(),
            coverage: {
              ...getRenderTrackingCoverage('measurement'),
              truncatedEffectLists: getEffectTrackingCoverage().truncatedEffectLists,
            },
          }
        },
      }),
      defineCollectorTool({
        contract: reactProfileSnapshotContract,
        handler: async ({ label, appOnly }) => {
          const result = await takeSnapshot(label, appOnly)
          return { ok: true as const, ...result }
        },
      }),
      defineCollectorTool({
        contract: reactRendersDiffContract,
        handler: ({ baseline, thresholdMs, appOnly }) =>
          rendersDiff(baseline, thresholdMs, appOnly),
      }),
      defineCollectorTool({
        contract: reactProfileReportContract,
        handler: async ({ limit, component, exact, appOnly }) => {
          const measurement = await getRendersLeaderboardsMeasurement(limit, {
            component,
            exact,
            appOnly,
          })
          const { boards } = measurement
          const bySelfTime = boards.slowest
          const byRenders = boards.mostRerendered
          const byUnnecessary = boards.mostUnnecessary
          const byUnstable = boards.mostUnstable
          return {
            componentMatch: boards.componentMatch,
            ...getMeasurementEnvironment(),
            commits: measurement.commits,
            tracking: measurement.tracking,
            documentCommitId: measurement.documentCommitId,
            attribution: measurement.attribution,
            coverage: measurement.coverage,
            slowest: bySelfTime.map((r) => ({
              id: r.id,
              name: r.name,
              selfTime: roundMilliseconds(r.selfTime),
              renders: r.renders,
            })),
            mostRerendered: byRenders.map((r) => ({
              id: r.id,
              name: r.name,
              renders: r.renders,
              unnecessary: r.unnecessary,
            })),
            mostUnnecessary: byUnnecessary
              .filter((r) => r.unnecessary > 0)
              .map((r) => ({
                id: r.id,
                name: r.name,
                unnecessary: r.unnecessary,
                renders: r.renders,
              })),
            mostUnstable: byUnstable
              .filter((r) => r.unstableRenders > 0)
              .map((r) => ({
                id: r.id,
                name: r.name,
                unstableRenders: r.unstableRenders,
                renders: r.renders,
              })),
            mostReferenceOnly: byUnstable
              .filter((r) => r.referenceOnlyPropRenders > 0)
              .map((r) => ({
                id: r.id,
                name: r.name,
                referenceOnlyPropRenders: r.referenceOnlyPropRenders,
                renders: r.renders,
              })),
          }
        },
      }),
    ].map(withBundlerRenameProof),
  })
}

function requireFiber(id: NodeId): Fiber {
  const root = findRootFiber()
  const fiber = root ? findFiberById(root, id) : null
  if (!fiber) throw new Error(`Component ${id} not found (it may have unmounted).`)
  return fiber
}

const OVERRIDE_COMMIT_TIMEOUT_MS = 300
const OVERRIDE_COMMIT_POLL_MS = 16

/** Null means commits cannot be observed at all, so absence of one is not evidence the override failed to propagate. Document commits are counted whether or not a window is open. */
async function observeCommitAfterOverride(commitsBefore: number): Promise<boolean | null> {
  if (renderCollectionStatus().startsWith('unavailable')) return null
  const deadline = Date.now() + OVERRIDE_COMMIT_TIMEOUT_MS
  while (getDocumentCommitId() <= commitsBefore) {
    if (Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, OVERRIDE_COMMIT_POLL_MS))
  }
  return true
}

// A release-shaped toggle (showFallback:false / forceError:false) whose id no longer resolves is the stuck case: the forced boundary's subtree re-id'd on unmount, so point the agent at the id-free recovery.
function requireFiberForToggle(id: NodeId, activating: boolean): Fiber {
  try {
    return requireFiber(id)
  } catch (error) {
    if (activating) throw error
    throw new Error(
      `Component ${id} not found — its subtree likely re-mounted with new ids while forced. Call react_reset_overrides to release all forced boundaries without an id.`,
    )
  }
}

function detectReactVersion(): string | undefined {
  try {
    const hook = getRDTHook()
    if (hook?.renderers) {
      for (const renderer of hook.renderers.values()) {
        if (renderer.version) return renderer.version
      }
    }
  } catch {
    // hook not available
  }
  return undefined
}
