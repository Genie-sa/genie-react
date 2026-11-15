import { useRouter } from '@tanstack/react-router'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../app/auth'
import { usePreferences } from '../app/preferences'
import { Avatar } from '../components/ui/avatar'
import { LOCALES, type Locale } from '../lib/format'

export function UserMenu() {
  const { session, logout } = useAuth()
  const { resolvedTheme, setTheme, locale, setLocale } = usePreferences()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!session) return null
  const signOut = () => {
    logout()
    void router.navigate({ to: '/login' })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Avatar name={session.user.name} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-medium">{session.user.name}</p>
          <p className="text-xs text-slate-500">
            {session.user.title} · {session.user.role}
          </p>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}
            </button>
            <label className="flex items-center justify-between gap-2 px-2 text-sm">
              Language
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="rounded border border-slate-200 bg-transparent px-1 py-0.5 text-sm dark:border-slate-700"
              >
                {LOCALES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
