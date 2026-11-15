import { type NextRequest, NextResponse } from 'next/server'
import { CART_COOKIE } from './lib/cookie-names'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export function proxy(request: NextRequest): NextResponse {
  if (request.cookies.has(CART_COOKIE)) return NextResponse.next()
  const cartId = crypto.randomUUID()
  request.cookies.set(CART_COOKIE, cartId)
  const response = NextResponse.next({ request: { headers: request.headers } })
  response.cookies.set(CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return response
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico).*)'],
}
