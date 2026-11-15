import { GenieScript } from 'genie-react/next'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { DevelopmentTools } from '../components/devtools/development-tools'
import { GenieQueryTools } from '../components/devtools/genie-query-tools'
import { ShopProviders } from '../components/providers/shop-providers'
import { ThemeProvider } from '../components/providers/theme-provider'
import { currentLocale } from '../lib/server/session'
import { THEME_BOOTSTRAP_SCRIPT } from '../lib/theme'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Fernhill Supply', template: '%s · Fernhill Supply' },
  description: 'Outerwear, knitwear and goods for the home, made in small runs.',
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}): Promise<ReactNode> {
  const locale = await currentLocale()
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <GenieScript />
        <GenieQueryTools />
        <ThemeProvider>
          <ShopProviders initialLocale={locale}>
            {children}
            <DevelopmentTools />
          </ShopProviders>
        </ThemeProvider>
      </body>
    </html>
  )
}
