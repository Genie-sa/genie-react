import { describe, expect, it } from 'vitest'
import { isMachinePath, normalizePathname } from './paths'

describe('normalizePathname', () => {
  it('strips trailing slashes but keeps the root', () => {
    expect(normalizePathname('/docs/')).toBe('/docs')
    expect(normalizePathname('/docs//')).toBe('/docs')
    expect(normalizePathname('/')).toBe('/')
    expect(normalizePathname('/about')).toBe('/about')
  })
})

describe('isMachinePath', () => {
  it('matches discovery endpoints, API paths, and markdown variants', () => {
    for (const path of [
      '/llms.txt',
      '/llms-full.txt',
      '/sitemap.xml',
      '/openapi.json',
      '/robots.txt',
      '/api/search',
      '/api/anything/else',
      '/docs/getting-started/install.md',
    ]) {
      expect(isMachinePath(path), path).toBe(true)
    }
  })

  it('does not match negotiable page paths', () => {
    for (const path of ['/', '/docs', '/docs/getting-started', '/about', '/privacy']) {
      expect(isMachinePath(path), path).toBe(false)
    }
  })
})
