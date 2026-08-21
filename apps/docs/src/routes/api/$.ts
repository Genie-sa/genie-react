import { createFileRoute } from '@tanstack/react-router'
import { jsonErrorResponse } from '@/lib/agent-responses'

function unknownEndpoint({ request }: { request: Request }): Response {
  return jsonErrorResponse(404, {
    code: 'not_found',
    message: `No API endpoint exists at ${new URL(request.url).pathname}.`,
    hint: 'The available endpoints are described at /openapi.json; docs search is GET /api/search?query=…',
  })
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: unknownEndpoint,
      POST: unknownEndpoint,
      PUT: unknownEndpoint,
      PATCH: unknownEndpoint,
      DELETE: unknownEndpoint,
    },
  },
})
