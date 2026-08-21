import { createFileRoute } from '@tanstack/react-router'
import { createFromSource } from 'fumadocs-core/search/server'
import { jsonErrorResponse } from '@/lib/agent-responses'
import { source } from '@/lib/source'

const server = createFromSource(source, {
  language: 'english',
})

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await server.GET(request)
        } catch (error) {
          return jsonErrorResponse(500, {
            code: 'search_failed',
            message: error instanceof Error ? error.message : 'Search failed unexpectedly.',
            hint: 'Retry with a simpler ?query= value, or browse /llms.txt for a full page index.',
          })
        }
      },
    },
  },
})
