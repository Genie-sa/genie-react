import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { SiteFooter } from '@/components/site-footer'
import { baseOptions } from '@/lib/layout.shared'
import type { SitePage } from '@/lib/site-pages'

export function SitePageView({ page }: { page: SitePage }) {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
        <p className="mt-4 leading-7 text-fd-muted-foreground">{page.description}</p>
        {page.sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-medium">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-4 leading-7 text-fd-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </main>
      <SiteFooter />
    </HomeLayout>
  )
}
