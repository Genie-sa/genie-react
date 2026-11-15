import { readStringList } from './local-storage'

const STORAGE_KEY = 'sf-recently-viewed'
const LIMIT = 8

export function readRecentlyViewed(): string[] {
  return readStringList(STORAGE_KEY)
}

export function recordRecentlyViewed(productId: string): void {
  const next = [productId, ...readRecentlyViewed().filter((id) => id !== productId)].slice(0, LIMIT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearRecentlyViewed(): void {
  localStorage.removeItem(STORAGE_KEY)
}
