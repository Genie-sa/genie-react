type ClientKind =
  | 'ai-assistant'
  | 'ai-search'
  | 'ai-training'
  | 'coding-agent'
  | 'search-engine'
  | 'tool'
  | 'browser'
  | 'unknown'

interface Client {
  kind: ClientKind
  name: string
}

export interface AnalyticsDataset {
  writeDataPoint(point: { indexes: string[]; blobs: string[]; doubles: number[] }): void
}

const knownClients: ReadonlyArray<readonly [pattern: RegExp, name: string, kind: ClientKind]> = [
  [/claude-code/i, 'claude-code', 'coding-agent'],
  [/ChatGPT-User/i, 'ChatGPT-User', 'ai-assistant'],
  [/Claude-User/i, 'Claude-User', 'ai-assistant'],
  [/Perplexity-User/i, 'Perplexity-User', 'ai-assistant'],
  [/MistralAI-User/i, 'MistralAI-User', 'ai-assistant'],
  [/DuckAssistBot/i, 'DuckAssistBot', 'ai-assistant'],
  [/OAI-SearchBot/i, 'OAI-SearchBot', 'ai-search'],
  [/Claude-SearchBot/i, 'Claude-SearchBot', 'ai-search'],
  [/PerplexityBot/i, 'PerplexityBot', 'ai-search'],
  [/Applebot/i, 'Applebot', 'ai-search'],
  [/GPTBot/i, 'GPTBot', 'ai-training'],
  [/ClaudeBot/i, 'ClaudeBot', 'ai-training'],
  [/CCBot/i, 'CCBot', 'ai-training'],
  [/Amazonbot/i, 'Amazonbot', 'ai-training'],
  [/meta-externalagent/i, 'Meta-ExternalAgent', 'ai-training'],
  [/Bytespider/i, 'Bytespider', 'ai-training'],
  [/Googlebot/i, 'Googlebot', 'search-engine'],
  [/bingbot/i, 'Bingbot', 'search-engine'],
  [/DuckDuckBot/i, 'DuckDuckBot', 'search-engine'],
  [/YandexBot/i, 'YandexBot', 'search-engine'],
  [/Baiduspider/i, 'Baiduspider', 'search-engine'],
  [/^curl\//i, 'curl', 'tool'],
  [/^Wget\//i, 'wget', 'tool'],
  [/node-fetch|undici|^node$/i, 'node', 'tool'],
  [/python-requests|python-httpx|aiohttp/i, 'python', 'tool'],
  [/^Mozilla\//, 'browser', 'browser'],
]

export function classifyClient(userAgent: string | null): Client {
  const match = userAgent ? knownClients.find(([pattern]) => pattern.test(userAgent)) : undefined
  return match ? { name: match[1], kind: match[2] } : { name: 'unknown', kind: 'unknown' }
}

export function referrerSource(request: Request): string {
  const referrer = request.headers.get('Referer')
  if (referrer && URL.canParse(referrer)) return new URL(referrer).hostname
  return new URL(request.url).searchParams.get('utm_source') ?? ''
}

function representation(response: Response): string {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.startsWith('text/markdown')) return 'markdown'
  if (contentType.startsWith('text/html')) return 'html'
  return contentType.split(';')[0] || 'none'
}

export function recordRequest(
  dataset: AnalyticsDataset,
  request: Request,
  response: Response,
): void {
  const client = classifyClient(request.headers.get('User-Agent'))
  dataset.writeDataPoint({
    indexes: [client.kind],
    blobs: [
      new URL(request.url).pathname,
      client.kind,
      client.name,
      referrerSource(request),
      representation(response),
      request.method,
    ],
    doubles: [response.status],
  })
}
