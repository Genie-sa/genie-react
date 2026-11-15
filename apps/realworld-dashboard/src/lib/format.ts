export type Locale = 'en-US' | 'de-DE' | 'ja-JP'

export const LOCALES: readonly { id: Locale; label: string; currency: string }[] = [
  { id: 'en-US', label: 'English (US)', currency: 'USD' },
  { id: 'de-DE', label: 'Deutsch', currency: 'EUR' },
  { id: 'ja-JP', label: '日本語', currency: 'JPY' },
]

export interface Formatters {
  formatMoney: (value: number) => string
  formatCompactMoney: (value: number) => string
  formatNumber: (value: number) => string
  formatPercent: (value: number) => string
  formatDate: (value: string | number) => string
  formatDateTime: (value: string | number) => string
  formatRelative: (value: string | number, now?: number) => string
}

const RELATIVE_STEPS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
]

export function createFormatters(locale: Locale): Formatters {
  const currency = LOCALES.find((entry) => entry.id === locale)?.currency ?? 'USD'
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency })
  const compactMoney = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  })
  const number = new Intl.NumberFormat(locale)
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  return {
    formatMoney: (value) => money.format(value),
    formatCompactMoney: (value) => compactMoney.format(value),
    formatNumber: (value) => number.format(value),
    formatPercent: (value) => percent.format(value / 100),
    formatDate: (value) => date.format(new Date(value)),
    formatDateTime: (value) => dateTime.format(new Date(value)),
    formatRelative: (value, now = Date.now()) => {
      let delta = (new Date(value).getTime() - now) / 1000
      for (const [unit, size] of RELATIVE_STEPS) {
        if (Math.abs(delta) < size) return relative.format(Math.round(delta), unit)
        delta /= size
      }
      return relative.format(Math.round(delta), 'year')
    },
  }
}
