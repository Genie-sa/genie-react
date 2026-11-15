import type { ThroughputReport } from '../../api/types'
import { WidgetFrame } from './widget-frame'

export function ThroughputWidget({ report }: { report: ThroughputReport }) {
  const peak = Math.max(1, ...report.buckets.map((bucket) => bucket.completed))
  return (
    <WidgetFrame title="Throughput" summary={`${report.total} completed`}>
      <div className="bar-chart" data-range={report.range}>
        {report.buckets.map((bucket) => (
          <div
            key={bucket.label}
            className="bar-chart__bar"
            title={`${bucket.label}: ${bucket.completed}`}
          >
            <span style={{ height: `${(bucket.completed / peak) * 100}%` }} />
          </div>
        ))}
      </div>
    </WidgetFrame>
  )
}
