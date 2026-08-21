import { appDescription, appName, gitConfig, siteUrl } from './shared'

interface PageHeadOptions {
  title: string
  description: string
  path: string
}

interface PageHead {
  meta: Array<Record<string, string>>
  links: Array<Record<string, string>>
}

export function pageHead({ title, description, path }: PageHeadOptions): PageHead {
  const url = `${siteUrl}${path === '/' ? '' : path}`
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}

const organizationId = `${siteUrl}/#organization`
const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`

export function homeStructuredData(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: appName,
        description: appDescription,
        url: siteUrl,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'macOS, Linux, Windows',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        license: 'https://opensource.org/license/mit/',
        sameAs: [repoUrl, 'https://www.npmjs.com/package/genie-react'],
        author: { '@id': organizationId },
      },
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'Genie',
        url: siteUrl,
        logo: `${siteUrl}/og.png`,
        sameAs: [`https://github.com/${gitConfig.user}`],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'technical support',
          url: `${repoUrl}/issues`,
        },
      },
      {
        '@type': 'WebSite',
        name: `${appName} Docs`,
        url: siteUrl,
        description: appDescription,
        publisher: { '@id': organizationId },
      },
    ],
  })
}
