import { useQuery } from '@tanstack/react-query'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/feedback'
import { cn } from '../../lib/cn'
import { carrierPerformanceQuery } from './dashboard-queries'

const ON_TIME_TARGET = 92

export function CarrierPerformanceCard() {
  const { data: carriers } = useQuery(carrierPerformanceQuery())
  return (
    <Card>
      <CardHeader title="Carrier performance" description="On-time delivery, last 30 days" />
      <CardBody className="p-0">
        {!carriers ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Carrier</th>
                <th className="px-4 py-2 text-right font-medium">Shipments</th>
                <th className="px-4 py-2 text-right font-medium">On time</th>
                <th className="px-4 py-2 text-right font-medium">Avg. transit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {carriers.map((carrier) => (
                <tr key={carrier.carrierId}>
                  <td className="px-4 py-2 font-medium">{carrier.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{carrier.shipments}</td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right tabular-nums',
                      (carrier.onTimeRate ?? 0) < ON_TIME_TARGET && 'text-amber-600',
                    )}
                  >
                    {carrier.onTimeRate!.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {carrier.averageTransitDays!.toFixed(1)} d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  )
}
