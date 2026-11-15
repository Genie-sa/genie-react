import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../api/endpoints'
import { usePreferences } from '../../app/preferences'
import { Card, CardHeader } from '../../components/ui/card'
import { ErrorPanel, PageSpinner } from '../../components/ui/feedback'
import { Pagination } from '../../components/ui/pagination'

export function AuditLogPanel() {
  const { formatDateTime } = usePreferences()
  const [page, setPage] = useState(1)
  const audit = useQuery({
    queryKey: ['settings', 'audit', page],
    queryFn: ({ signal }) => api.auditLog(page, signal),
    placeholderData: keepPreviousData,
  })

  return (
    <Card>
      <CardHeader title="Audit log" description="Every change made in Meridian Ops, newest first" />
      {audit.isPending ? (
        <PageSpinner />
      ) : audit.isError ? (
        <div className="p-4">
          <ErrorPanel
            title="Audit log could not be loaded"
            message={audit.error.message}
            onRetry={() => void audit.refetch()}
          />
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {audit.data.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                    {formatDateTime(entry.at)}
                  </td>
                  <td className="px-4 py-2 font-medium">{entry.actor}</td>
                  <td className="px-4 py-2">{entry.action}</td>
                  <td className="px-4 py-2 font-mono text-xs">{entry.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageSize={audit.data.pageSize}
            total={audit.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </Card>
  )
}
