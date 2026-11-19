import handler from '@tanstack/react-start/server-entry'
import { type AnalyticsDataset, recordRequest } from '@/lib/request-analytics'

interface DocsEnv {
  DOCS_ANALYTICS: AnalyticsDataset
}

const agentResourceLinks = [
  '</llms.txt>; rel="describedby"; type="text/markdown"',
  '</sitemap.xml>; rel="sitemap"; type="application/xml"',
  '</openapi.json>; rel="service-desc"; type="application/json"',
].join(', ')

function withAgentResourceLinks(response: Response): Response {
  if (!response.headers.get('Content-Type')?.startsWith('text/html')) return response
  const linked = new Response(response.body, response)
  linked.headers.append('Link', agentResourceLinks)
  return linked
}

// Cloudflare Workers load the module's default export as the fetch handler.
export default {
  async fetch(request: Request, env: DocsEnv): Promise<Response> {
    const response = withAgentResourceLinks(await handler.fetch(request))
    recordRequest(env.DOCS_ANALYTICS, request, response)
    return response
  },
}
