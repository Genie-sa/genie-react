export const LOCALES = ['en-US', 'en-GB', 'de-DE'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en-US'

const CURRENCIES: Record<Locale, string> = { 'en-US': 'USD', 'en-GB': 'GBP', 'de-DE': 'EUR' }

export const LOCALE_LABELS: Record<Locale, string> = {
  'en-US': 'United States (USD)',
  'en-GB': 'United Kingdom (GBP)',
  'de-DE': 'Deutschland (EUR)',
}

export function resolveLocale(value: string | undefined): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE
}

export function currencyFor(locale: Locale): string {
  return CURRENCIES[locale]
}

export function createPriceFormatter(locale: Locale): (cents: number) => string {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyFor(locale) })
  return (cents) => format.format(cents / 100)
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(iso),
  )
}
