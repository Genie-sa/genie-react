import { Link } from '@tanstack/react-router'
import {
  BarChart3,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useWorkspaceStore } from '../stores/workspace'

interface NavItem {
  to: '/' | '/orders' | '/customers' | '/inventory' | '/reports' | '/settings'
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function SidebarNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { recentlyViewed } = useWorkspaceStore()
  return (
    <aside
      aria-label="Primary"
      className={cn(
        'flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] dark:border-slate-800 dark:bg-slate-900',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
        <span className="flex size-7 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">
          M
        </span>
        {!collapsed && <span className="font-semibold">Meridian Ops</span>}
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === '/' }}
            title={collapsed ? label : undefined}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 data-[status=active]:bg-indigo-50 data-[status=active]:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:data-[status=active]:bg-indigo-950 dark:data-[status=active]:text-indigo-300"
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && label}
          </Link>
        ))}
        {!collapsed && recentlyViewed.length > 0 && (
          <div className="pt-6">
            <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Recently viewed
            </p>
            {recentlyViewed.map((item) =>
              item.kind === 'order' ? (
                <Link
                  key={item.id}
                  to="/orders/$orderId"
                  params={{ orderId: item.id }}
                  className="block truncate rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {item.label}
                </Link>
              ) : (
                <Link
                  key={item.id}
                  to="/customers/$customerId"
                  params={{ customerId: item.id }}
                  className="block truncate rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>
        )}
      </nav>
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex h-10 items-center justify-center border-t border-slate-200 text-slate-400 hover:text-slate-700 dark:border-slate-800"
      >
        {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
      </button>
    </aside>
  )
}
