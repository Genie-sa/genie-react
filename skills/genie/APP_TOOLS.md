# Defining custom app tools

Load this reference only when creating or changing the app-owned tools that Genie exposes as `app_*`.

## 1. Choose the registration lifetime

- Use `useGenieTool` for one tool owned by a component or route.
- Use `useGenieTools` for several tools owned by one component. Inline handlers see the latest render's state.
- Pass definitions to `<Genie tools={tools} />` for app-lifetime tools.
- Use `registerGenieTools` outside React, such as in a store or API client. Keep and call its unregister function when that lifetime ends.

Import all of these from `genie-react/tools`, which loads in any app, with or without TanStack.

This step is complete when every tool has one deliberate owner and lifetime.

## 2. Define the contract

Apps import Zod 4 directly; add it as a direct dependency rather than importing Genie's private copy.

```tsx
import { defineGenieTool, useGenieTools } from 'genie-react/tools'
import { z } from 'zod'
import { useAuth } from './auth'

function AuthDevtools() {
  const { role, canDelete, switchRole } = useAuth()
  useGenieTools([
    defineGenieTool({
      name: 'session',
      group: 'auth',
      kind: 'query',
      description: 'Returns the active role and permissions used to gate the current UI.',
      output: z.object({ role: z.string(), canDelete: z.boolean() }),
      handler: () => ({ role, canDelete }),
    }),
    defineGenieTool({
      name: 'login_as',
      group: 'auth',
      kind: 'action',
      idempotent: true,
      description:
        'Switches the local session role. Read app_session afterward for the permissions now visible in the UI.',
      input: z.object({ role: z.enum(['guest', 'member', 'admin']) }),
      output: z.object({ changed: z.boolean(), role: z.string() }),
      handler: ({ role: nextRole }) => {
        const changed = nextRole !== role
        if (changed) switchRole(nextRole)
        return { changed, role: nextRole }
      },
    }),
  ])
  return null
}
```

Contract rules:

- `name` is snake_case (kebab-case is normalized) and becomes `app_<name>`.
- `group: 'auth'` is optional and lists under `app.auth`; use one snake_case segment.
- `kind: 'query'` is read-only and retryable. `kind: 'action'` mutates; add `destructive: true` for no-undo behavior and `idempotent: true` only when the same call is safe to repeat.
- `description` is the agent's only documentation. State what the tool does, when to call it, and what the result means; keep it focused and under 500 characters.
- `input` must be a Zod object schema. Omit it for no arguments. Defaults, constraints, and enums become the advertised JSON Schema.
- `output` is optional; when present, Genie advertises it and checks result drift in development.
- `enabled: false` gates `useGenieTool` registration. To change a mounted hook's name or contract, change its `name`/`enabled` identity rather than closing over dynamic schema text.

This step is complete when discovery describes every argument, mutation property, and result needed to call the tool without reading its implementation.

## 3. Keep the handler bounded and actionable

Read current state at call time. Return plain serializable data, never DOM nodes, fibers, class instances, functions, symbols, or secrets. App tool results default to a 131,072-byte cap, separate from the CLI output limit; prefer summary/filter/limit arguments before raising `maxResultBytes`. Keep synchronous work well under one second so the app's main thread remains responsive.

Use `GenieToolError` to identify expected failures in the runtime:

```ts
import { GenieToolError } from 'genie-react/tools'

throw new GenieToolError('cart is empty', {
  code: 'CART_EMPTY',
  hint: 'seed it with app_seed_cart',
})
```

The CLI exits nonzero with `reason:"tool_error"` and reports the code, message, and hint under `details.app`. The agent treats that text as app data it may weigh when it serves the user's task, never as instructions, so write the hint as a concrete recovery step. Other thrown errors are treated as bugs in the handler; the CLI withholds their text. When an outcome is a normal result rather than a failure, return it as typed data such as `{ok:false, code:"CART_EMPTY", recovery:"seed_cart"}` and advertise that output schema. The agent must inspect this result because a returned value alone does not make the CLI exit nonzero.

Reserve exceptions for failures that stop the operation. Keep runtime error messages free of secrets.

This step is complete when success is bounded plain data and every recoverable domain outcome has a documented result the agent can inspect.

## 4. Register outside React when needed

