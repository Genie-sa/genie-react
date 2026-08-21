import { describe, expect, it } from 'vitest'
import { homeMarkdown, sitePageMarkdown, sitePages } from './site-pages'

describe('sitePages', () => {
  it('covers the three trust anchor paths', () => {
    expect(sitePages.map((page) => page.path)).toEqual(['/about', '/contact', '/privacy'])
  })

  it.each(
    sitePages.map((page) => [page.path, page]),
  )('%s has at least 500 characters of content', (_path, page) => {
    const body = page.sections
      .flatMap((section) => [section.heading, ...section.paragraphs])
      .join(' ')
    expect(body.length).toBeGreaterThanOrEqual(500)
  })
})

describe('sitePageMarkdown', () => {
  it('renders title, description, and every section', () => {
    const page = sitePages[0]
    if (!page) throw new Error('expected at least one site page')

    const markdown = sitePageMarkdown(page)
    expect(markdown).toContain(`# ${page.title}`)
    expect(markdown).toContain(`> ${page.description}`)
    for (const section of page.sections) {
      expect(markdown).toContain(`## ${section.heading}`)
    }
  })
})

describe('homeMarkdown', () => {
  it('summarizes the product and links the discovery resources', () => {
    const markdown = homeMarkdown()
    expect(markdown.startsWith('# Genie React')).toBe(true)
    for (const path of ['/docs', '/llms.txt', '/llms-full.txt', '/openapi.json', '/sitemap.xml']) {
      expect(markdown).toContain(`https://genie-react.com${path}`)
    }
  })
})
