import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/login-page'
import { RequireAuth } from './features/auth/require-auth'
import { BoardPage } from './features/board/board-page'
import { IssueDetailPage } from './features/issue-detail/issue-detail-page'
import { IssuesPage } from './features/issues/issues-page'
import AppShell from './layout/app-shell'

const ReportsPage = lazy(
  () => import(/* webpackChunkName: "reports" */ './features/reports/reports-page'),
)
const SettingsPage = lazy(
  () => import(/* webpackChunkName: "settings" */ './features/settings/settings-page'),
)

export function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/board" replace />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="issues/:issueKey" element={<IssueDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/board" replace />} />
      </Routes>
    </Suspense>
  )
}
