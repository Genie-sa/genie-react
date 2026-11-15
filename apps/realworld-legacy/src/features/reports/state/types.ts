import type {
  CycleTimeReport,
  ReportRange,
  ThroughputReport,
  WorkloadReport,
} from '../../../api/types'
import type {
  REPORT_NOTE_ADDED,
  REPORT_NOTE_REMOVED,
  REPORTS_FAILED,
  REPORTS_PROJECT_SELECTED,
  REPORTS_RECEIVED,
  REPORTS_REQUESTED,
} from './action-types'

export interface ReportNote {
  id: string
  text: string
  authorName: string
  range: ReportRange
}

export interface ReportsState {
  projectKey: string
  range: ReportRange
  status: 'idle' | 'loading' | 'ready' | 'failed'
  throughput: ThroughputReport | null
  cycleTime: CycleTimeReport | null
  workload: WorkloadReport | null
  error: string | null
  notes: ReportNote[]
}

export type ReportsAction =
  | { type: typeof REPORTS_PROJECT_SELECTED; projectKey: string }
  | { type: typeof REPORTS_REQUESTED; projectKey: string; range: ReportRange }
  | {
      type: typeof REPORTS_RECEIVED
      throughput: ThroughputReport
      cycleTime: CycleTimeReport
      workload: WorkloadReport
    }
  | { type: typeof REPORTS_FAILED; error: string }
  | { type: typeof REPORT_NOTE_ADDED; note: ReportNote }
  | { type: typeof REPORT_NOTE_REMOVED; id: string }
