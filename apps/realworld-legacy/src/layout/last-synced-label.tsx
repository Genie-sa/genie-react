import { useEffect, useState } from 'react'
import { useAppSelector } from '../store/hooks'

const TICK_MS = 1000

export function LastSyncedLabel() {
  const lastFetchedAt = useAppSelector((state) => state.notifications.lastFetchedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  if (lastFetchedAt === null) return <span className="last-synced">Not synced yet</span>
  const seconds = Math.max(0, Math.round((now - lastFetchedAt) / 1000))
  return <span className="last-synced">Synced {seconds}s ago</span>
}
