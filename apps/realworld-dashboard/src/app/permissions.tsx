import { createContext, type ReactNode, useContext, useMemo } from 'react'
import type { Role } from '../api/types'

export type Permission =
  | 'orders.edit'
  | 'orders.bulk'
  | 'orders.create'
  | 'customers.edit'
  | 'inventory.adjust'
  | 'team.manage'
  | 'audit.view'

const GRANTS: Record<Role, readonly Permission[]> = {
  admin: [
    'orders.edit',
    'orders.bulk',
    'orders.create',
    'customers.edit',
    'inventory.adjust',
    'team.manage',
    'audit.view',
  ],
  manager: [
    'orders.edit',
    'orders.bulk',
    'orders.create',
    'customers.edit',
    'inventory.adjust',
    'audit.view',
  ],
  agent: ['orders.edit', 'orders.create', 'customers.edit'],
  viewer: [],
}

export interface PermissionsContextValue {
  role: Role
  can: (permission: Permission) => boolean
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

export function PermissionsProvider({ role, children }: { role: Role; children: ReactNode }) {
  const value = useMemo<PermissionsContextValue>(() => {
    const granted = new Set(GRANTS[role])
    return { role, can: (permission) => granted.has(permission) }
  }, [role])
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): PermissionsContextValue {
  const value = useContext(PermissionsContext)
  if (!value) throw new Error('usePermissions must be used inside PermissionsProvider')
  return value
}

export function usePermissionsSnapshot(role: Role | null): Permission[] {
  return useMemo(() => (role ? [...GRANTS[role]] : []), [role])
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}) {
  const { can } = usePermissions()
  return can(permission) ? children : fallback
}
