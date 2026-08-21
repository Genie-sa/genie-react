import { appDescription, appName, gitConfig, siteUrl } from './shared'

export interface LlmsPageEntry {
  title: string
  description?: string
  markdownUrl: string
  section: string
}

export function sectionLabelFromSlug(slug: string | undefined): string {
  if (!slug) return 'Overview'
  const words = slug.replaceAll('-', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function linkLine(entry: LlmsPageEntry): string {
  const description = entry.description ? `: ${entry.description}` : ''
  return `- [${entry.title}](${siteUrl}${entry.markdownUrl})${description}`
}

export function buildLlmsText(pages: readonly LlmsPageEntry[]): string {
  const sections = new Map<string, LlmsPageEntry[]>()
  for (const page of pages) {
    const group = sections.get(page.section) ?? []
    group.push(page)
    sections.set(page.section, group)
  }

  const pageSections = [...sections.entries()]
    .map(([section, entries]) => `## ${section}\n\n${entries.map(linkLine).join('\n')}`)
    .join('\n\n')

  return `# ${appName}

> ${appDescription}

Genie React is a local-first developer tool: the genie-react npm package adds collectors and a hub to a running React or React Native app, and the @genie-react/cli package (\`npx genie-react\`) gives an AI coding agent DevTools access to that app from the terminal. Every link below points at markdown; the same pages are served as HTML without the .md suffix.

## When to use Genie React

Use Genie React when an AI coding agent works on a live React or TanStack app and needs runtime evidence instead of guesses:

- Debug why a component rendered: join one UI action to its hook changes, renders, effects, and source locations.
- Optimize render performance: find expensive components, prove a fix with before/after runs, and check memory and frame rate.
- Read and manipulate live state: props, hooks, Context, TanStack Query cache, and TanStack Router navigation.
- Test hard-to-reach UI states: force loading and error branches, verify the UI, then restore the app.
- Verify a fix end to end: pair Genie with a UI driver (agent-browser or agent-device) so the agent drives the UI and checks the result against live evidence.

Do not reach for Genie React for static code analysis, non-React apps, or production monitoring — it attaches to a locally running development app.

How to call it: run \`npx genie-react\` in the app repository, then follow [Getting started](${siteUrl}/docs/getting-started/index.md). The full tool list an agent can call is under [Tools](${siteUrl}/docs/tools/index.md).

## Machine-readable resources

- [llms-full.txt](${siteUrl}/llms-full.txt): the complete documentation as one markdown file.
- [openapi.json](${siteUrl}/openapi.json): OpenAPI 3.1 description of this site's HTTP endpoints.
- [sitemap.xml](${siteUrl}/sitemap.xml): every indexable URL.
- [GitHub repository](https://github.com/${gitConfig.user}/${gitConfig.repo}): source code, issues, and releases.

${pageSections}
`
}
