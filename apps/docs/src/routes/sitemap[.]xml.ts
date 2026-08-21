import { createFileRoute } from '@tanstack/react-router'
import { siteUrl } from '@/lib/shared'
import { sitePages } from '@/lib/site-pages'
import { buildSitemapXml, type SitemapEntry } from '@/lib/sitemap'
import { source } from '@/lib/source'

function sitemapEntries(): SitemapEntry[] {
  const staticEntries: SitemapEntry[] = [
    { url: `${siteUrl}/` },
    ...sitePages.map((page) => ({ url: `${siteUrl}${page.path}` })),
  ]
  const docsEntries = source.getPages().map(
    (page): SitemapEntry => ({
      url: `${siteUrl}${page.url}`,
      lastModified: page.data.lastModified,
    }),
  )
  return [...staticEntries, ...docsEntries]
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(buildSitemapXml(sitemapEntries()), {
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        }),
    },
  },
})
