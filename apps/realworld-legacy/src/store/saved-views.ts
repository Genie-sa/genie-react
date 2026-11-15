import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type { IssueFilters, IssueSort } from './issues'

export interface SavedView {
  id: string
  name: string
  filters: IssueFilters
  sort: IssueSort
}

interface SavedViewsState {
  draftName: string
  views: SavedView[]
}

const initialState: SavedViewsState = { draftName: '', views: [] }

const savedViewsSlice = createSlice({
  name: 'savedViews',
  initialState,
  reducers: {
    draftNameChanged(state, action: PayloadAction<string>) {
      state.draftName = action.payload
    },
    viewSaved: {
      reducer(state, action: PayloadAction<SavedView>) {
        state.views.push(action.payload)
        state.draftName = ''
      },
      prepare: (name: string, filters: IssueFilters, sort: IssueSort) => ({
        payload: { id: nanoid(), name, filters, sort },
      }),
    },
    viewDeleted(state, action: PayloadAction<string>) {
      state.views = state.views.filter((view) => view.id !== action.payload)
    },
  },
})

export const { draftNameChanged, viewDeleted, viewSaved } = savedViewsSlice.actions
export default savedViewsSlice.reducer
