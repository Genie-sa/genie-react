'use client'

import { useEffect, useState } from 'react'

const FRUIT = ['apple', 'apricot', 'banana', 'cherry', 'grape', 'mango', 'peach', 'pear']

export function EffectDemo() {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState(FRUIT)

  useEffect(() => {
    const timer = setTimeout(() => {
      setMatches(FRUIT.filter((fruit) => fruit.includes(query.toLowerCase())))
    }, 50)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <section>
      <h2>Fruit search</h2>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter fruit…"
        aria-label="Filter fruit"
      />
      <p data-testid="matches">{matches.length ? matches.join(', ') : 'no matches'}</p>
    </section>
  )
}
