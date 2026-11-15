'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

export function HeaderSearch(): ReactNode {
  const router = useRouter()
  return (
    <search className="header-search">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const term = new FormData(event.currentTarget).get('q')
          router.push(`/search?q=${encodeURIComponent(String(term ?? ''))}`)
        }}
      >
        <input name="q" type="search" placeholder="Search products" aria-label="Search products" />
      </form>
    </search>
  )
}
