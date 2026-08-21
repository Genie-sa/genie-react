import { appDescription, appName, gitConfig, siteUrl } from './shared'

const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`

export interface SitePageSection {
  heading: string
  paragraphs: string[]
}

export interface SitePage {
  path: string
  title: string
  description: string
  sections: SitePageSection[]
}

export const aboutPage: SitePage = {
  path: '/about',
  title: `About ${appName}`,
  description: appDescription,
  sections: [
    {
      heading: 'What Genie React is',
      paragraphs: [
        'Genie React gives AI coding agents live DevTools access to a running React or React Native app from the terminal. An agent pairs Genie with a UI driver such as agent-browser or agent-device: the driver clicks and types, and Genie reads what React actually did — renders, hook changes, effects, TanStack Query cache state, and TanStack Router navigation.',
        'That evidence loop lets an agent reproduce a bug, trace its observed cause to source, apply a fix, and verify the result against the live app instead of guessing from static code.',
      ],
    },
    {
      heading: 'The project',
      paragraphs: [
        `Genie React is open source under the MIT license and developed in the open at ${repoUrl}. It ships as two npm packages: genie-react, the in-app collectors and local hub, and @genie-react/cli, the terminal interface agents call. Nothing leaves the developer's machine: the hub, the app, and the CLI all talk over localhost.`,
        'This site is the project documentation. Every docs page is also available as markdown — append .md to its URL, or start from /llms.txt for a complete machine-readable index.',
      ],
    },
  ],
}

export const contactPage: SitePage = {
  path: '/contact',
  title: `Contact the ${appName} team`,
  description: `How to reach the ${appName} maintainers: bug reports, questions, and security disclosures.`,
  sections: [
    {
      heading: 'Bug reports and feature requests',
      paragraphs: [
        `The fastest way to reach the maintainers is the GitHub issue tracker at ${repoUrl}/issues. Include the package version, your platform (Vite, Next.js, or React Native), and the CLI output you saw — the more of the failing session you paste, the faster it gets fixed.`,
      ],
    },
    {
      heading: 'Questions and discussion',
      paragraphs: [
        `For usage questions that are not bugs, open a discussion on the repository at ${repoUrl} or check the troubleshooting guide at ${siteUrl}/docs/reference/troubleshooting first — it covers the most common setup and connection problems.`,
      ],
    },
    {
      heading: 'Security disclosures',
      paragraphs: [
        `Please report suspected security vulnerabilities privately through GitHub security advisories at ${repoUrl}/security/advisories/new rather than in a public issue, so a fix can ship before details are public.`,
      ],
    },
  ],
}

export const privacyPage: SitePage = {
  path: '/privacy',
  title: `${appName} privacy policy`,
  description: `What data the ${appName} documentation site and developer tool do and do not collect.`,
  sections: [
    {
      heading: 'This website',
      paragraphs: [
        'This documentation site is a static-content site with no accounts, no sign-ups, and no advertising. We do not set tracking cookies and we do not run third-party analytics scripts. The built-in search runs against a server endpoint on this site; queries are used only to compute results and are not stored by us.',
        'The site is served by Cloudflare, which processes standard request metadata (such as IP address and user agent) to deliver and secure the service, as described in Cloudflare’s own privacy policy.',
      ],
    },
    {
      heading: 'The Genie React tool',
      paragraphs: [
        'The genie-react packages run entirely on your machine. The hub, your app, and the CLI communicate over localhost; the tool sends no telemetry and uploads nothing about your app, your code, or your sessions to us or to any third party.',
        `If you believe the tool or this site handles data in a way this page does not describe, report it at ${repoUrl}/issues.`,
      ],
    },
  ],
}

export const sitePages: readonly SitePage[] = [aboutPage, contactPage, privacyPage]

export function sitePageMarkdown(page: SitePage): string {
  const sections = page.sections
    .map((section) => `## ${section.heading}\n\n${section.paragraphs.join('\n\n')}`)
    .join('\n\n')
  return `# ${page.title} (${siteUrl}${page.path})\n\n> ${page.description}\n\n${sections}\n`
}

export function homeMarkdown(): string {
  return `# ${appName} (${siteUrl})

> ${appDescription}

Genie React pairs an AI coding agent's UI driver (agent-browser or agent-device) with live React and TanStack DevTools. The agent drives the UI, reads the renders, hooks, effects, Query cache, and Router state that resulted, then verifies its fix against live evidence.

Key resources:

- [Documentation](${siteUrl}/docs) — append \`.md\` to any docs URL for markdown.
- [llms.txt](${siteUrl}/llms.txt) — full docs index with when-to-use guidance for agents.
- [llms-full.txt](${siteUrl}/llms-full.txt) — the complete documentation as one markdown file.
- [openapi.json](${siteUrl}/openapi.json) — this site's HTTP endpoints, machine-readable.
- [sitemap.xml](${siteUrl}/sitemap.xml) — every indexable URL.
- [GitHub](https://github.com/${gitConfig.user}/${gitConfig.repo}) — source, issues, and releases.
`
}
