import { z } from 'zod'
import { defineCollector, defineCollectorTool, type GenieCollector } from '../../client'
import { isProductionBuild } from '../../production-build'
import {
  appValueSchema,
  defineAgentToolContract,
  dehydrate,
  isDehydratedNode,
  outputViewSchema,
  roundMilliseconds,
} from '../../protocol'
import { reduxStoreTaps } from '../causal/redux-store-registry'
import { selectEntries, selectionSchema, whereSchema } from '../value-selection'
import {
  instrumentReduxStore,
  type ReduxCollectorOptions,
  type ReduxDispatchRecord,
  type ReduxStoreLike,
  type ReduxStoreTap,
} from './store-tap'

export type { ReduxCollectorOptions, ReduxStoreLike } from './store-tap'

const RECORD_KINDS = ['action', 'thunk', 'unrecorded-change', 'mutation-outside-dispatch'] as const

const statePathSchema = z.array(z.union([z.string(), z.number()]))

const storeIdField = z
  .string()
  .optional()
  .describe('storeId from an earlier result; required only when the app collects several stores.')

const storeSchema = z.object({ storeId: z.string(), name: z.string() })

const mutationSchema = z.object({
  status: z
    .enum(['none-detected', 'detected', 'not-scanned'])
    .describe(
      'detected: an object that was already in the state changed in place during this dispatch, which an immutable reducer never does. none-detected covers only the scanned objects.',
    ),
  notScannedReason: z
    .enum([
      'nested-dispatch',
      'not-a-plain-action',
      'state-not-scannable',
      'disabled',
      'dispatch-threw',
    ])
    .nullable(),
  findings: z
    .array(
      z.object({
        path: statePathSchema.describe('State path of the changed property, from the root.'),
        change: z.enum([
          'property-replaced',
          'property-added',
          'property-removed',
          'length-changed',
        ]),
      }),
    )
    .describe('First 10 in-place changes.'),
  findingsOmitted: z.boolean(),
  objectsCompared: z.number().int().nonnegative(),
  scanTruncated: z
    .boolean()
    .describe(
      'The bounded scan stopped before every object or entry; an in-place change past it is not seen.',
    ),
})

const recordSchema = z.object({
  sequence: z.number().int().positive(),
  actionId: z.string(),
  kind: z
    .enum(RECORD_KINDS)
    .describe(
      'action: a dispatched value. thunk: a dispatched function; the actions it dispatches name it as parentActionId. unrecorded-change: Genie saw the state change with no recorded dispatch, as when middleware dispatches on its own. mutation-outside-dispatch: state objects changed in place between dispatches.',
    ),
  type: z.string().nullable(),
  label: z.string(),
  parentActionId: z
    .string()
    .nullable()
    .describe('The thunk or action whose dispatch made this one.'),
  at: z.number().describe('Epoch milliseconds when the dispatch began or the change was detected.'),
  durationMs: z.number().nonnegative().nullable(),
  outcome: z.enum(['returned', 'threw', 'in-progress', 'detected']),
  error: z.string().nullable(),
  rootStateChanged: z
    .boolean()
    .nullable()
    .describe(
      'false: the root state kept its identity, so no Redux subscriber re-renders. null for a thunk, whose actions are listed separately.',
    ),
  changedSlices: z.array(z.string()).describe('Top-level slices whose identity changed.'),
  changedSlicesTruncated: z.boolean(),
  unrecordedNestedDispatches: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Store notifications during this dispatch that no recorded action explains; its changedSlices may include their work.',
    ),
  mutation: mutationSchema,
  payload: appValueSchema(
    'The dispatched action as Genie copied it, depth-bounded; full view only.',
  ),
  renderEventIds: z
    .array(z.string())
    .optional()
    .describe(
      'Render events whose external-store cause names this action as exact; full view only.',
    ),
  reactWorkActive: z
    .boolean()
    .optional()
    .describe('React was rendering or committing when this dispatch began; full view only.'),
  genieMs: z
    .number()
    .nonnegative()
    .optional()
    .describe('Time Genie spent recording and scanning this dispatch; full view only.'),
})

