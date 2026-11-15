import { createRandom, integerBetween, pickOne } from './random'
import { simulate } from './simulation'
import { storeState } from './state'
import type { Order, OrderStatus, User } from './types'

export const DEMO_PASSWORD = 'storefront'

export const USERS: readonly User[] = [
  {
    id: 'user-ava',
    email: 'ava@example.test',
    name: 'Ava Lindqvist',
    memberSince: '2023-03-14',
    tier: 'plus',
  },
  {
    id: 'user-noah',
    email: 'noah@example.test',
    name: 'Noah Berg',
    memberSince: '2025-09-02',
    tier: 'standard',
  },
]

const ORDER_STATUSES: readonly OrderStatus[] = [
  'delivered',
  'delivered',
  'shipped',
  'processing',
  'delivered',
  'cancelled',
  'delivered',
  'shipped',
  'processing',
  'delivered',
  'delivered',
  'shipped',
  'delivered',
  'processing',
]

const ORDER_ITEMS = ['Harbor Parka', 'Cedar Crewneck', 'Lark Tote', 'Fjord Beanie', 'Atlas Loafer']

function seedOrders(user: User): Order[] {
  const random = createRandom(user.id.length * 7919)
  const count = user.tier === 'plus' ? ORDER_STATUSES.length : 3
  return Array.from({ length: count }, (_, index) => {
    const itemCount = integerBetween(random, 1, 4)
    return {
      id: `SF-${String(48_210 + index * 17).padStart(6, '0')}`,
      userId: user.id,
      placedAt: new Date(Date.UTC(2026, 9, 28) - index * 9 * 86_400_000).toISOString(),
      status: ORDER_STATUSES[index] ?? 'delivered',
      totalCents: integerBetween(random, 30, 600) * 100 - 1,
      itemCount,
      items: Array.from({ length: itemCount }, () => ({
        name: pickOne(random, ORDER_ITEMS),
        quantity: 1,
      })),
    }
  })
}

export function findUserByEmail(email: string): User | null {
  return USERS.find((user) => user.email === email.trim().toLowerCase()) ?? null
}

export function findUserBySession(token: string | undefined): User | null {
  if (!token) return null
  const userId = storeState().sessions.get(token)
  return USERS.find((user) => user.id === userId) ?? null
}

export function createSession(user: User): string {
  const token = crypto.randomUUID()
  storeState().sessions.set(token, user.id)
  return token
}

export function endSession(token: string | undefined): void {
  if (token) storeState().sessions.delete(token)
}

export type OrderFilter = OrderStatus | 'all'

const PER_ROW_LATENCY_MS = 60

export async function listOrders(userId: string, filter: OrderFilter): Promise<Order[]> {
  const user = USERS.find((candidate) => candidate.id === userId)
  if (!user) return []
  const orders = [
    ...storeState().placedOrders.filter((order) => order.userId === userId),
    ...seedOrders(user),
  ]
  const matching = filter === 'all' ? orders : orders.filter((order) => order.status === filter)
  await simulate('orders.list', 100 + matching.length * PER_ROW_LATENCY_MS)
  return matching
}

export async function getAccountProfile(userId: string) {
  await simulate('account.profile')
  const user = USERS.find((candidate) => candidate.id === userId)
  if (!user) return null
  const orders = await listOrders(userId, 'all')
  return {
    user,
    orderCount: orders.length,
    lifetimeCents: orders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + order.totalCents, 0),
  }
}
