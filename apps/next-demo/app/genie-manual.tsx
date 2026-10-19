'use client'

import { useEffect } from 'react'
import { queryClient } from './query-demo/query-client'

// Dynamic imports keep the collector and its tool catalog out of production bundles; a static import ships them even behind the guard.
export function GenieQueryTools() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    let unregister: (() => void) | undefined
    let cancelled = false
    void Promise.all([import('genie-react/collectors/query'), import('genie-react/protocol')]).then(
      ([{ queryCollector }, { registerGenieCollector }]) => {
        if (!cancelled) unregister = registerGenieCollector(queryCollector(queryClient))
      },
    )
    return () => {
      cancelled = true
      unregister?.()
    }
  }, [])

  return null
}
