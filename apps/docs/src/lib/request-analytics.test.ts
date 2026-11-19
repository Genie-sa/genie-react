import { describe, expect, it } from 'vitest'
import {
  type AnalyticsDataset,
  classifyClient,
  recordRequest,
  referrerSource,
} from './request-analytics'

describe('classifyClient', () => {
  it.each([
    [
      'Claude-User (claude-code/2.1.83; +https://support.anthropic.com/)',
      'claude-code',
      'coding-agent',
    ],
    [
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0',
      'ChatGPT-User',
      'ai-assistant',
    ],
    [
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0)',
      'OAI-SearchBot',
      'ai-search',
    ],
    [
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)',
      'GPTBot',
      'ai-training',
    ],
    ['Mozilla/5.0 (compatible; Claude-SearchBot/1.0)', 'Claude-SearchBot', 'ai-search'],
    [
      'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
      'ClaudeBot',
      'ai-training',
    ],
    [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Googlebot',
      'search-engine',
    ],
    ['curl/8.7.1', 'curl', 'tool'],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0 Safari/537.36',
      'browser',
      'browser',
    ],
  ])('classifies %s', (userAgent, name, kind) => {
    expect(classifyClient(userAgent)).toEqual({ name, kind })
  })

  it('reports a missing or unrecognized user agent as unknown', () => {
    expect(classifyClient(null)).toEqual({ name: 'unknown', kind: 'unknown' })
    expect(classifyClient('SomeCrawler/1.0')).toEqual({ name: 'unknown', kind: 'unknown' })
  })
})

describe('referrerSource', () => {
  it('keeps only the referring host', () => {
    const request = new Request('https://genie-react.com/docs', {
      headers: { Referer: 'https://chatgpt.com/c/abc123?model=x' },
    })
    expect(referrerSource(request)).toBe('chatgpt.com')
  })

  it('falls back to utm_source when the referrer was stripped', () => {
    expect(referrerSource(new Request('https://genie-react.com/docs?utm_source=chatgpt.com'))).toBe(
      'chatgpt.com',
    )
  })

  it('is empty for a direct visit', () => {
    expect(referrerSource(new Request('https://genie-react.com/docs'))).toBe('')
  })
})

describe('recordRequest', () => {
  it('writes the path without its query, the client, the source, the format and the status', () => {
    const points: Parameters<AnalyticsDataset['writeDataPoint']>[0][] = []
    const request = new Request('https://genie-react.com/api/search?query=secret', {
      headers: { 'User-Agent': 'curl/8.7.1', Referer: 'https://perplexity.ai/search/x' },
    })
    const response = new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })

    recordRequest({ writeDataPoint: (point) => points.push(point) }, request, response)

    expect(points).toEqual([
      {
        indexes: ['tool'],
        blobs: ['/api/search', 'tool', 'curl', 'perplexity.ai', 'application/json', 'GET'],
        doubles: [200],
      },
    ])
  })
})
