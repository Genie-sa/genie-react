import { describe, expect, it } from 'vitest'
import type { RenderCauseEvent } from './render-causes'
import { renderComponentSchema, renderComponentSummarySchema } from './render-contract'
import type { RenderReport } from './render-model'
import { summarizeRenderCauseEvent, summarizeRenderComponent } from './render-summary'

const deepDiff = {
  changes: [{ kind: 'value' as const, path: '', before: 0, after: 1 }],
  visited: 1,
  truncated: false,
}

const instance = {
  fiberId: 4,
  mountId: 'mount:2',
  key: null,
  siblingIndex: 0,
  parent: { fiberId: 2, name: 'QueryClientProvider', key: null },
  keyedParent: null,
  logicalPath: 'QueryClientProvider[index=0] > App[index=0]',
  logicalIdentityEvidence: 'positional' as const,
  mountGeneration: 1,
  mountGenerationEvidence: 'exact' as const,
  hostSelector: null,
}

const assessment = {
  inputEvidence: 'changed' as const,
  observedInputKinds: ['state' as const],
  behaviorEvidence: {
    subtreeHostMutations: {
      status: 'observed' as const,
      count: 64,
      pendingSubtrees: 0,
      omittedByLimit: 0,
    },
    scheduledEffects: { status: 'observed' as const, count: 4 },
    unobservedDomains: [
      'focus' as const,
      'url' as const,
      'network' as const,
      'transition' as const,
      'freshness' as const,
      'effect-execution' as const,
    ],
  },
  optimizationSafety: 'not-proven-safe' as const,
  requiredValidation: [
    'dom' as const,
    'aria' as const,
    'focus' as const,
    'url' as const,
    'network' as const,
    'transition' as const,
  ],
}

const source = {
  file: 'App.tsx',
  line: 168,
  column: 4,
  functionName: 'App',
  sourceMapConfidence: 'mapped' as const,
}

const stateCause = {
  kind: 'state' as const,
  evidence: 'exact' as const,
  name: 'state[0]',
  before: 0,
  after: 1,
  deepDiff,
  hook: { index: 0, stateIndex: 0, kind: 'state' as const },
}

const propsCause = {
  kind: 'props' as const,
  evidence: 'exact' as const,
  name: 'onSelect',
  referenceChanged: true,
  referenceOnly: true,
  unstable: true,
  beforePresent: true,
  afterPresent: true,
  before: { type: 'function' },
  after: { type: 'function' },
  deepDiff: { changes: [], visited: 0, truncated: false },
}

const component: RenderReport = {
  id: 4,
  name: 'App',
  instance,
  renders: 2,
  mounts: 0,
  updates: 2,
  unnecessary: 0,
  referenceOnlyPropRenders: 1,
  unstableRenders: 1,
  functionIdentityPropRenders: 0,
  undeterminedReferencePropRenders: 0,
  forget: false,
  selfTime: 0.9000000059604645,
  totalTime: 2.0999999940395355,
  cumulativeSelfTime: 1.4000000059604645,
  cumulativeTotalTime: 2.0999999940395355,
  changes: [
    {
      name: 'state[0]',
      kind: 'state',
      unstable: false,
      hook: { index: 0, stateIndex: 0, kind: 'state' },
      before: 0,
      after: 1,
      deepDiff,
    },
  ],
  latestCommitId: 1,
  latestDocumentCommitId: 7,
  causes: [stateCause, propsCause],
  causeCounts: {
    mount: 0,
    props: 1,
    state: 2,
    children: 0,
    context: 0,
    'external-store': 0,
    query: 0,
    router: 0,
    parent: 0,
    unknown: 0,
  },
  necessity: 'necessary',
  assessment,
  inputCoverage: {
    complete: true,
    omittedInputs: 0,
    scanTruncated: false,
    propsNotEnumerated: false,
  },
  noObservedInputChange: 0,
  compiler: {
    memoCacheObserved: false,
    evidence: 'exact',
    compilationStatus: 'unknown',
    limitation: 'runtime-memo-cache-presence-only',
  },
  source,
  sourceAttribution: { role: 'usage-or-definition-fallback', evidence: 'inferred' },
  sourceProvenance: {
    definitionSource: null,
    allocationCallsite: null,
    hookDefinitionOwner: null,
    hookCallsite: null,
    package: null,
    sourceMapConfidence: 'mapped',
    failureReason: 'definition-and-allocation-not-distinguished',
    usageOrDefinitionFallback: source,
  },
  sourceOwnership: 'app',
  isLibrary: false,
  wrapperAncestry: [],
}

