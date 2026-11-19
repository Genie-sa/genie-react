// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { defaultAppCollectors } from './index'

const toolNames = (collectors: ReturnType<typeof defaultAppCollectors>) =>
  collectors.flatMap((collector) => (collector.tools ?? []).map((tool) => tool.contract.name))

describe('defaultAppCollectors from genie-react/collectors', () => {
  it('gives a hand-built client the request watch and visibility tools verify depends on', () => {
    expect(toolNames(defaultAppCollectors())).toEqual(
      expect.arrayContaining(['request_watch_start', 'request_watch_read', 'browser_visibility']),
    )
  })

  it('adds the query tools when given a QueryClient', () => {
    expect(toolNames(defaultAppCollectors({ queryClient: new QueryClient() }))).toContain(
      'query_is_fetching',
    )
  })
})
