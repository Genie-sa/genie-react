import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { PreferencesProvider } from '../app/preferences'
import { CommandPalette } from './command-palette'
import { SidebarNav } from './sidebar-nav'
import { TopBar } from './top-bar'

const COLLAPSED_KEY = 'meridian.sidebar-collapsed'

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(COLLAPSED_KEY) === 'true',
  )
  const [paletteOpen, setPaletteOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setCollapsed((current) => {
      window.localStorage.setItem(COLLAPSED_KEY, String(!current))
      return !current
    })
  }, [])
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <PreferencesProvider>
      <div className="flex h-screen overflow-hidden">
        <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenSearch={openPalette} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      {paletteOpen && <CommandPalette onClose={closePalette} />}
    </PreferencesProvider>
  )
}
