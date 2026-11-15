import { useEffect } from 'react'
import { PageHeader } from '../../components/page-header'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchIssues } from '../../store/issues'
import IssueTable from './issue-table'
import { IssueTableToolbar } from './issue-table-toolbar'
import { SavedViews } from './saved-views'
import StatusSummary from './status-summary'

export function IssuesPage() {
  const dispatch = useAppDispatch()
  const status = useAppSelector((state) => state.issues.status)

  useEffect(() => {
    if (status === 'idle') dispatch(fetchIssues())
  }, [dispatch, status])

  return (
    <div className="issues-page">
      <PageHeader title="All issues" actions={<StatusSummary />} />
      <IssueTableToolbar />
      <SavedViews />
      <IssueTable />
    </div>
  )
}
