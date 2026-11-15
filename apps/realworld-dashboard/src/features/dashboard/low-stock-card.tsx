import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Badge } from '../../components/ui/badge'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/feedback'
import { stockSummaryQuery } from './dashboard-queries'

export function LowStockCard() {
  const { data } = useQuery(stockSummaryQuery())
  return (
    <Card>
      <CardHeader
        title="Inventory health"
        description="SKUs below their reorder point"
        actions={
          <Link
            to="/inventory"
            search={{ low: true }}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            View all
          </Link>
        }
      />
      <CardBody>
        {!data ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            <div className="flex gap-6">
              <div>
                <p data-testid="low-stock-count" className="text-2xl font-semibold tabular-nums">
                  {data.lowStock}
                </p>
                <p className="text-xs text-slate-500">Low stock</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{data.outOfStock}</p>
                <p className="text-xs text-slate-500">Out of stock</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {data.items.map((item) => (
                <li key={item.productId} className="flex items-center justify-between gap-2">
                  <span className="truncate">{item.name}</span>
                  <Badge tone={item.totalOnHand === 0 ? 'danger' : 'warning'}>
                    {item.totalOnHand} / {item.reorderPoint}
                  </Badge>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  )
}
