import { connect } from 'react-redux'
import type { IssueStatus } from '../../api/types'
import { STATUS_LABELS } from '../../components/badges'
import type { RootState } from '../../store'
import { selectStatusCounts } from '../../store/issue-selectors'

interface StatusSummaryProps {
  counts: Record<IssueStatus, number>
}

function StatusSummary({ counts }: StatusSummaryProps) {
  return (
    <dl className="status-summary">
      {(Object.keys(counts) as IssueStatus[]).map((status) => (
        <div key={status} className="status-summary__item">
          <dt>{STATUS_LABELS[status]}</dt>
          <dd>{counts[status]}</dd>
        </div>
      ))}
    </dl>
  )
}

const mapStateToProps = (state: RootState): StatusSummaryProps => ({
  counts: selectStatusCounts(state),
})

export default connect(mapStateToProps)(StatusSummary)
