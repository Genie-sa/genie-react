import { createFileRoute } from '@tanstack/react-router'
import { SitePageView } from '@/components/site-page'
import { pageHead } from '@/lib/seo'
import { privacyPage } from '@/lib/site-pages'

export const Route = createFileRoute('/privacy')({
  head: () => pageHead(privacyPage),
  component: () => <SitePageView page={privacyPage} />,
})
