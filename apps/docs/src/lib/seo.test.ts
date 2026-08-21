import { describe, expect, it } from 'vitest'
import { homeStructuredData, pageHead } from './seo'

describe('pageHead', () => {
  it('emits title, description, open graph tags, and a canonical link', () => {
    const head = pageHead({
      title: 'Install — Genie React',
      description: 'Add Genie to the app.',
      path: '/docs/getting-started/install',
    })

    expect(head.meta).toContainEqual({ title: 'Install — Genie React' })
    expect(head.meta).toContainEqual({ name: 'description', content: 'Add Genie to the app.' })
    expect(head.meta).toContainEqual({
      property: 'og:url',
      content: 'https://genie-react.com/docs/getting-started/install',
    })
    expect(head.links).toEqual([
      { rel: 'canonical', href: 'https://genie-react.com/docs/getting-started/install' },
    ])
  })

  it('canonicalizes the homepage without a trailing slash', () => {
    expect(pageHead({ title: 't', description: 'd', path: '/' }).links).toEqual([
      { rel: 'canonical', href: 'https://genie-react.com' },
    ])
  })
})

describe('homeStructuredData', () => {
  const graph = (
    JSON.parse(homeStructuredData()) as {
      '@graph': Array<Record<string, unknown>>
    }
  )['@graph']

  it('is valid JSON-LD with SoftwareApplication, Organization, and WebSite nodes', () => {
    expect(graph.map((node) => node['@type'])).toEqual([
      'SoftwareApplication',
      'Organization',
      'WebSite',
    ])
  })

  it('describes the product with name, description, url, and offer', () => {
    const app = graph[0]
    expect(app).toMatchObject({
      name: 'Genie React',
      url: 'https://genie-react.com',
      applicationCategory: 'DeveloperApplication',
    })
    expect(app?.description).toBeTruthy()
    expect(app?.offers).toMatchObject({ '@type': 'Offer', price: '0' })
  })

  it('links the organization with a contact point', () => {
    const organization = graph[1]
    expect(organization?.contactPoint).toMatchObject({ '@type': 'ContactPoint' })
    expect(organization?.sameAs).toContain('https://github.com/Genie-sa')
  })
})
