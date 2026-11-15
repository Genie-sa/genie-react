'use client'

import type { ReactNode } from 'react'

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): ReactNode {
  return (
    <div className="empty-state" role="alert">
      <h2>This page did not load</h2>
      <p>
        {error.digest ? `Reference ${error.digest}. ` : null}Try again, or come back in a minute.
      </p>
      <button type="button" className="button" onClick={reset}>
        Try again
      </button>
    </div>
  )
}
