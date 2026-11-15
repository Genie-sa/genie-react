'use client'

import { type ReactNode, useEffect, useState } from 'react'

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

export function DealCountdown({ endsAt }: { endsAt: string }): ReactNode {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <p className="countdown" aria-live="off">
      Ends in{' '}
      <time dateTime={endsAt}>
        {now === null ? '--:--:--' : formatRemaining(Date.parse(endsAt) - now)}
      </time>
    </p>
  )
}
