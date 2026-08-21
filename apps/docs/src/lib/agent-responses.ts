import { siteUrl } from './shared'

export const markdownContentType = 'text/markdown; charset=utf-8'

export function markdownResponse(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', markdownContentType)
  headers.set('Vary', 'Accept')
  return new Response(body, { ...init, headers })
}

export function notFoundMarkdown(pathname: string): string {
  return `# 404 — Not found

\`${pathname}\` does not exist on this site.

Where to look next:

- [Documentation index](${siteUrl}/docs) — append \`.md\` to any docs URL for the markdown source.
- [llms.txt](${siteUrl}/llms.txt) — every docs page with markdown URLs and when-to-use guidance.
- [llms-full.txt](${siteUrl}/llms-full.txt) — the complete documentation as one markdown file.
- [sitemap.xml](${siteUrl}/sitemap.xml) — every indexable URL on this site.
- [openapi.json](${siteUrl}/openapi.json) — machine-readable description of this site's HTTP endpoints.
`
}

export function notFoundMarkdownResponse(pathname: string): Response {
  return markdownResponse(notFoundMarkdown(pathname), { status: 404 })
}

export function notAcceptableResponse(supported: readonly string[]): Response {
  return new Response(`This resource is available as: ${supported.join(', ')}.\n`, {
    status: 406,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      Vary: 'Accept',
    },
  })
}

export interface ApiError {
  code: string
  message: string
  hint?: string
}

export function jsonErrorResponse(status: number, error: ApiError): Response {
  return Response.json({ error }, { status })
}
