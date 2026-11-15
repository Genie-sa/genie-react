import { createFileRoute, Link } from '@tanstack/react-router'
import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { SiteFooter } from '@/components/site-footer'
import { baseOptions } from '@/lib/layout.shared'
import { homeStructuredData, pageHead } from '@/lib/seo'
import { appDescription, appName } from '@/lib/shared'

export const Route = createFileRoute('/')({
  head: () => {
    const head = pageHead({
      title: `${appName}: verification for coding agents`,
      description: appDescription,
      path: '/',
    })
    return {
      ...head,
      scripts: [{ type: 'application/ld+json', children: homeStructuredData() }],
    }
  },
  component: Home,
})

const GUIDES = [
  {
    splat: 'guides/verify-a-fix',
    title: 'Verify a fix',
    summary:
      'Declare what must be true, drive the interaction, and get a verdict with an exit code.',
  },
  {
    splat: 'guides/optimize',
    title: 'Optimize',
    summary: 'Find renders that change nothing, fix the cause, and measure again.',
  },
  {
    splat: 'guides/validate-ui-states',
    title: 'Validate UI states',
    summary: 'See loading, empty and error states without clicking through the app.',
  },
] as const

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20 sm:py-28">
        <p className="mb-4 font-mono text-sm text-fd-muted-foreground">
          Verification for coding agents
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Prove the fix worked.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-fd-muted-foreground">
          Your agent drives the app with agent-browser or agent-device. Genie shows it what happened
          inside React, TanStack Query and Router, and gives a pass or fail verdict.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/docs/$"
            params={{ _splat: '' }}
            className="rounded-lg bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground"
          >
            Read the docs
          </Link>
          <a
            href="https://github.com/Genie-sa/genie-react"
            className="rounded-lg border px-4 py-2.5 text-sm font-medium"
          >
            View on GitHub
          </a>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border bg-fd-border sm:grid-cols-3">
          {GUIDES.map((guide) => (
            <Link
              key={guide.splat}
              to="/docs/$"
              params={{ _splat: guide.splat }}
              className="bg-fd-background p-5 transition-colors hover:bg-fd-accent"
            >
              <h2 className="font-medium">{guide.title}</h2>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{guide.summary}</p>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </HomeLayout>
  )
}
