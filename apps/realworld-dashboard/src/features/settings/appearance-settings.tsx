import { type Theme, usePreferences } from '../../app/preferences'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { cn } from '../../lib/cn'
import { LOCALES } from '../../lib/format'

const THEMES: readonly { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Match system' },
]

export function AppearanceSettings() {
  const { theme, setTheme, locale, setLocale, formatMoney, formatDateTime } = usePreferences()
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Theme" />
        <CardBody>
          <div role="radiogroup" aria-label="Theme" className="flex gap-2">
            {THEMES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={theme === option.id}
                onClick={() => setTheme(option.id)}
                className={cn(
                  'rounded-md border px-4 py-2 text-sm',
                  theme === option.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Language and region"
          description={`Preview: ${formatMoney(1234.5)} · ${formatDateTime(Date.UTC(2026, 2, 2, 9))}`}
        />
        <CardBody>
          <div role="radiogroup" aria-label="Language" className="flex gap-2">
            {LOCALES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={locale === option.id}
                onClick={() => setLocale(option.id)}
                className={cn(
                  'rounded-md border px-4 py-2 text-sm',
                  locale === option.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
