import { PureComponent } from 'react'
import type { CycleTimeReport } from '../../api/types'
import { WidgetFrame } from './widget-frame'

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] as number
}

export default class CycleTimeWidget extends PureComponent<{ report: CycleTimeReport }> {
  render() {
    const days = this.props.report.samples.map((sample) => sample.days).sort((a, b) => a - b)
    const median = percentile(days, 0.5)
    const p85 = percentile(days, 0.85)
    return (
      <WidgetFrame title="Cycle time" summary={`${days.length} issues`}>
        <dl className="cycle-time">
          <div>
            <dt>Median</dt>
            <dd>{median.toFixed(1)} days</dd>
          </div>
          <div>
            <dt>85th percentile</dt>
            <dd>{p85.toFixed(1)} days</dd>
          </div>
        </dl>
      </WidgetFrame>
    )
  }
}
