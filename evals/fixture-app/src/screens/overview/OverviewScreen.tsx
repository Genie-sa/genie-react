import { useState } from 'react'
import { useOpenOrderCount } from './orderQueries'

function OpenOrdersCard() {
  const { data: count, isPending } = useOpenOrderCount()
  return (
    <article className="card">
      <h2>Open orders</h2>
      <strong>{isPending ? '…' : count}</strong>
    </article>
  )
}

function InventoryCard() {
  return (
    <article className="card">
      <h2>Inventory</h2>
      <p>All warehouses synced.</p>
    </article>
  )
}

export function OverviewScreen() {
  const [tab, setTab] = useState<'orders' | 'inventory'>('orders')
  return (
    <section>
      <h1>Overview</h1>
      <div className="row" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'orders'}
          onClick={() => setTab('orders')}
        >
          Orders
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inventory'}
          onClick={() => setTab('inventory')}
        >
          Inventory
        </button>
      </div>
      {tab === 'orders' ? <OpenOrdersCard /> : <InventoryCard />}
    </section>
  )
}
