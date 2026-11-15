'use client'

import { defineGenieTool, GenieToolError, useGenieTools } from 'genie-react/tools'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { CART_PRESETS, OPERATIONS, type Operation } from '../../lib/dev-contract'
import { clearRecentlyViewed } from '../../lib/recently-viewed'
import { useWishlist } from '../providers/wishlist-provider'

const stateSchema = z.object({
  user: z.object({ email: z.string(), name: z.string() }).nullable(),
  cart: z.object({
    itemCount: z.number(),
    subtotalCents: z.number(),
    lines: z.array(
      z.object({
        variantId: z.string(),
        product: z.string(),
        quantity: z.number(),
        stock: z.number(),
      }),
    ),
  }),
  faults: z.array(
    z.object({
      operation: z.string(),
      mode: z.enum(['fail', 'slow']),
      latencyMs: z.number().nullable(),
      remaining: z.number().nullable(),
    }),
  ),
  accounts: z.array(z.string()),
})

type StoreSnapshot = z.infer<typeof stateSchema>

async function sendCommand(command: Record<string, unknown> | null): Promise<StoreSnapshot> {
  const response = await fetch('/api/dev/state', {
    method: command ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: command ? JSON.stringify(command) : undefined,
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body ? String(body.error) : 'failed'
    throw new GenieToolError(message, { code: `HTTP_${response.status}` })
  }
  return stateSchema.parse(body)
}

const operationSchema = z.enum(OPERATIONS as [Operation, ...Operation[]])

export function StoreDevtools(): null {
  const router = useRouter()
  const wishlist = useWishlist()

  const mutate = async (command: Record<string, unknown>) => {
    const snapshot = await sendCommand(command)
    router.refresh()
    return snapshot
  }

  useGenieTools([
    defineGenieTool({
      name: 'store_state',
      group: 'store',
      kind: 'query',
      description:
        'Returns the server-side truth for this browser: signed-in user, cart lines with stock, active fault rules, and the demo account emails.',
      output: stateSchema,
      handler: () => sendCommand(null),
    }),
    defineGenieTool({
      name: 'login',
      group: 'store',
      kind: 'action',
      idempotent: true,
      description:
        'Signs this browser in as a demo account without the login form, then refreshes the current route. Read app_store_state for the accounts.',
      input: z.object({ email: z.string().default('ava@example.test') }),
      output: stateSchema,
      handler: ({ email }) => mutate({ command: 'login', email }),
    }),
    defineGenieTool({
      name: 'logout',
      group: 'store',
      kind: 'action',
      idempotent: true,
      description: 'Signs this browser out and refreshes the current route.',
      output: stateSchema,
      handler: () => mutate({ command: 'logout' }),
    }),
    defineGenieTool({
      name: 'seed_cart',
      group: 'store',
      kind: 'action',
      description:
        'Replaces this browser cart. preset "starter" adds three in-stock items; "low-stock" adds one line whose quantity equals its remaining stock. Or pass explicit lines by variantId.',
      input: z.object({
        preset: z.enum(CART_PRESETS).optional(),
        lines: z
          .array(z.object({ variantId: z.string(), quantity: z.number().int().positive() }))
          .optional(),
      }),
      output: stateSchema,
      handler: ({ preset, lines }) => mutate({ command: 'seed-cart', preset, lines }),
    }),
    defineGenieTool({
      name: 'set_fault',
      group: 'store',
      kind: 'action',
      description:
        'Makes a server data operation fail or respond slowly. count limits how many calls are affected (null means until cleared); mode "clear" removes the rule. Call app_reset afterwards.',
      input: z.object({
        operation: operationSchema,
        mode: z.enum(['fail', 'slow', 'clear']),
        latencyMs: z.number().int().nonnegative().max(30_000).nullable().default(null),
        count: z.number().int().positive().nullable().default(null),
      }),
      output: stateSchema,
      handler: (input) => sendCommand({ command: 'set-fault', ...input }),
    }),
    defineGenieTool({
      name: 'reset',
      group: 'store',
      kind: 'action',
      destructive: true,
      description:
        'Restores the seeded store: clears every cart, session, fault rule, placed order and this browser wishlist and recently viewed list, then refreshes the route.',
      output: stateSchema,
      handler: async () => {
        wishlist.clear()
        clearRecentlyViewed()
        return mutate({ command: 'reset' })
      },
    }),
  ])

  return null
}
