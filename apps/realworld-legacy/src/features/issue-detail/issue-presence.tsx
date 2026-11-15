import { useEffect, useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { UserName } from '../../components/user-name'
import { joinPresence } from './presence-channel'

function usePresence(issueKey: string): string[] {
  const userId = useAppSelector((state) => state.session.user?.id)
  const [viewerIds, setViewerIds] = useState<string[]>([])

  useEffect(() => {
    if (!userId) return undefined
    return joinPresence(issueKey, userId, setViewerIds)
  }, [issueKey, userId])

  return viewerIds
}

export function IssuePresence({ issueKey }: { issueKey: string }) {
  const viewerIds = usePresence(issueKey)
  return (
    <section className="presence" aria-label="Viewing now">
      <h3>Viewing now</h3>
      <ul>
        {viewerIds.map((id) => (
          <li key={id}>
            <UserName userId={id} withAvatar />
          </li>
        ))}
      </ul>
    </section>
  )
}
