import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CART_COOKIE, SESSION_COOKIE } from '../../../../lib/cookie-names'
import { createSession, findUserBySession, USERS } from '../../../../lib/data/accounts'
import { findVariant, readCart, replaceCart } from '../../../../lib/data/cart'
import { presetLines } from '../../../../lib/data/fixtures'
import { clearFault, listFaults, setFault } from '../../../../lib/data/simulation'
import { resetStoreState } from '../../../../lib/data/state'
import type { CartLine } from '../../../../lib/data/types'
import { CART_PRESETS, OPERATIONS, type Operation } from '../../../../lib/dev-contract'

const commandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('login'), email: z.string() }),
  z.object({ command: z.literal('logout') }),
  z.object({
    command: z.literal('seed-cart'),
    preset: z.enum(CART_PRESETS).optional(),
    lines: z
      .array(z.object({ variantId: z.string(), quantity: z.number().int().positive() }))
      .optional(),
  }),
  z.object({
    command: z.literal('set-fault'),
    operation: z.enum(OPERATIONS as [Operation, ...Operation[]]),
    mode: z.enum(['fail', 'slow', 'clear']),
    latencyMs: z.number().int().nonnegative().nullable(),
    count: z.number().int().positive().nullable(),
  }),
  z.object({ command: z.literal('reset') }),
])

function notInDevelopment(): NextResponse | null {
  return process.env.NODE_ENV === 'development'
    ? null
    : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function snapshot() {
  const jar = await cookies()
  const user = findUserBySession(jar.get(SESSION_COOKIE)?.value)
  const cart = await readCart(jar.get(CART_COOKIE)?.value ?? null)
  return {
    user: user ? { email: user.email, name: user.name } : null,
    cart: {
      itemCount: cart.itemCount,
      subtotalCents: cart.subtotalCents,
      lines: cart.lines.map((line) => ({
        variantId: line.variantId,
        product: line.product.name,
        quantity: line.quantity,
        stock: line.stock,
      })),
    },
    faults: listFaults(),
    accounts: USERS.map((account) => account.email),
  }
}

export async function GET(): Promise<NextResponse> {
  return notInDevelopment() ?? NextResponse.json(await snapshot())
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const blocked = notInDevelopment()
  if (blocked) return blocked
  const parsed = commandSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 })
  }
  const command = parsed.data
  const jar = await cookies()
  switch (command.command) {
    case 'login': {
      const user = USERS.find((account) => account.email === command.email)
      if (!user)
        return NextResponse.json({ error: `No account for ${command.email}` }, { status: 404 })
      jar.set(SESSION_COOKIE, createSession(user), { httpOnly: true, sameSite: 'lax', path: '/' })
      break
    }
    case 'logout':
      jar.delete(SESSION_COOKIE)
      break
    case 'seed-cart': {
      const cartId = jar.get(CART_COOKIE)?.value
      if (!cartId) return NextResponse.json({ error: 'Open any page first' }, { status: 409 })
      const lines: CartLine[] = command.preset
        ? presetLines(command.preset)
        : (command.lines ?? []).flatMap(({ variantId, quantity }) => {
            const match = findVariant(variantId)
            return match ? [{ variantId, productId: match.product.id, quantity }] : []
          })
      replaceCart(cartId, lines)
      break
    }
    case 'set-fault':
      if (command.mode === 'clear') clearFault(command.operation)
      else
        setFault(command.operation, {
          mode: command.mode,
          latencyMs: command.latencyMs,
          remaining: command.count,
        })
      break
    case 'reset':
      resetStoreState()
      jar.delete(SESSION_COOKIE)
      break
  }
  return NextResponse.json(await snapshot())
}
