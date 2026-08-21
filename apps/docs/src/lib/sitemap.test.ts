import { describe, expect, it } from 'vitest'
import { buildSitemapXml } from './sitemap'

describe('buildSitemapXml', () => {
  it('builds a urlset with loc and lastmod entries', () => {
    const xml = buildSitemapXml([
      { url: 'https://genie-react.com/' },
      { url: 'https://genie-react.com/docs', lastModified: new Date('2026-08-01T12:00:00Z') },
    ])

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<url><loc>https://genie-react.com/</loc></url>')
    expect(xml).toContain(
      '<url><loc>https://genie-react.com/docs</loc><lastmod>2026-08-01</lastmod></url>',
    )
  })

  it('escapes XML special characters in URLs', () => {
    const xml = buildSitemapXml([{ url: 'https://genie-react.com/docs?a=1&b=2' }])
    expect(xml).toContain('https://genie-react.com/docs?a=1&amp;b=2')
    expect(xml).not.toContain('a=1&b')
  })
})
