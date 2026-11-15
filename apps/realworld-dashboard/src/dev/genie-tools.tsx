import { useRouter } from '@tanstack/react-router'
import { defineGenieTool, GenieToolError, useGenieTools } from 'genie-react/tools'
import { z } from 'zod'
import { ApiError } from '../api/client'
import { devApi } from '../api/endpoints'
import type { Role } from '../api/types'
import { useAuth } from '../app/auth'
import { usePermissionsSnapshot } from '../app/permissions'
import { queryClient } from '../app/query-client'
import { liveUpdates } from '../lib/live-updates'

const DEMO_PASSWORD = 'meridian'
const ACCOUNT_BY_ROLE: Record<Role, string> = {
  admin: 'morgan@meridian.test',
  manager: 'priya@meridian.test',
  agent: 'sami@meridian.test',
  viewer: 'lina@meridian.test',
}

const backendStateSchema = z.object({
  seed: z.number(),
  faults: z.array(
    z.object({
      method: z.string().optional(),
      path: z.string(),
      status: z.number(),
      message: z.string().optional(),
      times: z.number().optional(),
      remaining: z.number().nullable(),
    }),
  ),
  latency: z.array(z.object({ method: z.string().optional(), path: z.string(), ms: z.number() })),
  latencyScale: z.number(),
  requestCount: z.number(),
  counts: z.object({ orders: z.number(), customers: z.number(), products: z.number() }),
})

const apiPath = z
  .string()
  .regex(/^\/api\/[\w\-/]*\*?$/, 'An /api/ path, optionally ending in * to match a prefix')

async function callBackend<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request()
  } catch (error) {
    if (error instanceof ApiError) {
      throw new GenieToolError(error.message, {
        code: error.code.toUpperCase(),
        hint: 'check the arguments against the tool schema',
      })
    }
    throw error
  }
}

export const dashboardDevTools = [
  defineGenieTool({
    name: 'backend_state',
    group: 'backend',
    kind: 'query',
    description:
      'Returns the mock backend seed, active fault and latency rules, request count and record counts. Read it before and after changing faults or latency.',
    output: backendStateSchema,
    handler: () => callBackend(devApi.state),
  }),
  defineGenieTool({
    name: 'reset_backend',
    group: 'backend',
    kind: 'action',
    destructive: true,
    description:
      'Regenerates all mock data from a seed, clears fault and latency rules, and resets every TanStack Query cache entry so the UI refetches. Use before a reproducible run.',
    input: z.object({
      seed: z.number().int().optional().describe('Data seed; omit for the default dataset'),
    }),
    output: backendStateSchema,
    handler: async ({ seed }) => {
      const state = await callBackend(() => devApi.reset(seed))
      await queryClient.resetQueries()
      return state
    },
  }),
  defineGenieTool({
    name: 'inject_fault',
    group: 'backend',
    kind: 'action',
    description:
      'Adds a rule that makes matching API requests fail with the given HTTP status. Paths ending in * match a prefix. Call app_clear_faults to restore normal responses.',
    input: z.object({
      path: apiPath,
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
      status: z.number().int().min(400).max(599).default(500),
      times: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('Fail only this many matching requests; omit to fail until cleared'),
      message: z.string().max(200).optional(),
    }),
    output: backendStateSchema,
    handler: async (fault) => {
      const current = await callBackend(devApi.state)
      const existing = current.faults.map(({ remaining: _remaining, ...rule }) => rule)
      return callBackend(() => devApi.setFaults([...existing, fault]))
    },
  }),
  defineGenieTool({
    name: 'clear_faults',
    group: 'backend',
    kind: 'action',
    idempotent: true,
    description: 'Removes every injected fault rule so API requests succeed again.',
    output: backendStateSchema,
    handler: () => callBackend(() => devApi.setFaults([])),
  }),
  defineGenieTool({
    name: 'set_latency',
    group: 'backend',
    kind: 'action',
    idempotent: true,
    description:
      'Replaces the latency rules. Each rule fixes the response delay for matching requests; scale multiplies every delay, including defaults. Call with no rules and scale 1 to restore defaults.',
    input: z.object({
      rules: z
        .array(
          z.object({
            path: apiPath,
            method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
            ms: z.number().int().min(0).max(30_000),
          }),
        )
        .max(20)
        .default([]),
      scale: z.number().min(0).max(20).default(1),
    }),
    output: backendStateSchema,
    handler: ({ rules, scale }) => callBackend(() => devApi.setLatency(rules, scale)),
  }),
  defineGenieTool({
    name: 'live_updates',
    group: 'realtime',
    kind: 'query',
    description:
      'Returns how many live-update listeners are subscribed, in total and per topic. Use it to check that screens unsubscribe when they unmount.',
    output: z.object({ listeners: z.number(), topics: z.record(z.string(), z.number()) }),
    handler: () => ({ listeners: liveUpdates.listenerCount(), topics: liveUpdates.topics() }),
  }),
]

export function DashboardDevTools() {
  const { session, login, logout } = useAuth()
  const permissions = usePermissionsSnapshot(session?.user.role ?? null)
  const router = useRouter()

  useGenieTools([
    defineGenieTool({
      name: 'session',
      group: 'auth',
      kind: 'query',
      description:
        'Returns whether someone is signed in, their role, and the permissions that gate the current UI.',
      output: z.object({
        signedIn: z.boolean(),
        userId: z.string().nullable(),
        name: z.string().nullable(),
        role: z.string().nullable(),
        permissions: z.array(z.string()),
      }),
      handler: () => ({
        signedIn: session !== null,
        userId: session?.user.id ?? null,
        name: session?.user.name ?? null,
        role: session?.user.role ?? null,
        permissions,
      }),
    }),
    defineGenieTool({
      name: 'login_as',
      group: 'auth',
      kind: 'action',
      idempotent: true,
      description:
        'Signs in as the seeded demo user for a role and reloads route guards. Read app_session afterward for the permissions the UI now shows.',
      input: z.object({ role: z.enum(['admin', 'manager', 'agent', 'viewer']) }),
      output: z.object({ changed: z.boolean(), role: z.string(), userId: z.string() }),
      handler: async ({ role }) => {
        if (session?.user.role === role) return { changed: false, role, userId: session.user.id }
        const next = await callBackend(() => login(ACCOUNT_BY_ROLE[role], DEMO_PASSWORD))
        await router.invalidate()
        if (router.state.location.pathname === '/login') await router.navigate({ to: '/' })
        return { changed: true, role, userId: next.user.id }
      },
    }),
    defineGenieTool({
      name: 'sign_out',
      group: 'auth',
      kind: 'action',
      idempotent: true,
      description: 'Signs the current user out and returns to the login screen.',
      output: z.object({ changed: z.boolean() }),
      handler: async () => {
        if (!session) return { changed: false }
        logout()
        await router.navigate({ to: '/login' })
        return { changed: true }
      },
    }),
  ])
  return null
}
