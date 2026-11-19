import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = resolve(docsRoot, 'content/docs')
const siteUrl = new URL(process.env.DOCS_SITE_URL ?? 'https://genie-react.com')
const movedPages = JSON.parse(readFileSync(resolve(docsRoot, 'src/lib/moved-pages.json'), 'utf8'))

function docsPages() {
  return readdirSync(contentRoot, { recursive: true })
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const slug = file
        .split(sep)
        .join('/')
        .replace(/\.mdx$/, '')
      if (slug === 'index') return { html: '/docs', markdown: '/docs/index.md' }
      const path = `/docs/${slug.replace(/\/index$/, '')}`
      return { html: path, markdown: `${path}.md` }
    })
}

async function expectStatus(path, status, contentType) {
  const response = await fetch(new URL(path, siteUrl), { redirect: 'manual' })
  if (response.status !== status) return `${path}: expected ${status}, got ${response.status}`
  const actualType = response.headers.get('content-type') ?? ''
  if (contentType && !actualType.startsWith(contentType)) {
    return `${path}: expected ${contentType}, got ${actualType}`
  }
  return null
}

async function expectRedirect(from, to) {
  const response = await fetch(new URL(from, siteUrl), { redirect: 'manual' })
  const location = response.headers.get('location')
  const expected = new URL(to, siteUrl).href
  if (response.status !== 301 || !location || new URL(location, siteUrl).href !== expected) {
    return `${from}: expected 301 to ${expected}, got ${response.status} ${location ?? 'without a location'}`
  }
  return null
}

const checks = [
  expectStatus('/llms.txt', 200, 'text/markdown'),
  expectStatus('/sitemap.xml', 200),
  ...docsPages().flatMap((page) => [
    expectStatus(page.html, 200, 'text/html'),
    expectStatus(page.markdown, 200, 'text/markdown'),
  ]),
  ...Object.entries(movedPages).map(([from, to]) => expectRedirect(from, to)),
]

const errors = (await Promise.all(checks)).filter(Boolean)

if (errors.length > 0) {
  console.error(`${siteUrl.origin} does not match this checkout:\n${errors.join('\n')}`)
  process.exit(1)
}

console.log(`${siteUrl.origin} serves all ${checks.length} checked URLs from this checkout.`)
