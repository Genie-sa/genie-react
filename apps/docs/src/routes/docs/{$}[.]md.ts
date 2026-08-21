import { createFileRoute } from '@tanstack/react-router'
import { markdownResponse, notFoundMarkdownResponse } from '@/lib/agent-responses'
import { getLLMText, markdownPathToSlugs, source } from '@/lib/source'

export const Route = createFileRoute('/docs/{$}.md')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slugs = markdownPathToSlugs(params._splat?.split('/') ?? [])
        const page = source.getPage(slugs)
        if (!page) return notFoundMarkdownResponse(new URL(request.url).pathname)

        return markdownResponse(await getLLMText(page))
      },
    },
  },
})
