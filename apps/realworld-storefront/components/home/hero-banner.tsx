import Link from 'next/link'
import type { ReactNode } from 'react'

export function HeroBanner(): ReactNode {
  return (
    <section className="hero">
      <p className="eyebrow">Winter 2026</p>
      <h1>Layers that last the season, and the next ten.</h1>
      <p>Waxed cotton, boiled wool and recycled down, made in small runs and repaired for free.</p>
      <div className="hero-actions">
        <Link className="button" href="/category/outerwear">
          Shop outerwear
        </Link>
        <Link className="button button-ghost" href="/category/knitwear">
          Browse knitwear
        </Link>
      </div>
    </section>
  )
}
