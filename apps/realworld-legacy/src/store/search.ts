import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { request, toQueryString } from '../api/http'
import type { Issue, SearchResults } from '../api/types'

interface SearchState {
  query: string
  results: Issue[]
  total: number
  status: 'idle' | 'loading' | 'ready' | 'failed'
  latestRequestId: string | null
}

const initialState: SearchState = {
  query: '',
  results: [],
  total: 0,
  status: 'idle',
  latestRequestId: null,
}

export const searchIssues = createAsyncThunk('search/run', (query: string) =>
  request<SearchResults>(`/api/search${toQueryString({ q: query })}`),
)

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(searchIssues.pending, (state, action) => {
        state.status = 'loading'
        state.latestRequestId = action.meta.requestId
      })
      .addCase(searchIssues.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) return
        state.query = action.payload.query
        state.results = action.payload.items
        state.total = action.payload.total
        state.status = 'ready'
      })
      .addCase(searchIssues.rejected, (state, action) => {
        if (action.meta.requestId === state.latestRequestId) state.status = 'failed'
      })
  },
})

export default searchSlice.reducer
