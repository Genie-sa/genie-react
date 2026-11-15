import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { onUnauthorized, setAuthToken } from '../api/client'
import { api } from '../api/endpoints'
import type { Session } from '../api/types'

const STORAGE_KEY = 'meridian.session'

export interface AuthContextValue {
  session: Session | null
  login: (email: string, password: string) => Promise<Session>
  adoptSession: (session: Session) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredSession(): Session | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Session
    setAuthToken(session.token)
    return session
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession)

  const adoptSession = useCallback((next: Session) => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setAuthToken(next.token)
    setSession(next)
  }, [])

  const logout = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY)
    setAuthToken(null)
    setSession(null)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const next = await api.login(email, password)
      adoptSession(next)
      return next
    },
    [adoptSession],
  )

  useEffect(() => onUnauthorized(logout), [logout])

  const value = useMemo(
    () => ({ session, login, adoptSession, logout }),
    [session, login, adoptSession, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
