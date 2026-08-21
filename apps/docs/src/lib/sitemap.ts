export interface SitemapEntry {
  url: string
  lastModified?: Date
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function buildSitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastModified
        ? `<lastmod>${entry.lastModified.toISOString().slice(0, 10)}</lastmod>`
        : ''
      return `  <url><loc>${escapeXml(entry.url)}</loc>${lastmod}</url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}
