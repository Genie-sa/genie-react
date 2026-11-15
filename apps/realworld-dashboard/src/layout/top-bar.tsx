import { Search } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { UserMenu } from './user-menu'

export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search orders, customers, products…</span>
        <kbd className="rounded border border-slate-200 px-1.5 text-xs dark:border-slate-600">
          ⌘K
        </kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
