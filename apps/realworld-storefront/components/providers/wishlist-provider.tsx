'use client'

import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { readStringList } from '../../lib/local-storage'

const STORAGE_KEY = 'sf-wishlist'
const NO_IDS: string[] = []

interface WishlistContextValue {
  ids: readonly string[]
  count: number
  has: (productId: string) => boolean
  toggle: (productId: string) => void
  clear: () => void
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

function readStoredIds(): string[] {
  const ids = readStringList(STORAGE_KEY)
  return ids.length === 0 ? NO_IDS : ids
}

export function WishlistProvider({ children }: { children: ReactNode }): ReactNode {
  const [ids, setIds] = useState<string[]>(NO_IDS)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    setIds(readStoredIds())
    setRestored(true)
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setIds(readStoredIds())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (restored) localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }, [ids, restored])

  const toggle = useCallback((productId: string) => {
    setIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    )
  }, [])

  const clear = useCallback(() => setIds(NO_IDS), [])

  const value = useMemo<WishlistContextValue>(
    () => ({ ids, count: ids.length, has: (productId) => ids.includes(productId), toggle, clear }),
    [ids, toggle, clear],
  )

  return <WishlistContext value={value}>{children}</WishlistContext>
}

export function useWishlist(): WishlistContextValue {
  const value = use(WishlistContext)
  if (!value) throw new Error('useWishlist must be used inside WishlistProvider')
  return value
}