const reduxActionsContract = defineAgentToolContract({
  name: 'redux_actions',
  title: 'List Redux actions',
  description:
    'List the Redux actions the app dispatched, oldest first: type, the thunk that dispatched it, the top-level slices whose identity changed, and an in-place mutation check. rootStateChanged=false means no subscriber re-rendered. mutation.status=detected means a reducer (or middleware, or a store listener) changed existing state objects instead of replacing them. Omit afterSequence for the latest page; pass nextAfterSequence to read forward. Join a render to its action through react_render_causes: an external-store cause carries `redux.actions`.',
  group: 'redux',
  input: z
    .object({
      storeId: storeIdField,
      type: z.string().optional().describe('Exact action type, e.g. "reports/NOTE_ADDED".'),
      typePrefix: z
        .string()
        .optional()
        .describe('Action types starting with this, e.g. "reports/".'),
      slice: z
        .string()
        .optional()
        .describe(
          'Records whose changedSlices include this top-level slice or whose mutation findings sit under it.',
        ),
      kinds: z.array(z.enum(RECORD_KINDS)).min(1).optional().describe('Record kinds to keep.'),
      mutationsOnly: z
        .boolean()
        .default(false)
        .describe('Only records with mutation.status=detected.'),
      afterSequence: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe('Records after this sequence, oldest first. Omit for the most recent page.'),
      limit: z.number().int().min(1).max(200).default(50),
      view: outputViewSchema(
        'each record with its bounded payload, linked render event IDs and Genie timing',
      ),
    })
    .meta({
      examples: [
        {},
        { typePrefix: 'reports/', limit: 20 },
        { mutationsOnly: true },
        { afterSequence: 40, view: 'full' },
      ],
    }),
  output: z.object({
    store: storeSchema,
    records: z.array(recordSchema),
    matched: z
      .number()
      .int()
      .nonnegative()
      .describe('Retained records matching the filters, counting only those after afterSequence.'),
    omittedBefore: z
      .number()
      .int()
      .nonnegative()
      .describe('Older matches not in this page; page back with a smaller afterSequence.'),
    more: z.boolean().describe('Newer matches exist after this page.'),
    nextAfterSequence: z.number().int().nonnegative().nullable(),
    latestSequence: z.number().int().nonnegative(),
    coverage: z.object({
      historyLimit: z.number().int().positive(),
      evictedRecords: z
        .number()
        .int()
        .nonnegative()
        .describe('Records dropped from the bounded history since the store was instrumented.'),
      unrecordedChanges: z
        .number()
        .int()
        .nonnegative()
        .describe(
          'Retained state changes with no recorded dispatch: middleware dispatching on its own, or components holding the dispatch from before Genie wrapped it.',
        ),
      mutationDetection: z.boolean(),
      libraryActions: z
        .object({
          recorded: z
            .boolean()
            .describe(
              'true: RTK Query actions are kept as records (recordLibraryActions). false: they are counted here and absent from records.',
            ),
          counted: z
            .number()
            .int()
            .nonnegative()
            .describe(
              'Dispatches counted instead of recorded since the store was instrumented: RTK Query actions, the anonymous thunks that dispatch only those, and state changes touching only RTK Query slices.',
            ),
          byType: z
            .array(
              z.object({
                kind: z.enum(['action', 'thunk', 'unrecorded-change']),
                type: z.string().nullable(),
                count: z.number().int().positive(),
              }),
            )
            .describe('Counts per kind and type, most frequent first; the first 50 types seen.'),
          otherTypesCount: z
            .number()
            .int()
            .nonnegative()
            .describe('Counted dispatches whose type arrived after the first 50.'),
        })
        .describe(
          'RTK Query keeps its own actions out of the history so they cannot evict the app actions.',
        ),
    }),
  }),
  annotations: { readOnlyHint: true, idempotentHint: true },
})

