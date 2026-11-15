const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const REFERENCE_NOW = Date.parse('2026-03-02T09:00:00.000Z')

export function formatRelative(iso: string, now = REFERENCE_NOW): string {
  const delta = Date.parse(iso) - now
  for (const [unit, size] of UNITS) {
    if (Math.abs(delta) >= size) return formatter.format(Math.round(delta / size), unit)
  }
  return 'just now'
}

export function RelativeTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString('en-GB', { timeZone: 'UTC' })}>
      {formatRelative(iso)}
    </time>
  )
}
