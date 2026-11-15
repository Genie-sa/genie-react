import type { ReactNode } from 'react'
import { connect } from 'react-redux'
import type { RootState } from '../../store'
import type { ReportsState } from './state/types'

type ReportData = Pick<ReportsState, 'status' | 'throughput' | 'cycleTime' | 'workload' | 'error'>

interface ReportDataLoaderProps extends ReportData {
  children: (data: ReportData) => ReactNode
}

function ReportDataLoader({ children, ...data }: ReportDataLoaderProps) {
  return <>{children(data)}</>
}

const mapStateToProps = ({ reports }: RootState): ReportData => ({
  status: reports.status,
  throughput: reports.throughput,
  cycleTime: reports.cycleTime,
  workload: reports.workload,
  error: reports.error,
})

export default connect(mapStateToProps)(ReportDataLoader)
