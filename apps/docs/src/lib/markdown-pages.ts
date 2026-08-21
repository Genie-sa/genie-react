import { docsRoute } from './shared'
import { homeMarkdown, sitePageMarkdown, sitePages } from './site-pages'
import { getLLMText, source } from './source'

const staticPageMarkdown = new Map<string, string>([
  ['/', homeMarkdown()],
  ...sitePages.map((page): [string, string] => [page.path, sitePageMarkdown(page)]),
])

function docsSlugs(pathname: string): string[] | null {
  if (pathname !== docsRoute && !pathname.startsWith(`${docsRoute}/`)) return null
  return pathname
    .slice(docsRoute.length)
    .split('/')
    .filter((segment) => segment.length > 0)
}

export async function pageMarkdown(pathname: string): Promise<string | null> {
  const staticPage = staticPageMarkdown.get(pathname)
  if (staticPage !== undefined) return staticPage

  const slugs = docsSlugs(pathname)
  if (slugs === null) return null
  const page = source.getPage(slugs)
  return page ? await getLLMText(page) : null
}
