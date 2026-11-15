import type { Issue } from '../../api/types'
import { FeatureGate } from '../../contexts/feature-flags'

export function CardMeta({ issue }: { issue: Issue }) {
  return (
    <div className="card-meta">
      <FeatureGate flag="card-estimates">
        {issue.estimate !== null && (
          <span className="card-meta__estimate">{issue.estimate} pts</span>
        )}
      </FeatureGate>
      <FeatureGate flag="card-labels">
        {issue.labels.map((label) => (
          <span key={label} className="label">
            {label}
          </span>
        ))}
      </FeatureGate>
      {issue.commentCount > 0 && (
        <span className="card-meta__comments">💬 {issue.commentCount}</span>
      )}
    </div>
  )
}
