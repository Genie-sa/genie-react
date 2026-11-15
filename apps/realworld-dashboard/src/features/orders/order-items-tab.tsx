import type { Order } from '../../api/types'
import { usePreferences } from '../../app/preferences'
import { Card } from '../../components/ui/card'

export function OrderItemsTab({ order }: { order: Order }) {
  const { formatMoney } = usePreferences()
  return (
    <Card>
      <table className="w-full text-sm">
        <thead className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800">
          <tr>
            <th className="px-4 py-2 font-medium">SKU</th>
            <th className="px-4 py-2 font-medium">Product</th>
            <th className="px-4 py-2 text-right font-medium">Qty</th>
            <th className="px-4 py-2 text-right font-medium">Unit price</th>
            <th className="px-4 py-2 text-right font-medium">Line total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {order.lines.map((line) => (
            <tr key={`${line.productId}-${line.quantity}`}>
              <td className="px-4 py-2 font-mono text-xs">{line.sku}</td>
              <td className="px-4 py-2">{line.name}</td>
              <td className="px-4 py-2 text-right tabular-nums">{line.quantity}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatMoney(line.unitPrice)}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatMoney(line.unitPrice * line.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
            <td colSpan={4} className="px-4 py-2 text-right">
              Total
            </td>
            <td className="px-4 py-2 text-right tabular-nums">{formatMoney(order.total)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  )
}
