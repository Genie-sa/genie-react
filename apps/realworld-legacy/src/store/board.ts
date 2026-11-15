import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { request } from '../api/http'
import type { Issue } from '../api/types'

interface BoardState {
  projectKey: string
  quickFilter: string
  status: 'idle' | 'loading' | 'ready' | 'failed'
}

const initialState: BoardState = { projectKey: 'CORE', quickFilter: '', status: 'idle' }

export const fetchBoard = createAsyncThunk('board/fetch', (projectKey: string) =>
  request<Issue[]>(`/api/issues?project=${encodeURIComponent(projectKey)}`),
)

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    boardProjectChanged(state, action: PayloadAction<string>) {
      state.projectKey = action.payload
      state.quickFilter = ''
    },
    quickFilterChanged(state, action: PayloadAction<string>) {
      state.quickFilter = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoard.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchBoard.fulfilled, (state) => {
        state.status = 'ready'
      })
      .addCase(fetchBoard.rejected, (state) => {
        state.status = 'failed'
      })
  },
})

export const { boardProjectChanged, quickFilterChanged } = boardSlice.actions
export default boardSlice.reducer
