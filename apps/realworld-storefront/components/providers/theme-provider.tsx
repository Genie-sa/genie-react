'use client'

import { createContext, type ReactNode, use, useCallback, useState } from 'react'
import { THEME_STORAGE_KEY, type Theme } from '../../lib/theme'

interface ThemeContextValue {
  theme: Theme | null
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function documentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const [theme, setTheme] = useState<Theme | null>(null)

  const toggleTheme = useCallback(() => {
    const next: Theme = documentTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem(THEME_STORAGE_KEY, next)
    setTheme(next)
  }, [])

  return <ThemeContext value={{ theme, toggleTheme }}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
