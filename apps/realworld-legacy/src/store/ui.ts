import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'

export interface Toast {
  id: string
  tone: 'info' | 'success' | 'error'
  message: string
}

interface UiState {
  sidebarCollapsed: boolean
  notificationsOpen: boolean
  createIssueOpen: boolean
  toasts: Toast[]
}

const initialState: UiState = {
  sidebarCollapsed: false,
  notificationsOpen: false,
  createIssueOpen: false,
  toasts: [],
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    sidebarToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    notificationsToggled(state, action: PayloadAction<boolean | undefined>) {
      state.notificationsOpen = action.payload ?? !state.notificationsOpen
    },
    createIssueToggled(state, action: PayloadAction<boolean>) {
      state.createIssueOpen = action.payload
    },
    toastShown: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload)
      },
      prepare: (tone: Toast['tone'], message: string) => ({
        payload: { id: nanoid(), tone, message },
      }),
    },
    toastDismissed(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload)
    },
  },
})

export const {
  createIssueToggled,
  notificationsToggled,
  sidebarToggled,
  toastDismissed,
  toastShown,
} = uiSlice.actions
export default uiSlice.reducer
