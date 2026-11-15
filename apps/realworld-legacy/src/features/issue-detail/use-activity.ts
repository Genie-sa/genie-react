import { useEffect, useState } from 'react'
import { request, toQueryString } from '../../api/http'
import type { ActivityEvent } from '../../api/types'

interface ActivityState {
  events: ActivityEvent[]
  status: 'loading' | 'ready' | 'failed'
}

export function useActivity(issueKey: string, types: string[]): ActivityState {
  const [state, setState] = useState<ActivityState>({ events: [], status: 'loading' })

  useEffect(() => {
    let cancelled = false
    request<ActivityEvent[]>(
      `/api/issues/${issueKey}/activity${toQueryString({ types: types.join(',') })}`,
    )
      .then((events) => {
        if (!cancelled) setState({ events, status: 'ready' })
      })
      .catch(() => {
        if (!cancelled) setState((previous) => ({ ...previous, status: 'failed' }))
      })
    return () => {
      cancelled = true
    }
  }, [issueKey, types])

  return state
}
