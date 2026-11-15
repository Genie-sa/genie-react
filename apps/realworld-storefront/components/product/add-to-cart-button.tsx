'use client'

import { type ReactNode, useState, useTransition } from 'react'
import { addToCart } from '../../lib/actions/cart'

type Feedback = { tone: 'success' | 'error'; message: string } | null

export function AddToCartButton({
  variantId,
  disabled,
}: {
  variantId: string | null
  disabled: boolean
}): ReactNode {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback>(null)

  const add = () => {
    if (!variantId) return
    startTransition(async () => {
      const result = await addToCart(variantId, 1)
      setFeedback(
        result.ok
          ? { tone: 'success', message: 'Added to your bag.' }
          : { tone: 'error', message: result.message },
      )
    })
  }

  return (
    <div className="add-to-cart">
      <button
        type="button"
        className="button button-wide"
        disabled={disabled || !variantId || isPending}
        onClick={add}
      >
        {isPending ? 'Adding…' : 'Add to bag'}
      </button>
      {feedback ? (
        <p
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          className={`feedback-${feedback.tone}`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  )
}
