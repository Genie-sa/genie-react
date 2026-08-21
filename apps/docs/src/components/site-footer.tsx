import { Link } from '@tanstack/react-router'
import { gitConfig } from '@/lib/shared'

export function SiteFooter() {
  return (
    <footer className="border-t px-6 py-8">
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fd-muted-foreground">
        <Link to="/docs/$" params={{ _splat: '' }} className="hover:text-fd-foreground">
          Docs
        </Link>
        <Link to="/about" className="hover:text-fd-foreground">
          About
        </Link>
        <Link to="/contact" className="hover:text-fd-foreground">
          Contact
        </Link>
        <Link to="/privacy" className="hover:text-fd-foreground">
          Privacy
        </Link>
        <a
          href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
          className="hover:text-fd-foreground"
        >
          GitHub
        </a>
        <a href="/llms.txt" className="hover:text-fd-foreground">
          llms.txt
        </a>
      </nav>
    </footer>
  )
}
