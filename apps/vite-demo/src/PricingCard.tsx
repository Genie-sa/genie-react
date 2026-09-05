import * as stylex from '@stylexjs/stylex'
import { useState, type ReactNode } from 'react'

const styles = stylex.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderColor: '#3a3a5c',
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'grid',
    gap: 8,
    maxWidth: 360,
    padding: 20,
  },
  title: {
    color: '#f5f5f5',
    fontSize: 20,
    marginBlock: 0,
  },
  price: {
    color: '#9aa0ff',
    fontSize: 28,
    fontWeight: 700,
  },
})

const emphasis = stylex.create({
  featured: {
    borderColor: '#e4511e',
    padding: 28,
  },
})

export function PricingCard(): ReactNode {
  const [featured, setFeatured] = useState(false)
  return (
    <section id="pricing">
      <h2>StyleX pricing card</h2>
      <article {...stylex.props(styles.card, featured && emphasis.featured)}>
        <h3 {...stylex.props(styles.title)}>Pro plan</h3>
        <p {...stylex.props(styles.price)}>$12/mo</p>
      </article>
      <button type="button" onClick={() => setFeatured((current) => !current)}>
        toggle featured
      </button>
    </section>
  )
}
