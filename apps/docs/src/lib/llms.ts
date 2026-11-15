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

The genie-react package connects a running React or React Native app to a local hub. The @genie-react/cli package sends tool calls to it. Every page link below points at markdown. Use the site navigation to read the HTML pages.

## When to use Genie React

Pair Genie with a UI driver (agent-browser or agent-device). The driver acts on the app; Genie shows what happened inside it:

- Verify a fix: \`genie-react verify\` decides declared claims about one interaction and exits with the verdict.
- Optimize: find components that render for nothing, name the cause, and compare repeated runs before and after a change.
- Validate UI states: hold loading, empty and error states, override props and Context, then restore the app.
- Debug renders and effects: join one action to its render causes, effect runs and source locations.
- Read TanStack Query, TanStack Router and Redux state.

Use a local development build. Run \`npx @genie-react/cli\` in the app folder. Follow [Install and connect](${siteUrl}/docs/getting-started/install.md). Read the [CLI reference](${siteUrl}/docs/reference/cli.md) for output and exit codes. Discover the running app with \`npx @genie-react/cli tools\`; use [Tools](${siteUrl}/docs/tools.md).

## Machine-readable resources

- [llms-full.txt](${siteUrl}/llms-full.txt): the complete documentation as one markdown file.
- [openapi.json](${siteUrl}/openapi.json): OpenAPI 3.1 description of this site's HTTP endpoints.
- [sitemap.xml](${siteUrl}/sitemap.xml): every indexable URL.
- [GitHub repository](https://github.com/${gitConfig.user}/${gitConfig.repo}): source code, issues, and releases.

${pageSections}
`
}
