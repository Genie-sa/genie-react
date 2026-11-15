import { Link, Outlet } from '@tanstack/react-router'
import { usePermissions } from '../../app/permissions'

const SECTIONS = [
  { to: '/settings', label: 'Profile', exact: true },
  { to: '/settings/appearance', label: 'Appearance', exact: false },
  { to: '/settings/notifications', label: 'Notifications', exact: false },
  { to: '/settings/team', label: 'Team', exact: false, permission: 'team.manage' },
  { to: '/settings/audit', label: 'Audit log', exact: false, permission: 'audit.view' },
] as const

export function SettingsLayout() {
  const { can } = usePermissions()
  return (
    <div className="flex gap-8 p-6">
      <nav aria-label="Settings" className="w-48 shrink-0 space-y-1">
        <h1 className="mb-4 text-xl font-semibold">Settings</h1>
        {SECTIONS.filter((section) => !('permission' in section) || can(section.permission)).map(
          (section) => (
            <Link
              key={section.to}
              to={section.to}
              activeOptions={{ exact: section.exact }}
              className="block rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 data-[status=active]:bg-white data-[status=active]:font-medium data-[status=active]:text-slate-900 data-[status=active]:shadow-sm dark:text-slate-300 dark:hover:bg-slate-800 dark:data-[status=active]:bg-slate-900 dark:data-[status=active]:text-white"
            >
              {section.label}
            </Link>
          ),
        )}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
