import {
  createAsyncThunk,
  createEntityAdapter,
  createSlice,
  type EntityState,
  type PayloadAction,
} from '@reduxjs/toolkit'
import { request } from '../api/http'
import { service } from '../api/service'
import type { Issue, IssuePriority, IssueStatus } from '../api/types'
import { fetchBoard } from './board'

export type SortField = 'key' | 'title' | 'status' | 'priority' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'

export interface IssueFilters {
  text: string
  status: IssueStatus | 'all'
  priority: IssuePriority | 'all'
  assigneeId: string
  projectKey: string
}

export interface IssueSort {
  field: SortField
  direction: SortDirection
}

interface IssuesState extends EntityState<Issue> {
  status: 'idle' | 'loading' | 'ready' | 'failed'
  filters: IssueFilters
  sort: IssueSort
  page: number
  pageSize: number
  selectedIds: string[]
}

export const PAGE_SIZES = [50, 100, 250] as const
const DEFAULT_FILTERS: IssueFilters = {
  text: '',
  status: 'all',
  priority: 'all',
  assigneeId: 'all',
  projectKey: 'all',
}

export const issuesAdapter = createEntityAdapter<Issue>()

const initialState: IssuesState = issuesAdapter.getInitialState({
  status: 'idle',
  filters: DEFAULT_FILTERS,
  sort: { field: 'updatedAt', direction: 'desc' },
  page: 0,
  pageSize: 100,
  selectedIds: [],
})

export const fetchIssues = createAsyncThunk('issues/fetchAll', () =>
  request<Issue[]>('/api/issues'),
)

export const createIssue = createAsyncThunk(
  'issues/create',
  (draft: Pick<Issue, 'projectKey' | 'title' | 'description' | 'priority' | 'assigneeId'>) =>
    request<Issue>('/api/issues', { method: 'POST', body: JSON.stringify(draft) }),
)

export const updateIssueFields = createAsyncThunk(
  'issues/updateFields',
  ({ key, changes }: { key: string; changes: Partial<Issue> }) =>
    request<Issue>(`/api/issues/${key}`, { method: 'PATCH', body: JSON.stringify(changes) }),
)

const issuesSlice = createSlice({
  name: 'issues',
  initialState,
  reducers: {
    filtersChanged(state, action: PayloadAction<Partial<IssueFilters>>) {
      state.filters = { ...state.filters, ...action.payload }
      state.page = 0
    },
    filtersReset(state) {
      state.filters = DEFAULT_FILTERS
      state.page = 0
    },
    sortChanged(state, action: PayloadAction<SortField>) {
      state.sort =
        state.sort.field === action.payload
          ? { field: action.payload, direction: state.sort.direction === 'asc' ? 'desc' : 'asc' }
          : { field: action.payload, direction: 'asc' }
    },
    pageChanged(state, action: PayloadAction<number>) {
      state.page = action.payload
    },
    pageSizeChanged(state, action: PayloadAction<number>) {
      state.pageSize = action.payload
      state.page = 0
    },
    selectionToggled(state, action: PayloadAction<string>) {
      state.selectedIds = state.selectedIds.includes(action.payload)
        ? state.selectedIds.filter((id) => id !== action.payload)
        : [...state.selectedIds, action.payload]
    },
    selectionCleared(state) {
      state.selectedIds = []
    },
    viewApplied(state, action: PayloadAction<{ filters: IssueFilters; sort: IssueSort }>) {
      state.filters = action.payload.filters
      state.sort = action.payload.sort
      state.page = 0
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchIssues.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchIssues.fulfilled, (state, action) => {
        issuesAdapter.setAll(state, action.payload)
        state.status = 'ready'
      })
      .addCase(fetchIssues.rejected, (state) => {
        state.status = 'failed'
      })
      .addCase(fetchBoard.fulfilled, (state, action) => {
        issuesAdapter.upsertMany(state, action.payload)
      })
      .addCase(createIssue.fulfilled, (state, action) => {
        issuesAdapter.addOne(state, action.payload)
      })
      .addCase(updateIssueFields.fulfilled, (state, action) => {
        issuesAdapter.upsertOne(state, action.payload)
      })
      .addMatcher(service.endpoints.updateIssue.matchFulfilled, (state, action) => {
        issuesAdapter.upsertOne(state, action.payload)
      })
  },
})

export const {
  filtersChanged,
  filtersReset,
  pageChanged,
  pageSizeChanged,
  selectionCleared,
  selectionToggled,
  sortChanged,
  viewApplied,
} = issuesSlice.actions
export default issuesSlice.reducer