const reduxStateContract = defineAgentToolContract({
  name: 'redux_state',
  title: 'Read Redux state',
  description:
    'Read the current Redux state, or one path in it, depth-bounded like query_get: lists show their first 100 items and deeper values become placeholders whose path you can read next. To read one entity, pass `where` (for example {"field":"id","equals":"note-3"}) with the container\'s `path`. asOfSequence is the latest redux_actions record when the state was read.',
  group: 'redux',
  input: z
    .object({
      storeId: storeIdField,
      path: statePathSchema
        .optional()
        .describe('State path to read, e.g. ["reports", "notes"]. Omit for the root.'),
      depth: z.number().int().min(1).max(6).default(3),
      where: whereSchema,
    })
    .meta({
      examples: [
        {},
        { path: ['reports', 'notes'] },
        { path: ['issues', 'entities'], where: { field: 'id', equals: 'CORE-12' } },
      ],
    }),
  output: z.object({
    store: storeSchema,
    path: statePathSchema,
    found: z.boolean().describe('false: nothing at `path`, or it passes through a getter.'),
    value: appValueSchema('The state at `path`; absent when `where` is set or nothing is there.'),
    selection: selectionSchema,
    topLevelKeys: z
      .array(z.string())
      .describe('Top-level slice names, first 100, so a wrong path can be corrected.'),
    asOfSequence: z.number().int().nonnegative(),
  }),
  annotations: { readOnlyHint: true, idempotentHint: true },
})

const collectors = new WeakMap<object, GenieCollector>()

/** Records a Redux store's actions for the agent: development only, inert in production builds. Call it where the store is created, before components bind action creators to the unwrapped dispatch. Later calls for the same store return the first collector and ignore their options. */
export function reduxCollector(
  store: ReduxStoreLike,
  options: ReduxCollectorOptions = {},
): GenieCollector {
  const existing = collectors.get(store)
  if (existing) return existing
  const collector = createReduxCollector(store, options)
  collectors.set(store, collector)
  return collector
}

function createReduxCollector(
  store: ReduxStoreLike,
  options: ReduxCollectorOptions,
): GenieCollector {
  const meta = { id: 'redux', title: 'Redux', description: 'Redux actions and state' }
  if (isProductionBuild()) return defineCollector({ meta })
  const installation = instrumentReduxStore(store, options)
  if (!installation.ok) {
    console.warn(`[genie] Redux tools skipped: ${installation.reason}`)
    return defineCollector({ meta })
  }
  return defineCollector({
    meta,
    capabilities: ['redux'],
    tools: [
      defineCollectorTool({
        contract: reduxActionsContract,
        handler: (input) => listActions(resolveTap(input.storeId), input),
      }),
      defineCollectorTool({
        contract: reduxStateContract,
        handler: (input) => readState(resolveTap(input.storeId), input),
      }),
    ],
  })
}

function resolveTap(storeId: string | undefined): ReduxStoreTap {
  const taps = reduxStoreTaps() as ReduxStoreTap[]
  if (storeId !== undefined) {
    const tap = taps.find((candidate) => candidate.storeId === storeId)
    if (!tap) throw new Error(`No Redux store ${storeId}. Collected stores: ${describeTaps(taps)}.`)
    return tap
  }
  const [only, ...rest] = taps
  if (!only) throw new Error('No Redux store is collected on this page.')
  if (rest.length > 0) {
    throw new Error(`Several Redux stores are collected; pass storeId: ${describeTaps(taps)}.`)
  }
  return only
}

function describeTaps(taps: readonly ReduxStoreTap[]): string {
  return taps.map((tap) => `${tap.storeId} (${tap.name})`).join(', ') || 'none'
}

type ActionsInput = z.output<typeof reduxActionsContract.input>
type ActionsOutput = z.output<typeof reduxActionsContract.output>

