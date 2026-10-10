import { useCartStore } from './cartStore'

export function CartSummary() {
  const { count, total } = useCartStore((state) => ({
    count: state.items.length,
    total: state.items.reduce((sum, item) => sum + item.price, 0),
  }))

  return (
    <p>
      {count} items · ${total}
    </p>
  )
}
