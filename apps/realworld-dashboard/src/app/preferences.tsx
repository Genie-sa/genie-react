import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { createFormatters, type Formatters, LOCALES, type Locale } from '../lib/format'

export type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'meridian.theme'
const LOCALE_KEY = 'meridian.locale'

export interface PreferencesContextValue extends Formatters {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  locale: Locale
  setTheme: (theme: Theme) => void
  setLocale: (locale: Locale) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

function readTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'light'
}

function readLocale(): Locale {
  const stored = window.localStorage.getItem(LOCALE_KEY)
  return LOCALES.some((entry) => entry.id === stored) ? (stored as Locale) : 'en-US'
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [locale, setLocaleState] = useState<Locale>(readLocale)
  const resolvedTheme = theme === 'system' ? systemTheme() : theme
  const formatters = useMemo(() => createFormatters(locale), [locale])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.lang = locale
  }, [resolvedTheme, locale])

  const setTheme = (next: Theme) => {
    window.localStorage.setItem(THEME_KEY, next)
    setThemeState(next)
  }
  const setLocale = (next: Locale) => {
    window.localStorage.setItem(LOCALE_KEY, next)
    setLocaleState(next)
  }

  const value: PreferencesContextValue = {
    ...formatters,
    theme,
    resolvedTheme,
    locale,
    setTheme,
    setLocale,
  }
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider')
  return value
}
