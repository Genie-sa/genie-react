import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { request } from '../api/http'
import type { Notification, NotificationFeed } from '../api/types'

interface NotificationsState {
  items: Notification[]
  unreadCount: number
  lastFetchedAt: number | null
  failures: number
}

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  lastFetchedAt: null,
  failures: 0,
}

export const fetchNotifications = createAsyncThunk('notifications/fetch', () =>
  request<NotificationFeed>('/api/notifications'),
)

export const markAllRead = createAsyncThunk('notifications/markAllRead', () =>
  request<{ ok: boolean }>('/api/notifications/read', { method: 'POST', body: '{}' }),
)

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.items = action.payload.items
        state.unreadCount = action.payload.unreadCount
        state.lastFetchedAt = Date.now()
        state.failures = 0
      })
      .addCase(fetchNotifications.rejected, (state) => {
        state.failures += 1
      })
      .addCase(markAllRead.fulfilled, (state) => {
        state.unreadCount = 0
        for (const item of state.items) item.read = true
      })
  },
})

export default notificationsSlice.reducer
