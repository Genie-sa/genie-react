import { describe, expect, it } from 'vitest'
import { buildOpenApiDocument } from './openapi'

interface Operation {
  operationId?: string
  summary?: string
  description?: string
  responses?: Record<string, unknown>
}

function operations(document: Record<string, unknown>): Operation[] {
  const paths = document.paths as Record<string, Record<string, Operation>>
  return Object.values(paths).flatMap((path) => Object.values(path))
}

describe('buildOpenApiDocument', () => {
  const document = buildOpenApiDocument()

  it('is an OpenAPI 3.1 document with info and servers', () => {
    expect(document.openapi).toBe('3.1.0')
    const info = document.info as Record<string, unknown>
    expect(info.title).toContain('Genie React')
    expect(info.version).toBeTruthy()
    expect(document.servers).toEqual([
      { url: 'https://genie-react.com', description: 'Production' },
    ])
  })

  it('describes the key public endpoints', () => {
    const paths = Object.keys(document.paths as Record<string, unknown>)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/search',
        '/docs/{pagePath}.md',
        '/llms.txt',
        '/llms-full.txt',
        '/sitemap.xml',
        '/openapi.json',
      ]),
    )
  })

  it('gives every operation a unique operationId, summary, description, and responses', () => {
    const all = operations(document)
    expect(all.length).toBeGreaterThanOrEqual(6)

    const ids = all.map((operation) => operation.operationId)
    expect(new Set(ids).size).toBe(ids.length)

    for (const operation of all) {
      expect(operation.operationId).toBeTruthy()
      expect(operation.summary).toBeTruthy()
      expect(operation.description).toBeTruthy()
      expect(Object.keys(operation.responses ?? {}).length).toBeGreaterThan(0)
    }
  })

  it('requires the search query parameter and types it', () => {
    const paths = document.paths as Record<string, Record<string, Record<string, unknown>>>
    const parameters = paths['/api/search']?.get?.parameters as Array<Record<string, unknown>>
    const query = parameters.find((parameter) => parameter.name === 'query')
    expect(query).toMatchObject({ in: 'query', required: true })
    expect(query?.schema).toMatchObject({ type: 'string' })
  })

  it('defines the structured error schema used by API errors', () => {
    const components = document.components as {
      schemas: Record<string, { required?: string[]; properties?: Record<string, unknown> }>
    }
    const errorSchema = components.schemas.ErrorResponse
    expect(errorSchema?.required).toEqual(['error'])
    const error = errorSchema?.properties?.error as { required: string[] }
    expect(error.required).toEqual(['code', 'message'])
  })
})
