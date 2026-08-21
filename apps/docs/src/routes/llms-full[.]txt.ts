import { createFileRoute } from '@tanstack/react-router'
import { markdownResponse } from '@/lib/agent-responses'
import { getLLMText, source } from '@/lib/source'

export const Route = createFileRoute('/llms-full.txt')({
  server: {
    handlers: {
      GET: async () => {
        const pages = await Promise.all(source.getPages().map(getLLMText))
        return markdownResponse(pages.join('\n\n'))
      },
    },
  },
})
