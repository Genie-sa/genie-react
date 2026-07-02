'use client'

import { useState } from 'react'

const INITIAL_ITEMS = ['Inspect the tree', 'Trace a render', 'Audit an effect']

export function ItemList() {
  const [items, setItems] = useState(INITIAL_ITEMS)
  return (
    <section>
      <h2>Checklist</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setItems((current) => [...current, `Task ${current.length + 1}`])}
      >
        Add task
      </button>
    </section>
  )
}
