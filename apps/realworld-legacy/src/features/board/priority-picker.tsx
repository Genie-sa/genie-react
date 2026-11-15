import type { IssuePriority } from '../../api/types'
import { PRIORITY_LABELS, PriorityBadge } from '../../components/badges'
import { useFeatureFlags } from '../../contexts/feature-flags'
import { useAppDispatch } from '../../store/hooks'
import { updateIssueFields } from '../../store/issues'

const PRIORITIES = Object.keys(PRIORITY_LABELS) as IssuePriority[]

export function PriorityPicker({
  issueKey,
  priority,
}: {
  issueKey: string
  priority: IssuePriority
}) {
  const dispatch = useAppDispatch()
  const { isEnabled } = useFeatureFlags()
  if (!isEnabled('inline-priority')) return <PriorityBadge priority={priority} />
  return (
    <select
      className={`priority-select priority-select--${priority}`}
      aria-label={`Priority of ${issueKey}`}
      value={priority}
      onChange={(event) =>
        dispatch(
          updateIssueFields({
            key: issueKey,
            changes: { priority: event.target.value as IssuePriority },
          }),
        )
      }
    >
      {PRIORITIES.map((value) => (
        <option key={value} value={value}>
          {PRIORITY_LABELS[value]}
        </option>
      ))}
    </select>
  )
}
