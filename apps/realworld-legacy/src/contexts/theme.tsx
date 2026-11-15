import {
  type ComponentType,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type ThemeName = 'light' | 'dark'

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const STORAGE_KEY = 'acme.theme'

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', setTheme: () => undefined })

function storedTheme(): ThemeName {
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(storedTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

export interface WithThemeProps {
  theme: ThemeContextValue
}

export function withTheme<P extends WithThemeProps>(Wrapped: ComponentType<P>) {
  function WithTheme(props: Omit<P, keyof WithThemeProps>) {
    const theme = useTheme()
    return <Wrapped {...(props as P)} theme={theme} />
  }
  WithTheme.displayName = `withTheme(${Wrapped.displayName ?? Wrapped.name})`
  return WithTheme
}
