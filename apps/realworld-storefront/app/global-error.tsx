'use client'

import type { ReactNode } from 'react'

export default function GlobalError({ reset }: { error: Error; reset: () => void }): ReactNode {
  return (
    <html lang="en">
      <body>
        <main className="page">
          <h1>Something went wrong</h1>
          <p>We could not load the shop. Try again in a moment.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
