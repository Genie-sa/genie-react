import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/feedback'
import { customerQuery } from './customer-queries'
import { TierBadge } from './tier-badge'

export function RelatedAccounts({ ids }: { ids: readonly string[] }) {
  const related = useQueries({ queries: ids.map((id) => customerQuery(id)) })
  return (
    <Card>
      <CardHeader title="Related accounts" description="Shared billing or parent company" />
      <CardBody>
        <ul className="space-y-3">
          {related.map((result, index) => (
            <li key={ids[index]} className="flex items-center justify-between gap-2 text-sm">
              {result.data ? (
                <>
                  <Link
                    to="/customers/$customerId"
                    params={{ customerId: result.data.id }}
                    className="truncate font-medium text-indigo-600 hover:underline"
                  >
                    {result.data.name}
                  </Link>
                  <TierBadge tier={result.data.tier} />
                </>
              ) : (
                <Skeleton className="h-5 w-full" />
              )}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
