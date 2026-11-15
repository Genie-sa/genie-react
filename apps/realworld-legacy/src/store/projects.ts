import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { request } from '../api/http'
import type { Project } from '../api/types'

interface ProjectsState {
  byKey: Record<string, Project>
  status: 'idle' | 'loading' | 'ready' | 'failed'
}

const initialState: ProjectsState = { byKey: {}, status: 'idle' }

export const fetchProjects = createAsyncThunk('projects/fetch', () =>
  request<Project[]>('/api/projects'),
)

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.byKey = Object.fromEntries(action.payload.map((project) => [project.key, project]))
        state.status = 'ready'
      })
      .addCase(fetchProjects.rejected, (state) => {
        state.status = 'failed'
      })
  },
})

export default projectsSlice.reducer
