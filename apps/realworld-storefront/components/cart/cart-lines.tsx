'use client'

import { type ReactNode, useOptimistic, useState, useTransition } from 'react'
import { updateLineQuantity } from '../../lib/actions/cart'
import type { CartLineView, CartView } from '../../lib/data/types'
import { CartLineRow } from './cart-line-row'
import { CartSummary } from './cart-summary'

interface LineChange {
  variantId: string
  quantity: number
}

function applyLineChange(lines: CartLineView[], change: LineChange): CartLineView[] {
  if (change.quantity <= 0) return lines.filter((line) => line.variantId !== change.variantId)
  return lines.map((line) =>
    line.variantId === change.variantId
      ? { ...line, quantity: change.quantity, lineCents: line.unitCents * change.quantity }
      : line,
  )
}

export function CartLines({ cart }: { cart: CartView }): ReactNode {
  const [lines, setLines] = useState(cart.lines)
  const [optimisticLines, applyOptimisticChange] = useOptimistic(lines, applyLineChange)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const changeQuantity = (variantId: string, quantity: number) => {
    setNotice(null)
    startTransition(async () => {
      applyOptimisticChange({ variantId, quantity })
      const result = await updateLineQuantity(variantId, quantity)
      if (!result.ok) setNotice(result.message)
      setLines((current) => applyLineChange(current, { variantId, quantity }))
    })
  }

  return (
    <div className="cart-layout">
      <div>
        {notice ? (
          <p role="alert" className="notice">
            {notice}
          </p>
        ) : null}
        <ul className="cart-lines" aria-busy={isPending}>
          {optimisticLines.map((line) => (
            <CartLineRow key={line.variantId} line={line} onChangeQuantity={changeQuantity} />
          ))}
        </ul>
      </div>
      <CartSummary
        lines={optimisticLines}
        discountCents={cart.discountCents}
        promoCode={cart.promoCode}
      />
    </div>
  )
}
