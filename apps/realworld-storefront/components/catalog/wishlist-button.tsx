import type { ReactNode } from 'react'

export function WishlistButton({
  productName,
  isSaved,
  onToggle,
}: {
  productName: string
  isSaved: boolean
  onToggle: () => void
}): ReactNode {
  return (
    <button
      type="button"
      className="wishlist-button"
      aria-pressed={isSaved}
      aria-label={
        isSaved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`
      }
      onClick={onToggle}
    >
      {isSaved ? '♥' : '♡'}
    </button>
  )
}
