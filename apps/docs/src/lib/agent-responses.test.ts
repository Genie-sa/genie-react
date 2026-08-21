import { describe, expect, it } from 'vitest'
import {
  jsonErrorResponse,
  markdownResponse,
  notAcceptableResponse,
  notFoundMarkdownResponse,
} from './agent-responses'

describe('markdownResponse', () => {
  it('serves markdown with a Vary: Accept header', () => {
    const response = markdownResponse('# Hi')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('Vary')).toBe('Accept')
  })

  it('honors a custom status', () => {
    expect(markdownResponse('gone', { status: 404 }).status).toBe(404)
  })
})

describe('notFoundMarkdownResponse', () => {
  it('returns 404 markdown naming the missing path and recovery links', async () => {
    const response = notFoundMarkdownResponse('/missing-page')
    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')

    const body = await response.text()
    expect(body).toContain('/missing-page')
    for (const link of ['/llms.txt', '/sitemap.xml', '/openapi.json', '/docs']) {
      expect(body).toContain(link)
    }
  })
})

describe('notAcceptableResponse', () => {
  it('returns 406 listing the supported types', async () => {
    const response = notAcceptableResponse(['text/html', 'text/markdown'])
    expect(response.status).toBe(406)
    expect(response.headers.get('Vary')).toBe('Accept')
    expect(await response.text()).toContain('text/html, text/markdown')
  })
})

describe('jsonErrorResponse', () => {
  it('returns a structured JSON error envelope', async () => {
    const response = jsonErrorResponse(404, {
      code: 'not_found',
      message: 'No such endpoint.',
      hint: 'See /openapi.json.',
    })
    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: 'No such endpoint.', hint: 'See /openapi.json.' },
    })
  })
})
