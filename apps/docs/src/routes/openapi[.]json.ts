import { createFileRoute } from '@tanstack/react-router'
import { buildOpenApiDocument } from '@/lib/openapi'

export const Route = createFileRoute('/openapi.json')({
  server: {
    handlers: {
      GET: () => Response.json(buildOpenApiDocument()),
    },
  },
})
