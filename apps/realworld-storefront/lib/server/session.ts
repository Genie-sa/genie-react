import { cookies } from 'next/headers'
import { CART_COOKIE, LOCALE_COOKIE, SESSION_COOKIE } from '../cookie-names'
import { findUserBySession } from '../data/accounts'
import type { User } from '../data/types'
import { type Locale, resolveLocale } from '../locale'

export async function currentCartId(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null
}

export async function requireCartId(): Promise<string> {
  const cartId = await currentCartId()
  if (!cartId) throw new Error('The request has no cart cookie; the proxy assigns one per visitor')
  return cartId
}

export async function currentUser(): Promise<User | null> {
  return findUserBySession((await cookies()).get(SESSION_COOKIE)?.value)
}

export async function currentLocale(): Promise<Locale> {
  return resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value)
}
