import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

export type Density = 'compact' | 'comfortable'

interface Preferences {
  density: Density
  setDensity: (density: Density) => void
}

const PreferencesContext = createContext<Preferences | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<Density>('comfortable')
  const [syncedSecondsAgo, setSyncedSecondsAgo] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSyncedSecondsAgo((seconds) => seconds + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <PreferencesContext.Provider value={{ density, setDensity }}>
      <p>Preferences synced {syncedSecondsAgo}s ago</p>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): Preferences {
  const preferences = useContext(PreferencesContext)
  if (!preferences) throw new Error('usePreferences must be used inside PreferencesProvider')
  return preferences
}
