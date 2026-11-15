import { defineGenieTool, GenieToolError, registerGenieTools } from 'genie-react/tools'
import { z } from 'zod'
import { request } from '../api/http'
import { store } from '../store'
import { latestActionSequence, readActionLog } from '../store/action-log'
import { signIn, signOut } from '../store/session'

const DEMO_EMAIL = 'dana@acme.test'
const DEMO_PASSWORD = 'password'

const faultRule = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  path: z
    .string()
    .min(1)
    .describe(
      'Path prefix such as /api/reports/throughput, or a regular expression starting with ^',
    ),
  query: z
    .record(z.string(), z.string())
    .optional()
    .describe('Query parameters that must match exactly'),
  latencyMs: z.number().int().min(0).max(30_000).default(0),
  status: z
    .number()
    .int()
    .min(400)
    .max(599)
    .optional()
    .describe('Respond with this HTTP status instead of the real handler'),
  times: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Apply to this many matching requests, then stop'),
})

function readPath(root: unknown, path: string): unknown {
  return path
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((value, segment) => {
      if (value === null || typeof value !== 'object' || !(segment in value)) {
        throw new GenieToolError(`No state at "${path}"`, {
          code: 'UNKNOWN_PATH',
          hint: 'Call app_redux_state without a path to list the top-level slices',
        })
      }
      return (value as Record<string, unknown>)[segment]
    }, root)
}

function summarize(value: unknown, maxItems: number, depth: number): unknown {
  if (Array.isArray(value)) {
    const items = value.slice(0, maxItems).map((item) => summarize(item, maxItems, depth - 1))
    return value.length > maxItems ? { length: value.length, first: items } : items
  }
  if (value === null || typeof value !== 'object') return value
  const entries = Object.entries(value)
  if (depth <= 0) return { keys: entries.length }
  const shown = entries
    .slice(0, maxItems)
    .map(([key, item]) => [key, summarize(item, maxItems, depth - 1)])
  return entries.length > maxItems
    ? { keyCount: entries.length, first: Object.fromEntries(shown) }
    : Object.fromEntries(shown)
}

export function registerAppTools(): () => void {
  return registerGenieTools(
    defineGenieTool({
      name: 'sign_in',
      group: 'session',
      kind: 'action',
      idempotent: true,
      description: `Signs the browser in through the real login thunk (default ${DEMO_EMAIL}). Every user's password is "${DEMO_PASSWORD}". Returns the signed-in user; navigate afterwards to reach a screen.`,
      input: z.object({ email: z.string().email().default(DEMO_EMAIL) }),
      handler: async ({ email }) => {
        const result = await store.dispatch(signIn({ email, password: DEMO_PASSWORD }))
        if (signIn.rejected.match(result)) {
          throw new GenieToolError(result.error.message ?? 'Sign in failed', {
            code: 'SIGN_IN_FAILED',
            hint: 'Use an @acme.test address from GET /api/users, for example dana@acme.test',
          })
        }
        return { user: result.payload }
      },
    }),
    defineGenieTool({
      name: 'sign_out',
      group: 'session',
      kind: 'action',
      idempotent: true,
      description: 'Signs out through the real sign-out thunk; the app redirects to /login.',
      handler: async () => {
        await store.dispatch(signOut())
        return { signedOut: true }
      },
    }),
    defineGenieTool({
      name: 'backend_reset',
      group: 'backend',
      kind: 'action',
      destructive: true,
      description:
        'Regenerates the mock backend from a seed and clears injected faults. Redux keeps what it already loaded, so reload the page afterwards. notificationPollMs sets how often the app polls notifications.',
      input: z.object({
        seed: z.number().int().default(2019),
        notificationPollMs: z.number().int().min(100).max(120_000).default(15_000),
      }),
      handler: (body) =>
        request('/api/__control/reset', { method: 'POST', body: JSON.stringify(body) }),
    }),
    defineGenieTool({
      name: 'backend_faults',
      group: 'backend',
      kind: 'action',
      idempotent: true,
      description:
        'Replaces the mock backend fault rules. Each rule adds latency or an error status to matching requests, including JavaScript chunks under /static/js/. An empty list clears all faults. Returns the active rules.',
      input: z.object({ rules: z.array(faultRule).max(20) }),
      handler: (body) =>
        request('/api/__control/faults', { method: 'PUT', body: JSON.stringify(body) }),
    }),
    defineGenieTool({
      name: 'backend_notify',
      group: 'backend',
      kind: 'action',
      description:
        'Adds an unread notification for a user (default u-1, Dana). The app shows it on its next notification poll.',
      input: z.object({
        userId: z.string().default('u-1'),
        issueKey: z.string().default('CORE-1'),
        text: z.string().default('Priya Raman mentioned you in CORE-1'),
      }),
      handler: (body) =>
        request('/api/__control/notify', { method: 'POST', body: JSON.stringify(body) }),
    }),
    defineGenieTool({
      name: 'redux_state',
      group: 'redux',
      kind: 'query',
      description:
        'Reads the Redux store. path is a dot path such as "reports.notes" or "issues.filters"; omit it for the top-level slices. Arrays and objects longer than maxItems are cut to their first items with a length; nesting deeper than depth is reduced to a key count.',
      input: z.object({
        path: z.string().default(''),
        maxItems: z.number().int().min(1).max(200).default(20),
        depth: z.number().int().min(1).max(8).default(4),
      }),
      handler: ({ path, maxItems, depth }) => ({
        path,
        value: summarize(readPath(store.getState(), path), maxItems, depth),
      }),
    }),
    defineGenieTool({
      name: 'redux_actions',
      group: 'redux',
      kind: 'query',
      description:
        'Lists dispatched Redux actions, oldest first, with a payload preview and the top-level slices whose reference changed. Pass the returned latestSequence as sinceSequence on the next call to read only newer actions. An action with an empty changedSlices left the store unchanged, so connected components will not see it.',
      input: z.object({
        sinceSequence: z.number().int().min(0).default(0),
        typePrefix: z.string().default(''),
        limit: z.number().int().min(1).max(300).default(50),
      }),
      handler: ({ sinceSequence, typePrefix, limit }) => {
        const actions = readActionLog(sinceSequence).filter((entry) =>
          entry.type.startsWith(typePrefix),
        )
        return {
          latestSequence: latestActionSequence(),
          actions: actions.slice(-limit),
          omitted: Math.max(0, actions.length - limit),
        }
      },
    }),
  )
}
