import type { ReactNode } from 'react'

export function CareInstructions({ care }: { care: string[] }): ReactNode {
  return (
    <section>
      <h2>Care</h2>
      <ul className="care-list">
        {care.map((instruction) => (
          <li key={instruction}>{instruction}</li>
        ))}
      </ul>
    </section>
  )
}
