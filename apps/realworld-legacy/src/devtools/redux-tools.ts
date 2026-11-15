import type { Store } from '@reduxjs/toolkit'
import { defineGenieTool, GenieToolError } from 'genie-react/tools'
import { z } from 'zod'
import { boundedCopy, readRecordedActions, recordedSequence } from '../store/redux-recorder'

const STATE_LIMITS = { nodes: 5_000, text: 300 }

const recordedAction = z.object({
  sequence: z.number().int(),
  at: z.number(),
  type: z.string(),
  action: z.unknown(),
  truncated: z.boolean(),
  changedSlices: z.array(z.string()),
})

/** `app_redux_state` and `app_redux_actions` for one store; the actions come from `actionRecorder`. */
export function reduxTools(store: Store) {
  return [
    defineGenieTool({
      name: 'redux_state',
      group: 'redux',
      kind: 'query',
      description:
        'Reads the Redux store at a dot path such as "reports.notes" ("" for the root), copied within depth and maxItems; truncated says a bound cut it. asOfSequence is the last action app_redux_actions recorded: value is the state an action left when no later action changed this slice.',
      input: z.object({
        path: z.string().default(''),
        maxItems: z.number().int().min(1).max(200).default(25),
        depth: z.number().int().min(1).max(8).default(4),
      }),
      output: z.object({
        path: z.string(),
        asOfSequence: z.number().int(),
        value: z.unknown(),
        truncated: z.boolean(),
      }),
      handler: ({ path, maxItems, depth }) => ({
        path,
        asOfSequence: recordedSequence(),
        ...boundedCopy(readPath(store.getState(), path), {
          ...STATE_LIMITS,
          depth,
          items: maxItems,
        }),
      }),
    }),
    defineGenieTool({
      name: 'redux_actions',
      group: 'redux',
      kind: 'query',
      description:
        'Lists Redux actions after sinceSequence, oldest first: type, a bounded copy of the action as dispatched (payload, or meta.arg for a thunk), and changedSlices, the top-level slices whose reference changed. Empty changedSlices means no subscriber re-renders. Page with the last sequence; missed counts newer actions already evicted.',
      input: z.object({
        sinceSequence: z.number().int().min(0).default(0),
        typePrefix: z.string().default('').describe('Only types starting with this, e.g. reports/'),
        limit: z.number().int().min(1).max(300).default(50),
      }),
      output: z.object({
        latestSequence: z.number().int(),
        missed: z.number().int(),
        actions: z.array(recordedAction),
        more: z.boolean(),
      }),
      handler: ({ sinceSequence, typePrefix, limit }) => {
        const { latestSequence, missed, actions } = readRecordedActions(sinceSequence)
        const matching = actions.filter((entry) => entry.type.startsWith(typePrefix))
        return {
          latestSequence,
          missed,
          actions: matching.slice(0, limit),
          more: matching.length > limit,
        }
      },
    }),
  ]
}

function readPath(root: unknown, path: string): unknown {
  let value = root
  for (const segment of path.split('.').filter(Boolean)) {
    if (typeof value !== 'object' || value === null || !Object.hasOwn(value, segment)) {
      throw new GenieToolError(`No state at "${path}"`, {
        code: 'UNKNOWN_PATH',
        hint: 'Call app_redux_state with path "" to list the top-level slices',
      })
    }
    value = Reflect.get(value, segment)
  }
  return value
}
