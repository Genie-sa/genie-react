import classNames from 'classnames'
import { Component } from 'react'
import { connect } from 'react-redux'
import type { ReportRange } from '../../api/types'
import type { RootState } from '../../store'
import { loadReports } from './state/actions'

const RANGES: { value: ReportRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

interface ReportRangePickerProps {
  projectKey: string
  range: ReportRange
  loadReports: (projectKey: string, range: ReportRange) => unknown
}

class ReportRangePicker extends Component<ReportRangePickerProps> {
  render() {
    return (
      <div className="segmented" role="group" aria-label="Date range">
        {RANGES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={this.props.range === option.value}
            className={classNames('segmented__option', {
              active: this.props.range === option.value,
            })}
            onClick={() => this.props.loadReports(this.props.projectKey, option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    )
  }
}

export default connect((state: RootState) => ({ range: state.reports.range }), { loadReports })(
  ReportRangePicker,
)
