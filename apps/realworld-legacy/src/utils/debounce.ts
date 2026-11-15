export interface Debounced<A extends unknown[]> {
  (...args: A): void
  cancel: () => void
}

export function debounce<A extends unknown[]>(
  callback: (...args: A) => void,
  waitMs: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const debounced = (...args: A) => {
    clearTimeout(timer)
    timer = setTimeout(() => callback(...args), waitMs)
  }
  debounced.cancel = () => clearTimeout(timer)
  return debounced
}
