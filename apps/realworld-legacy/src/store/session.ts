import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { request, tokenStorage } from '../api/http'
import { service } from '../api/service'
import type { User } from '../api/types'

export interface Credentials {
  email: string
  password: string
}

interface SessionState {
  user: User | null
  status: 'unknown' | 'restoring' | 'signed-in' | 'signed-out'
  error: string | null
}

const initialState: SessionState = {
  user: null,
  status: tokenStorage.read() ? 'unknown' : 'signed-out',
  error: null,
}

export const restoreSession = createAsyncThunk('session/restore', async () => {
  const { user } = await request<{ user: User }>('/api/session')
  return user
})

export const signIn = createAsyncThunk('session/signIn', async (credentials: Credentials) => {
  const { token, user } = await request<{ token: string; user: User }>('/api/session', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
  tokenStorage.write(token)
  return user
})

export const signOut = createAsyncThunk('session/signOut', async (_: void, { dispatch }) => {
  await request<void>('/api/session', { method: 'DELETE' }).catch(() => undefined)
  tokenStorage.clear()
  dispatch(service.util.resetApiState())
})

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (state) => {
        state.status = 'restoring'
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'signed-in'
      })
      .addCase(restoreSession.rejected, (state) => {
        tokenStorage.clear()
        state.user = null
        state.status = 'signed-out'
      })
      .addCase(signIn.pending, (state) => {
        state.error = null
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = 'signed-in'
      })
      .addCase(signIn.rejected, (state, action) => {
        state.error = action.error.message ?? 'Sign in failed'
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user = null
        state.status = 'signed-out'
      })
  },
})

export default sessionSlice.reducer
