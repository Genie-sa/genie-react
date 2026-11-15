import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { Product } from '../../api/types'
import { usePreferences } from '../../app/preferences'
import { Input } from '../../components/ui/form-controls'
import { buildProductIndex } from './product-index'

const RESULT_LIMIT = 8
const MIN_TERM_LENGTH = 2

export function ProductPicker({
  products,
  selectedIds,
  onPick,
}: {
  products: readonly Product[]
  selectedIds: readonly string[]
  onPick: (product: Product) => void
}) {
  const { formatMoney } = usePreferences()
  const [term, setTerm] = useState('')
  const index = buildProductIndex(products)
  const matches = term.trim().length < MIN_TERM_LENGTH ? [] : index.search(term, RESULT_LIMIT)

  return (
    <div className="space-y-2">
      <Input
        aria-label="Find a product"
        placeholder="Search by product name or SKU"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />
      {matches.length > 0 && (
        <ul
          aria-label="Product matches"
          className="divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700"
        >
          {matches.map((product) => {
            const added = selectedIds.includes(product.id)
            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => {
                    onPick(product)
                    setTerm('')
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                >
                  <Plus className="size-4 text-slate-400" />
                  <span className="flex-1">
                    <span className="font-medium">{product.name}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">{product.sku}</span>
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {formatMoney(product.unitPrice)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
