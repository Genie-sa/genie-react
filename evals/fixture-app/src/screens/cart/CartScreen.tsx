import { CartSummary } from './CartSummary'
import { cartStore, useCartStore } from './cartStore'

function CartItems() {
  const items = useCartStore((state) => state.items)
  return (
    <ul>
      {items.map((item) => (
        <li key={item.sku}>
          {item.name} — ${item.price}
        </li>
      ))}
    </ul>
  )
}

function OrderNotes() {
  const notes = useCartStore((state) => state.notes)
  return (
    <label>
      Order notes{' '}
      <textarea
        aria-label="Order notes"
        value={notes}
        onChange={(event) => cartStore.setState({ notes: event.target.value })}
      />
    </label>
  )
}

export function CartScreen() {
  return (
    <section className="card">
      <header className="row">
        <h1>Cart</h1>
        <CartSummary />
      </header>
      <CartItems />
      <OrderNotes />
    </section>
  )
}
