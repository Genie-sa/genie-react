'use server'

import { cookies } from 'next/headers'
import { LOCALE_COOKIE } from '../cookie-names'
import { type Locale, resolveLocale } from '../locale'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function saveLocale(locale: Locale): Promise<void> {
  ;(await cookies()).set(LOCALE_COOKIE, resolveLocale(locale), {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  })
}
