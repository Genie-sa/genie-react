import type { AnyAction } from '@reduxjs/toolkit'
import {
  REPORT_NOTE_ADDED,
  REPORT_NOTE_REMOVED,
  REPORTS_FAILED,
  REPORTS_PROJECT_SELECTED,
  REPORTS_RECEIVED,
  REPORTS_REQUESTED,
} from './action-types'
import type { ReportsAction, ReportsState } from './types'

const initialState: ReportsState = {
  projectKey: 'CORE',
  range: '30d',
  status: 'idle',
  throughput: null,
  cycleTime: null,
  workload: null,
  error: null,
  notes: [],
}

export default function reportsReducer(
  state: ReportsState = initialState,
  incoming: AnyAction,
): ReportsState {
  const action = incoming as ReportsAction
  switch (action.type) {
    case REPORTS_PROJECT_SELECTED:
      return { ...state, projectKey: action.projectKey }
    case REPORTS_REQUESTED:
      return {
        ...state,
        projectKey: action.projectKey,
        range: action.range,
        status: 'loading',
        error: null,
      }
    case REPORTS_RECEIVED:
      return {
        ...state,
        status: 'ready',
        throughput: action.throughput,
        cycleTime: action.cycleTime,
        workload: action.workload,
      }
    case REPORTS_FAILED:
      return { ...state, status: 'failed', error: action.error }
    case REPORT_NOTE_ADDED:
      state.notes.push(action.note)
      return state
    case REPORT_NOTE_REMOVED:
      return { ...state, notes: state.notes.filter((note) => note.id !== action.id) }
    default:
      return state
  }
}
