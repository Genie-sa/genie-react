import type { ReactNode } from 'react'

const LOW_STOCK_THRESHOLD = 3

export function StockStatus({ stock }: { stock: number | null }): ReactNode {
  if (stock === null) return <p className="stock muted">Choose a size to check stock</p>
  if (stock === 0) return <p className="stock stock-out">Sold out</p>
  if (stock <= LOW_STOCK_THRESHOLD) return <p className="stock stock-low">Only {stock} left</p>
  return <p className="stock stock-in">In stock</p>
}
