import { createFileRoute } from '@tanstack/react-router'
import { markdownResponse } from '@/lib/agent-responses'
import { buildLlmsText, type LlmsPageEntry, sectionLabelFromSlug } from '@/lib/llms'
import { slugsToMarkdownPath, source } from '@/lib/source'

function llmsPages(): LlmsPageEntry[] {
  return source.getPages().map((page) => ({
    title: page.data.title,
    description: page.data.description,
    markdownUrl: slugsToMarkdownPath(page.slugs).url,
    section: page.slugs.length > 1 ? sectionLabelFromSlug(page.slugs[0]) : 'Overview',
  }))
}

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () => markdownResponse(buildLlmsText(llmsPages())),
    },
  },
})
