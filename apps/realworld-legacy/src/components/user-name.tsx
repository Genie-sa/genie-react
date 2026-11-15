import { useGetUsersQuery } from '../api/service'
import type { User } from '../api/types'
import { Avatar } from './avatar'

const EMPTY_USERS: User[] = []

function useUser(userId: string | null): User | undefined {
  const { data = EMPTY_USERS } = useGetUsersQuery()
  return userId === null ? undefined : data.find((user) => user.id === userId)
}

export function UserName({
  userId,
  withAvatar = false,
}: {
  userId: string | null
  withAvatar?: boolean
}) {
  const user = useUser(userId)
  if (userId === null) return <span className="muted">Unassigned</span>
  const name = user?.name ?? 'Unknown user'
  return (
    <span className="user-name">
      {withAvatar && <Avatar name={name} size={20} />}
      {name}
    </span>
  )
}
