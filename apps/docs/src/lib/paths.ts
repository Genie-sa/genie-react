const machineEndpoints = new Set([
  '/llms.txt',
  '/llms-full.txt',
  '/sitemap.xml',
  '/openapi.json',
  '/robots.txt',
])

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function isMachinePath(pathname: string): boolean {
  return machineEndpoints.has(pathname) || pathname.startsWith('/api/') || pathname.endsWith('.md')
}