function listActions(tap: ReduxStoreTap, input: ActionsInput): ActionsOutput {
  const records = tap.records()
  const after = input.afterSequence
  const matching = records.filter(
    (record) => (after === undefined || record.sequence > after) && matches(record, input),
  )
  const page = after === undefined ? matching.slice(-input.limit) : matching.slice(0, input.limit)
  const last = page.at(-1)
  const more = last ? matching.some((record) => record.sequence > last.sequence) : false
  return {
    store: { storeId: tap.storeId, name: tap.name },
    records: page.map((record) => describeRecord(record, input.view === 'full')),
    matched: matching.length,
    omittedBefore: after === undefined ? matching.length - page.length : 0,
    more,
    nextAfterSequence: last?.sequence ?? after ?? null,
    latestSequence: tap.latestSequence(),
    coverage: {
      historyLimit: tap.historyLimit,
      evictedRecords: tap.evictedRecords(),
      unrecordedChanges: records.filter((record) => record.kind === 'unrecorded-change').length,
      mutationDetection: tap.detectMutations,
      libraryActions: tap.libraryActions(),
    },
  }
}

function matches(record: ReduxDispatchRecord, input: ActionsInput): boolean {
  if (input.type !== undefined && record.type !== input.type) return false
  if (input.typePrefix !== undefined && !record.type?.startsWith(input.typePrefix)) return false
  if (input.kinds && !input.kinds.includes(record.kind)) return false
  if (input.mutationsOnly && record.mutation.status !== 'detected') return false
  if (input.slice !== undefined) {
    const slice = input.slice
    const touched =
      record.changedSlices.includes(slice) ||
      record.mutation.findings.some((finding) => finding.path[0] === slice)
    if (!touched) return false
  }
  return true
}

function describeRecord(
  record: ReduxDispatchRecord,
  full: boolean,
): ActionsOutput['records'][number] {
  return {
    sequence: record.sequence,
    actionId: record.actionId,
    kind: record.kind,
    type: record.type,
    label: record.label,
    parentActionId: record.parentActionId,
    at: record.timestamp,
    durationMs:
      record.endedAt === null ? null : roundMilliseconds(record.endedAt - record.startedAt),
    outcome: record.outcome,
    error: record.error,
    rootStateChanged: record.rootStateChanged,
    changedSlices: [...record.changedSlices],
    changedSlicesTruncated: record.changedSlicesTruncated,
    unrecordedNestedDispatches: record.unrecordedNestedDispatches,
    mutation: {
      ...record.mutation,
      findings: record.mutation.findings.map((finding) => ({
        path: [...finding.path],
        change: finding.change,
      })),
    },
    ...(full
      ? {
          payload: record.payload,
          renderEventIds: [...record.renderEventIds],
          reactWorkActive: record.reactWorkActive,
          genieMs: roundMilliseconds(record.genieMs),
        }
      : {}),
  }
}

type StateInput = z.output<typeof reduxStateContract.input>
type StateOutput = z.output<typeof reduxStateContract.output>

function readState(tap: ReduxStoreTap, input: StateInput): StateOutput {
  const state = tap.readState()
  const path = input.path ?? []
  const value = dehydrate(state, { depth: input.depth, path })
  const found = !isMissing(value)
  return {
    store: { storeId: tap.storeId, name: tap.name },
    path,
    found,
    value: input.where || !found ? undefined : value,
    selection: input.where ? selectEntries(state, path, input.where, input.depth) : undefined,
    topLevelKeys: topLevelKeys(state),
    asOfSequence: tap.latestSequence(),
  }
}

function isMissing(value: unknown): boolean {
  return isDehydratedNode(value) && (value.kind === 'not-found' || value.kind === 'getter-error')
}

function topLevelKeys(state: unknown): string[] {
  if (typeof state !== 'object' || state === null) return []
  try {
    return Object.keys(state).slice(0, 100)
  } catch {
    return []
  }
}
