import { defineGenieTool, GenieToolError, registerGenieTools } from 'genie-react/tools'
import { z } from 'zod'
import { request } from '../api/http'
import { store } from '../store'
import { signIn, signOut } from '../store/session'
import { reduxTools } from './redux-tools'

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
    ...reduxTools(store),
  )
}
