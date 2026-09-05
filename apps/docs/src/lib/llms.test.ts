import { describe, expect, it } from 'vitest'
import { buildLlmsText, sectionLabelFromSlug } from './llms'

describe('sectionLabelFromSlug', () => {
  it('turns a slug into a readable label', () => {
    expect(sectionLabelFromSlug('getting-started')).toBe('Getting started')
    expect(sectionLabelFromSlug('tools')).toBe('Tools')
  })

  it('falls back to Overview without a slug', () => {
    expect(sectionLabelFromSlug(undefined)).toBe('Overview')
  })
})

describe('buildLlmsText', () => {
  const text = buildLlmsText([
    {
      title: 'Install',
      description: 'Add Genie to the app.',
      markdownUrl: '/docs/getting-started/install.md',
      section: 'Getting started',
    },
    {
      title: 'Genie React',
      markdownUrl: '/docs/index.md',
      section: 'Overview',
    },
  ])

  it('starts with an H1 and a blockquote summary, per llms.txt format', () => {
    const [first, , third] = text.split('\n')
    expect(first).toBe('# Genie React')
    expect(third).toMatch(/^> /)
  })

  it('tells agents when to use the product', () => {
    expect(text).toContain('## When to use Genie React')
    expect(text).toContain('Use a local development build.')
    expect(text).toContain('npx @genie-react/cli')
    expect(text).not.toContain('npx genie-react')
  })

  it('links machine-readable resources', () => {
    for (const path of ['/llms-full.txt', '/openapi.json', '/sitemap.xml']) {
      expect(text).toContain(`https://genie-react.com${path}`)
    }
  })

  it('links section indexes at their published markdown routes', () => {
    expect(text).toContain('[Getting started](https://genie-react.com/docs/getting-started.md)')
    expect(text).toContain('[Tools](https://genie-react.com/docs/tools.md)')
  })

  it('groups pages into sections with absolute markdown links', () => {
    expect(text).toContain('## Getting started')
    expect(text).toContain(
      '- [Install](https://genie-react.com/docs/getting-started/install.md): Add Genie to the app.',
    )
    expect(text).toContain('- [Genie React](https://genie-react.com/docs/index.md)')
  })
})