type FullComponentKey = keyof typeof renderComponentSchema.shape
type SummaryComponentKey = keyof typeof renderComponentSummarySchema.shape

const SUMMARY_DISPOSITION: Record<
  FullComponentKey,
  { emits: SummaryComponentKey[] } | { excluded: string }
> = {
  id: { emits: ['id'] },
  name: { emits: ['name'] },
  instance: { emits: ['mountId', 'key'] },
  renders: { emits: ['renders'] },
  mounts: { emits: ['mounts'] },
  updates: { emits: ['updates'] },
  unnecessary: { excluded: 'legacy alias of noObservedInputChange' },
  noObservedInputChange: { emits: ['noObservedInputChange'] },
  referenceOnlyPropRenders: { emits: ['referenceOnlyPropRenders'] },
  unstableRenders: { excluded: 'legacy alias of referenceOnlyPropRenders' },
  functionIdentityPropRenders: { emits: ['functionIdentityPropRenders'] },
  undeterminedReferencePropRenders: { emits: ['undeterminedReferencePropRenders'] },
  forget: { excluded: 'legacy alias of compiler.memoCacheObserved' },
  compiler: { emits: ['memoCacheObserved'] },
  selfTime: { emits: ['selfTime'] },
  totalTime: { emits: ['totalTime'] },
  cumulativeSelfTime: { emits: ['cumulativeSelfTime'] },
  cumulativeTotalTime: { emits: ['cumulativeTotalTime'] },
  changes: { excluded: 'legacy changes-only list; causes carry the same names' },
  latestCommitId: { excluded: 'renderer-local; latestDocumentCommitId joins across tools' },
  latestDocumentCommitId: { emits: ['latestDocumentCommitId'] },
  causes: { emits: ['causes'] },
  causeCounts: { emits: ['causeCounts'] },
  necessity: { excluded: 'legacy input-only classification; inputEvidence replaces it' },
  assessment: { emits: ['inputEvidence'] },
  inputCoverage: { emits: ['inputCoverage'] },
  source: { emits: ['source'] },
  sourceAttribution: { excluded: 'detailed provenance stays in view:"full"' },
  sourceProvenance: { excluded: 'detailed provenance stays in view:"full"' },
  sourceOwnership: { emits: ['source'] },
  isLibrary: { excluded: 'derivable from source.ownership' },
  wrapperAncestry: { emits: ['wrappers'] },
}

