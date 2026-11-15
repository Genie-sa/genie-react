'use client'

import type { ReactNode } from 'react'
import { useTheme } from '../providers/theme-provider'

export function ThemeToggle(): ReactNode {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label="Toggle colour theme"
      aria-pressed={theme === null ? undefined : theme === 'dark'}
      onClick={toggleTheme}
    >
      <span className="theme-icon-dark" aria-hidden="true">
        ☾
      </span>
      <span className="theme-icon-light" aria-hidden="true">
        ☀
      </span>
    </button>
  )
}
