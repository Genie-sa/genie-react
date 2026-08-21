import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import {
  markdownResponse,
  notAcceptableResponse,
  notFoundMarkdownResponse,
} from '@/lib/agent-responses'
import { negotiatePageRepresentation, prefersHtmlStrictly } from '@/lib/content-negotiation'
import { pageMarkdown } from '@/lib/markdown-pages'
import { isMachinePath, normalizePathname } from '@/lib/paths'

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

const supportedPageTypes = ['text/html', 'text/markdown'] as const

function setVaryAccept(response: unknown): void {
  if (!(response instanceof Response)) return
  try {
    if (!response.headers.get('Vary')?.includes('Accept')) {
      response.headers.append('Vary', 'Accept')
    }
  } catch {
    // some framework responses expose immutable headers; Vary is best-effort there
  }
}

function isHtmlNotFound(response: unknown): boolean {
  return (
    response instanceof Response &&
    response.status === 404 &&
    (response.headers.get('Content-Type') ?? '').includes('text/html')
  )
}

const agentMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next()

  const pathname = normalizePathname(new URL(request.url).pathname)
  if (pathname.startsWith('/_') || isMachinePath(pathname)) return next()

  const accept = request.headers.get('Accept')
  const markdown = await pageMarkdown(pathname)

  if (markdown !== null) {
    const representation = negotiatePageRepresentation(accept)
    if (representation === null) return notAcceptableResponse(supportedPageTypes)
    if (representation === 'markdown') return markdownResponse(markdown)

    const result = await next()
    setVaryAccept(result.response)
    return result
  }

  if (negotiatePageRepresentation(accept) === 'markdown') {
    return notFoundMarkdownResponse(pathname)
  }

  const result = await next()
  if (isHtmlNotFound(result.response) && !prefersHtmlStrictly(accept)) {
    return notFoundMarkdownResponse(pathname)
  }
  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, agentMiddleware],
}))
