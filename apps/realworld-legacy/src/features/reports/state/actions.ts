import type { AnyAction, ThunkAction } from '@reduxjs/toolkit'
import { request, toQueryString } from '../../../api/http'
import type {
  CycleTimeReport,
  ReportRange,
  ThroughputReport,
  WorkloadReport,
} from '../../../api/types'
import type { RootState } from '../../../store'
import {
  REPORT_NOTE_ADDED,
  REPORT_NOTE_REMOVED,
  REPORTS_FAILED,
  REPORTS_PROJECT_SELECTED,
  REPORTS_RECEIVED,
  REPORTS_REQUESTED,
} from './action-types'
import type { ReportNote, ReportsAction } from './types'

type ReportsThunk = ThunkAction<Promise<void>, RootState, unknown, AnyAction>

let noteSequence = 0

export function selectReportProject(projectKey: string): ReportsAction {
  return { type: REPORTS_PROJECT_SELECTED, projectKey }
}

export function addReportNote(text: string, authorName: string, range: ReportRange): ReportsAction {
  noteSequence += 1
  const note: ReportNote = { id: `note-${noteSequence}`, text, authorName, range }
  return { type: REPORT_NOTE_ADDED, note }
}

export function removeReportNote(id: string): ReportsAction {
  return { type: REPORT_NOTE_REMOVED, id }
}

export function loadReports(projectKey: string, range: ReportRange): ReportsThunk {
  return async (dispatch) => {
    dispatch({ type: REPORTS_REQUESTED, projectKey, range })
    const query = toQueryString({ project: projectKey, range })
    try {
      const [throughput, cycleTime, workload] = await Promise.all([
        request<ThroughputReport>(`/api/reports/throughput${query}`),
        request<CycleTimeReport>(`/api/reports/cycle-time${query}`),
        request<WorkloadReport>(`/api/reports/workload${toQueryString({ project: projectKey })}`),
      ])
      dispatch({ type: REPORTS_RECEIVED, throughput, cycleTime, workload })
    } catch (error) {
      dispatch({
        type: REPORTS_FAILED,
        error: error instanceof Error ? error.message : 'Failed to load reports',
      })
    }
  }
}
