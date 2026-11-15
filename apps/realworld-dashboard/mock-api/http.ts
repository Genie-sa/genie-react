import type { IncomingMessage, ServerResponse } from 'node:http'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export interface RequestContext {
  method: string
  path: string
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
  userId: string | null
}

export type Handler = (context: RequestContext) => unknown

export interface Route {
  method: string
  pattern: string
  matcher: RegExp
  keys: string[]
  latencyMs: number | ((context: RequestContext) => number)
  public: boolean
  handler: Handler
}

const MAX_BODY_BYTES = 1_000_000

export function compilePattern(pattern: string): { matcher: RegExp; keys: string[] } {
  const keys: string[] = []
  const source = pattern
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      keys.push(segment.slice(1))
      return '([^/]+)'
    })
    .join('/')
  return { matcher: new RegExp(`^${source}$`), keys }
}

export function matchesPath(rulePath: string, path: string): boolean {
  return rulePath.endsWith('*') ? path.startsWith(rulePath.slice(0, -1)) : rulePath === path
}

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES)
      throw new HttpError(413, 'payload_too_large', 'Request body is too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return undefined
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body is not valid JSON')
  }
}

export function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(status === 204 ? undefined : JSON.stringify(body))
}

export function sendError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  sendJson(response, status, { error: { code, message } })
}

export function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'invalid_body', 'Expected a JSON object body')
  }
  return value as Record<string, unknown>
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
