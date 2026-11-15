import type { WorkloadReport } from '../../api/types'
import { UserName } from '../../components/user-name'
import { FeatureGate } from '../../contexts/feature-flags'
import { WidgetFrame } from './widget-frame'

export function WorkloadWidget({ report }: { report: WorkloadReport }) {
  return (
    <FeatureGate flag="reports-workload">
      <WidgetFrame title="Open work by assignee">
        <table className="workload">
          <tbody>
            {report.rows.slice(0, 8).map((row) => (
              <tr key={row.assigneeId ?? 'unassigned'}>
                <td>
                  <UserName userId={row.assigneeId} />
                </td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WidgetFrame>
    </FeatureGate>
  )
}
