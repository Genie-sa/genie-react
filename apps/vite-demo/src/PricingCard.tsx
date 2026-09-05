import * as stylex from '@stylexjs/stylex'
import { useState, type ReactNode } from 'react'

const styles = stylex.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderColor: {
      default: '#3a3a5c',
      ':hover': '#9aa0ff',
    },
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'grid',
    gap: {
      default: 8,
      '@media (min-width: 48rem)': 12,
    },
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
  progress: (value: number) => ({
    width: `${value}%`,
  }),
  track: {
    backgroundColor: '#3a3a5c',
    height: 6,
  },
  fill: {
    backgroundColor: '#e4511e',
    height: 6,
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
        <div {...stylex.props(styles.track)}>
          <div {...stylex.props(styles.fill, styles.progress(featured ? 80 : 35))} />
        </div>
      </article>
      <button type="button" onClick={() => setFeatured((current) => !current)}>
        toggle featured
      </button>
    </section>
  )
}
