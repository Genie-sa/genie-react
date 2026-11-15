import { configureStore } from '@reduxjs/toolkit'
import { service } from '../api/service'
import reportsReducer from '../features/reports/state/reducer'
import board from './board'
import issues from './issues'
import notifications from './notifications'
import projects from './projects'
import savedViews from './saved-views'
import search from './search'
import session from './session'
import ui from './ui'

export const store = configureStore({
  reducer: {
    session,
    ui,
    projects,
    issues,
    board,
    notifications,
    search,
    savedViews,
    reports: reportsReducer,
    [service.reducerPath]: service.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    // Both checks walk the 3k-issue state on every dispatch, which made development builds unusable.
    getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }).concat(
      service.middleware,
    ),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
