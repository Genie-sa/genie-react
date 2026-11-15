import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '../../../lib/cookie-names'
import { findUserBySession, listOrders, type OrderFilter } from '../../../lib/data/accounts'

const FILTERS: readonly OrderFilter[] = ['all', 'processing', 'shipped', 'delivered', 'cancelled']

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = findUserBySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Sign in to see orders' }, { status: 401 })
  const requested = request.nextUrl.searchParams.get('status')
  const filter = FILTERS.find((candidate) => candidate === requested) ?? 'all'
  return NextResponse.json({ status: filter, orders: await listOrders(user.id, filter) })
}
