import type { ReactNode } from 'react'

export function ProductDescription({ paragraphs }: { paragraphs: string[] }): ReactNode {
  return (
    <section className="product-description">
      <h2>About this piece</h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  )
}
