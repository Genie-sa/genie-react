'use client'

import 'genie-react/hook'
import { createGenieClient, reactCollector, sessionCollector } from 'genie-react/client'
import { memoryCollector, queryCollector } from 'genie-react/collectors'
import { useEffect } from 'react'
import { queryClient } from './query-demo/query-client'

const HUB_URL = 'ws://localhost:4391/__genie/ws'

let started = false

export function GenieManual(): null {
  useEffect(() => {
    if (started || process.env.NODE_ENV === 'production') return
    started = true
    createGenieClient({
      url: HUB_URL,
      collectors: [
        sessionCollector(),
        reactCollector(),
        memoryCollector(),
        queryCollector(queryClient),
      ],
    }).start()
  }, [])
  return null
}
