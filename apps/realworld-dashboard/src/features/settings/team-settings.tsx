import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { api } from '../../api/endpoints'
import type { Role } from '../../api/types'
import { useAuth } from '../../app/auth'
import { usePreferences } from '../../app/preferences'
import { toast } from '../../app/toasts'
import { Avatar } from '../../components/ui/avatar'
import { Card, CardHeader } from '../../components/ui/card'
import { Select } from '../../components/ui/form-controls'

const ROLES: readonly Role[] = ['admin', 'manager', 'agent', 'viewer']
const teamKey = ['settings', 'team'] as const

export function TeamSettings() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { formatRelative } = usePreferences()
  const { data: team } = useSuspenseQuery({
    queryKey: teamKey,
    queryFn: ({ signal }) => api.team(signal),
  })
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.updateMemberRole(id, role),
    onSuccess: (member) => toast.success(`${member.name} is now ${member.role}`),
    onError: (error) => toast.error('Could not change role', error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: teamKey }),
  })

  return (
    <Card>
      <CardHeader
        title="Team members"
        description={`${team.length} people have access to Meridian Ops`}
      />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {team.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={member.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{member.name}</p>
              <p className="text-xs text-slate-500">
                {member.title} · active {formatRelative(member.lastActiveAt)}
              </p>
            </div>
            <Select
              aria-label={`Role for ${member.name}`}
              value={member.role}
              disabled={member.id === session?.user.id || changeRole.isPending}
              onChange={(event) =>
                changeRole.mutate({ id: member.id, role: event.target.value as Role })
              }
              className="w-32"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
    </Card>
  )
}
