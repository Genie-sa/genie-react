import { describe, expect, it } from 'vitest'
import {
  acceptedQuality,
  negotiatePageRepresentation,
  parseAcceptHeader,
  prefersHtmlStrictly,
} from './content-negotiation'

describe('parseAcceptHeader', () => {
  it('parses media ranges with default quality 1', () => {
    expect(parseAcceptHeader('text/html, text/markdown')).toEqual([
      { type: 'text', subtype: 'html', quality: 1 },
      { type: 'text', subtype: 'markdown', quality: 1 },
    ])
  })

  it('parses q-values and clamps them to [0, 1]', () => {
    expect(parseAcceptHeader('text/html;q=0.8, text/markdown;q=2')).toEqual([
      { type: 'text', subtype: 'html', quality: 0.8 },
      { type: 'text', subtype: 'markdown', quality: 1 },
    ])
  })

  it('treats an unparsable q-value as 0', () => {
    expect(parseAcceptHeader('text/html;q=abc')).toEqual([
      { type: 'text', subtype: 'html', quality: 0 },
    ])
  })

  it('skips malformed ranges', () => {
    expect(parseAcceptHeader('nonsense, text/html')).toEqual([
      { type: 'text', subtype: 'html', quality: 1 },
    ])
  })
})

describe('acceptedQuality', () => {
  it('returns 1 for a missing or empty header', () => {
    expect(acceptedQuality(null, 'text/html')).toBe(1)
    expect(acceptedQuality('', 'text/markdown')).toBe(1)
  })

  it('prefers the most specific matching range', () => {
    const header = '*/*;q=0.1, text/*;q=0.5, text/markdown;q=0.9'
    expect(acceptedQuality(header, 'text/markdown')).toBe(0.9)
    expect(acceptedQuality(header, 'text/html')).toBe(0.5)
    expect(acceptedQuality(header, 'application/json')).toBe(0.1)
  })

  it('returns 0 when nothing matches', () => {
    expect(acceptedQuality('application/json', 'text/html')).toBe(0)
  })
})

describe('negotiatePageRepresentation', () => {
  it('serves html to browsers', () => {
    const chrome = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    expect(negotiatePageRepresentation(chrome)).toBe('html')
  })

  it('serves markdown when the client prefers it', () => {
    expect(negotiatePageRepresentation('text/markdown')).toBe('markdown')
    expect(negotiatePageRepresentation('text/markdown;q=1, text/html;q=0.5')).toBe('markdown')
  })

  it('breaks ties in favor of html', () => {
    expect(negotiatePageRepresentation('*/*')).toBe('html')
    expect(negotiatePageRepresentation(null)).toBe('html')
    expect(negotiatePageRepresentation('text/html, text/markdown')).toBe('html')
  })

  it('returns null when neither representation is acceptable', () => {
    expect(negotiatePageRepresentation('application/json')).toBeNull()
    expect(negotiatePageRepresentation('text/html;q=0, text/markdown;q=0')).toBeNull()
  })
})

describe('prefersHtmlStrictly', () => {
  it('is true for browser Accept headers', () => {
    expect(prefersHtmlStrictly('text/html,application/xhtml+xml,*/*;q=0.8')).toBe(true)
  })

  it('is false for wildcard and markdown clients', () => {
    expect(prefersHtmlStrictly('*/*')).toBe(false)
    expect(prefersHtmlStrictly(null)).toBe(false)
    expect(prefersHtmlStrictly('text/markdown')).toBe(false)
  })
})
