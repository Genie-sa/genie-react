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

The genie-react package connects a running React or React Native app to a local hub. The @genie-react/cli package sends tool calls to it. Every page link below points at markdown; remove the .md suffix to read it as HTML.

## When to use Genie React

Use Genie React to inspect a running app:

- Debug why a component rendered: join one UI action to its hook changes, renders, effects, and source locations.
- Optimize render performance: find expensive components, prove a fix with before/after runs, and check memory and frame rate.
- Read and manipulate live state: props, hooks, Context, TanStack Query cache, and TanStack Router navigation.
- Test hard-to-reach UI states: force loading and error branches, verify the UI, then restore the app.
- Verify a fix end to end: pair Genie with a UI driver (agent-browser or agent-device) so the agent drives the UI and checks the result against live evidence.

Use a local development build. Inspect source separately when runtime evidence leaves a question open.

Run \`npx @genie-react/cli\` in the app folder. Follow [Getting started](${siteUrl}/docs/getting-started/index.md). Check [CLI output](${siteUrl}/docs/getting-started/cli-output.md) for JSON framing and release differences. Discover the running app with \`npx @genie-react/cli tools\`; use [Tools](${siteUrl}/docs/tools/index.md).

## Machine-readable resources

- [llms-full.txt](${siteUrl}/llms-full.txt): the complete documentation as one markdown file.
- [openapi.json](${siteUrl}/openapi.json): OpenAPI 3.1 description of this site's HTTP endpoints.
- [sitemap.xml](${siteUrl}/sitemap.xml): every indexable URL.
- [GitHub repository](https://github.com/${gitConfig.user}/${gitConfig.repo}): source code, issues, and releases.

${pageSections}
`
}