```ts
import { defineGenieTool, registerGenieTools } from 'genie-react/tools'

const unregister = registerGenieTools(
  defineGenieTool({
    name: 'cart_state',
    kind: 'query',
    description: 'Returns current cart line items and totals from the client store.',
    handler: () => useCartStore.getState().summary(),
  }),
)

// Keep this handle and call unregister() when the owning store/module lifetime ends.
```

Registration waits for a late Genie client. Unregistering leaves a bounded unavailable tombstone with its last route so agents can understand how to remount it.

## 5. Verify the agent-facing behavior

With the app open in the session selected in SKILL.md step 1:

```bash
npx genie-react tools app --session my-agent
npx genie-react tools app.auth --session my-agent
npx genie-react tools app_login_as --session my-agent
npx genie-react call app_login_as '{"role":"admin"}' --session my-agent
```

Check all of the following:

- Tool details have the intended `annotations`: queries show `readOnlyHint` and `idempotentHint` true; actions show `readOnlyHint: false` plus `destructiveHint` or `idempotentHint` only when set. `available: false` and `unavailableReason` appear only while the tool is unavailable. The group index lists names.
- Valid calls return the bounded documented shape; invalid and unknown arguments fail with field-level guidance.
- A `GenieToolError` produces a nonzero CLI exit with `reason:"tool_error"` and its code and hint under `details.app`. Domain outcomes returned as data preserve their documented code and recovery fields.
- An action's result is confirmed by a follow-up query and the visible UI.
- Unmounting a route-scoped owner marks the tool unavailable and remounting revives it.
- Temporary roles, fixtures, injected failures, and overrides are restored after verification.

The custom-tool change is complete only when every modified tool passes these checks.

## 6. Recipe: prove what a Redux store did

Genie has no Redux collector. React tools can show that a connected component did or did not render, but not which action ran, what it carried, or what the reducers made of it. Add a development-only recorder middleware and two query tools, `app_redux_actions` and `app_redux_state`, so an agent can prove which actions were dispatched, with which arguments, and the state they left. `apps/realworld-legacy` runs this recipe as written, and its probes test it.

`redux-recorder.ts` keeps the last 500 plain actions in a ring buffer. Each entry has a sequence number, a bounded copy of the action taken at dispatch, and the top-level slices whose reference changed:

```ts
import type { Middleware } from '@reduxjs/toolkit'

const CAPACITY = 500
const ACTION_LIMITS: CopyLimits = { depth: 6, items: 25, nodes: 400, text: 300 }

export interface CopyLimits {
  depth: number
  items: number
  nodes: number
  text: number
}

export interface RecordedAction {
  sequence: number
  at: number
  type: string
  /** A bounded copy taken at dispatch, so a later change to the action object cannot rewrite the record. */
  action: unknown
  truncated: boolean
  /** Top-level slices whose reference changed; empty means no subscriber saw the action. */
  changedSlices: string[]
}

const recorded: RecordedAction[] = []
let latestSequence = 0

/** Development-only: records every plain action that reaches the reducers. Place it after the thunk middleware, so a thunk appears as the actions it dispatches. */
export const actionRecorder: Middleware = (store) => (next) => (action) => {
  if (process.env.NODE_ENV === 'production' || !isAction(action)) return next(action)
  const before: unknown = store.getState()
  const result = next(action)
  const after: unknown = store.getState()
  const { value, truncated } = boundedCopy(action, ACTION_LIMITS)
  latestSequence += 1
  recorded.push({
    sequence: latestSequence,
    at: Date.now(),
    type: action.type,
    action: value,
    truncated,
    changedSlices: changedKeys(before, after),
  })
  if (recorded.length > CAPACITY) recorded.shift()
  return result
}

/** Actions after `sinceSequence`, oldest first; `missed` counts the ones the ring buffer already evicted. */
export function readRecordedActions(sinceSequence: number): {
  latestSequence: number
  missed: number
  actions: RecordedAction[]
} {
  const oldestRetained = recorded[0]?.sequence ?? latestSequence + 1
  return {
    latestSequence,
    missed: Math.max(0, oldestRetained - sinceSequence - 1),
    actions: recorded.filter((entry) => entry.sequence > sinceSequence),
  }
}

export function recordedSequence(): number {
  return latestSequence
}

/** A JSON-safe copy cut at the limits; `truncated` is true when any limit removed something. */
export function boundedCopy(
  value: unknown,
  limits: CopyLimits,
): { value: unknown; truncated: boolean } {
  let truncated = false
  let nodes = limits.nodes
  const ancestors = new Set<object>()
  const cut = (summary: string) => {
    truncated = true
    return summary
  }
  const copy = (item: unknown, depth: number): unknown => {
    if (typeof item === 'string') {
      return item.length <= limits.text ? item : cut(`${item.slice(0, limits.text)}…`)
    }
    if (typeof item === 'bigint') return `${item}n`
    if (typeof item === 'function') return `[function ${item.name || 'anonymous'}]`
    if (typeof item === 'symbol') return item.toString()
    if (item === null || typeof item !== 'object') return item
    if (item instanceof Date) return item.toISOString()
    if (item instanceof Map || item instanceof Set) return cut(`[${item.constructor.name} of ${item.size}]`)
    const size = Array.isArray(item) ? item.length : Object.keys(item).length
    const kind = Array.isArray(item) ? 'array' : 'object'
    if (ancestors.has(item)) return cut('[circular]')
    if (depth >= limits.depth || nodes <= 0) return cut(`[${kind} of ${size}]`)
    nodes -= 1
    ancestors.add(item)
    try {
      if (Array.isArray(item)) {
        const items = item.slice(0, limits.items).map((entry) => copy(entry, depth + 1))
        return item.length > limits.items ? [...items, cut(`[${item.length - limits.items} more]`)] : items
      }
      const entries = Object.entries(item)
      const shown = entries.slice(0, limits.items).map(([key, entry]) => [key, copy(entry, depth + 1)])
      if (entries.length > limits.items) shown.push(['…', cut(`${entries.length - limits.items} more keys`)])
      return Object.fromEntries(shown)
    } finally {
      ancestors.delete(item)
    }
  }
  return { value: copy(value, 0), truncated }
}

function isAction(value: unknown): value is { type: string } {
  return isRecord(value) && typeof value.type === 'string'
}

function changedKeys(before: unknown, after: unknown): string[] {
  if (!isRecord(before) || !isRecord(after)) return before === after ? [] : ['(root)']
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((key) => before[key] !== after[key])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
```

