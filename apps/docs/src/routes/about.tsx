import { createFileRoute } from '@tanstack/react-router'
import { SitePageView } from '@/components/site-page'
import { pageHead } from '@/lib/seo'
import { aboutPage } from '@/lib/site-pages'

export const Route = createFileRoute('/about')({
  head: () => pageHead(aboutPage),
  component: () => <SitePageView page={aboutPage} />,
})
