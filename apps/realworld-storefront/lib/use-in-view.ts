'use client'

import { type RefCallback, useCallback, useState } from 'react'

export function useInView<T extends Element>(rootMargin = '200px'): [RefCallback<T>, boolean] {
  const [isInView, setInView] = useState(false)
  const ref = useCallback<RefCallback<T>>(
    (node) => {
      if (!node) return
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setInView(true)
            observer.disconnect()
          }
        },
        { rootMargin },
      )
      observer.observe(node)
      return () => observer.disconnect()
    },
    [rootMargin],
  )
  return [ref, isInView]
}