describe('render summary view', () => {
  it('accounts for every full component field and emits every summary field', () => {
    const summary = summarizeRenderComponent({
      ...component,
      instance: { ...instance, key: '77' },
      mounts: 1,
      unnecessary: 1,
      noObservedInputChange: 1,
      functionIdentityPropRenders: 1,
      undeterminedReferencePropRenders: 1,
      cumulativeTotalTime: 3,
      compiler: { ...component.compiler, memoCacheObserved: true },
      wrapperAncestry: [{ kind: 'memo', name: 'Memo(App)' }],
      inputCoverage: { ...component.inputCoverage, complete: false, propsNotEnumerated: true },
    })
    const dispositions = Object.values(SUMMARY_DISPOSITION)
    const emitted = dispositions.flatMap((disposition) =>
      'emits' in disposition ? disposition.emits : [],
    )

    expect(Object.keys(SUMMARY_DISPOSITION).sort()).toEqual(
      Object.keys(renderComponentSchema.shape).sort(),
    )
    expect([...new Set(emitted)].sort()).toEqual(
      Object.keys(renderComponentSummarySchema.shape).sort(),
    )
    expect(Object.keys(summary).sort()).toEqual([...new Set(emitted)].sort())
  })

  it('keeps the field a memo sort ranks by even when it is zero', () => {
    expect(summarizeRenderComponent(component, 'unnecessary')).toMatchObject({
      noObservedInputChange: 0,
    })
    expect(
      summarizeRenderComponent({ ...component, referenceOnlyPropRenders: 0 }, 'unstable'),
    ).toMatchObject({ referenceOnlyPropRenders: 0 })
    expect(summarizeRenderComponent(component)).not.toHaveProperty('noObservedInputChange')
  })

  it('tells a query data change from a fetchStatus-only notification', () => {
    const summary = summarizeRenderComponent({
      ...component,
      causes: [
        {
          kind: 'query',
          evidence: 'exact',
          reason: 'query-notification-delivered',
          hookIndex: 0,
          externalStoreIndex: 0,
          subscriberId: 'subscriber:1',
          selectionEqual: false,
          before: null,
          after: null,
          changedFields: ['fetchStatus'],
          deepDiff,
          queryHash: '["todos"]',
          notification: {
            trackedFields: ['data', 'fetchStatus'],
            trackedFieldsCoverage: 'exact',
            changedResultFields: ['fetchStatus'],
            deliveryReason: 'tracked-field-changed:fetchStatus',
            fanout: 1,
            structuralSharing: { reusedFields: ['data'], changedFields: [], truncated: false },
          },
        },
      ],
    })
    expect(summary.causes).toEqual([
      {
        kind: 'query',
        evidence: 'exact',
        name: '["todos"]',
        reason: 'query-notification-delivered',
        changedResultFields: ['fetchStatus'],
      },
    ])
  })

  it('keeps decision fields, drops values and legacy aliases, and collapses source fields', () => {
    const summary = summarizeRenderComponent(component)

    expect(summary).toEqual({
      id: 4,
      name: 'App',
      mountId: 'mount:2',
      renders: 2,
      updates: 2,
      referenceOnlyPropRenders: 1,
      selfTime: 0.9,
      totalTime: 2.1,
      cumulativeSelfTime: 1.4,
      latestDocumentCommitId: 7,
      causeCounts: { props: 1, state: 2 },
      causes: [
        { kind: 'state', evidence: 'exact', name: 'state[0]' },
        { kind: 'props', evidence: 'exact', name: 'onSelect', referenceOnly: true },
      ],
      inputEvidence: 'changed',
      source: { location: 'App.tsx:168:4', ownership: 'app' },
    })
    expect(Buffer.byteLength(JSON.stringify(summary))).toBeLessThan(500)
    expect(Buffer.byteLength(JSON.stringify(component))).toBeGreaterThan(2_000)
  })

  it('keeps keys, wrappers, memo-cache evidence and only the failing input checks', () => {
    expect(
      summarizeRenderComponent({
        ...component,
        instance: { ...instance, key: '77' },
        mounts: 1,
        compiler: { ...component.compiler, memoCacheObserved: true },
        wrapperAncestry: [{ kind: 'memo', name: 'Memo(App)' }],
        inputCoverage: {
          complete: false,
          omittedInputs: 0,
          scanTruncated: false,
          propsNotEnumerated: true,
        },
        source: null,
        sourceOwnership: 'unknown',
      }),
    ).toMatchObject({
      key: '77',
      mounts: 1,
      memoCacheObserved: true,
      wrappers: ['Memo(App)'],
      inputCoverage: { complete: false, propsNotEnumerated: true },
      source: { location: null, ownership: 'unknown' },
    })
  })

  it('reduces a render event to identity, named causes and source', () => {
    const event: RenderCauseEvent = {
      renderEventId: 'render:7:817',
      observationId: 'observation:1',
      commitId: 1,
      documentCommitId: 7,
      componentId: 479,
      componentName: 'StressRow',
      instance: { ...instance, key: '77' },
      causes: [
        {
          kind: 'parent',
          evidence: 'inferred',
          parentId: 92,
          parentName: 'StressGrid',
          reason: 'nearest-rendered-ancestor',
        },
        { kind: 'unknown', evidence: 'unknown', reason: 'input-analysis-incomplete' },
      ],
      necessity: 'unknown',
      assessment,
      inputCoverage: {
        complete: false,
        omittedInputs: 0,
        scanTruncated: false,
        propsNotEnumerated: true,
      },
      source: { ...source, line: 134, column: null },
      sourceAttribution: { role: 'usage-or-definition-fallback', evidence: 'inferred' },
      sourceOwnership: 'app',
      isLibrary: false,
    }

    expect(summarizeRenderCauseEvent(event, 'observation:1')).toEqual({
      renderEventId: 'render:7:817',
      documentCommitId: 7,
      componentId: 479,
      componentName: 'StressRow',
      mountId: 'mount:2',
      key: '77',
      causes: [
        { kind: 'parent', evidence: 'inferred', name: 'StressGrid' },
        { kind: 'unknown', evidence: 'unknown', reason: 'input-analysis-incomplete' },
      ],
      inputEvidence: 'changed',
      inputCoverage: { complete: false, propsNotEnumerated: true },
      source: { location: 'App.tsx:134', ownership: 'app' },
    })
    expect(summarizeRenderCauseEvent(event, 'observation:2')).toMatchObject({
      observationId: 'observation:1',
    })
  })
})
