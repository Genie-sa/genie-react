'use client'

import { useEffect } from 'react'
import { getQueryClient } from '../../lib/query-client'

export function GenieQueryTools(): null {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    let unregister: (() => void) | undefined
    let cancelled = false
    void Promise.all([import('genie-react/collectors/query'), import('genie-react/protocol')]).then(
      ([{ queryCollector }, { registerGenieCollector }]) => {
        // In this workspace genie-react links its own query-core devDependency, so the two QueryClient declarations differ only by their #private brand.
        const client = getQueryClient() as unknown as Parameters<typeof queryCollector>[0]
        if (!cancelled) unregister = registerGenieCollector(queryCollector(client))
      },
    )
    return () => {
      cancelled = true
      unregister?.()
    }
  }, [])

  return null
}
