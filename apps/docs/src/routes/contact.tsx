import { createFileRoute } from '@tanstack/react-router'
import { SitePageView } from '@/components/site-page'
import { pageHead } from '@/lib/seo'
import { contactPage } from '@/lib/site-pages'

export const Route = createFileRoute('/contact')({
  head: () => pageHead(contactPage),
  component: () => <SitePageView page={contactPage} />,
})