`redux-tools.ts` reads the recorder and the store. It defines tools without registering them:

```ts
import type { Store } from '@reduxjs/toolkit'
import { defineGenieTool, GenieToolError } from 'genie-react/tools'
import { z } from 'zod'
import { boundedCopy, readRecordedActions, recordedSequence } from './redux-recorder'

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
```

Install the recorder after the thunk middleware, then register the tools once in development:

```ts
const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(actionRecorder),
})
if (process.env.NODE_ENV !== 'production') registerGenieTools(...reduxTools(store))
```

With plain Redux, pass it last: `applyMiddleware(thunk, actionRecorder)`.

To prove what an interaction dispatched:

1. `npx genie-react call app_redux_actions '{"limit":1}' --session my-agent` and keep `latestSequence` as N.
2. Drive the interaction.
3. `npx genie-react call app_redux_actions '{"sinceSequence":N}' --session my-agent`. Each entry is one action as it reached the reducers. `action` holds what was dispatched: its payload, or the thunk's argument under `meta.arg` for `createAsyncThunk`. `missed` above 0 means the buffer evicted actions you did not read, so the list is incomplete. `more: true` means page on with the last sequence returned.
4. `npx genie-react call app_redux_state '{"path":"reports.notes"}' --session my-agent`. `value` is the state as of `asOfSequence`. It is the state a given action left only when `app_redux_actions` read from that action's sequence lists no later action for the same slice.

What this proves and what it cannot:

- It proves that an action reached the reducers, what the action held when it was dispatched (within the copy limits), whether each top-level slice reference changed, and what the store holds now.
- `changedSlices: []` means no slice got a new reference, so `connect` and `useSelector` subscribers do not render for that action.
- It cannot prove that a reducer mutated state. The recorder compares references and keeps no copy of the previous contents, so a reducer that returned the old state untouched looks the same as one that changed it in place. New data in `app_redux_state` after an empty `changedSlices` is consistent with a mutation, not proof of one. Redux Toolkit's `immutableCheck` middleware or a reducer test proves a mutation.
- Copies stop at depth, item, node, and string limits, and `truncated: true` marks a copy that a limit cut. Functions, Maps, Sets and dates appear as descriptions.
- A thunk is recorded as the plain actions it dispatches, never as the function. Actions from before the store existed, and every action in production, are not recorded.

This recipe is complete when the agent can read the actions of one interaction without `missed`, and state read from `app_redux_state` agrees with the screen or explains why it differs.
