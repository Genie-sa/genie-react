import type { RootState } from '../../../store'

export const selectReportNotes = (state: RootState) => state.reports.notes
