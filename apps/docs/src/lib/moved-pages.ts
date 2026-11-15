import movedPages from './moved-pages.json'

const MOVED_PAGES: Readonly<Record<string, string>> = movedPages

/** Returns where a removed docs URL now lives, keeping the `.md` variant a markdown URL, or null when the page did not move. */
export function movedPageLocation(pathname: string): string | null {
  const markdown = pathname.endsWith('.md')
  const target = MOVED_PAGES[markdown ? pathname.slice(0, -'.md'.length) : pathname]
  if (!target) return null
  if (!markdown) return target
  const [page] = target.split('#')
  return `${page}.md`
}
