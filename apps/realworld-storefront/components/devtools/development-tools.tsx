'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

const StoreDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('./store-devtools').then((module) => module.StoreDevtools), {
        ssr: false,
      })
    : null

export function DevelopmentTools(): ReactNode {
  return StoreDevtools ? <StoreDevtools /> : null
}
