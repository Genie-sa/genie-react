import type { Product } from '../../api/types'

const GRAM_SIZE = 3

export interface ProductIndex {
  search: (term: string, limit: number) => Product[]
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function grams(value: string): string[] {
  const padded = ` ${value} `
  const result: string[] = []
  for (let index = 0; index <= padded.length - GRAM_SIZE; index++)
    result.push(padded.slice(index, index + GRAM_SIZE))
  return result
}

function deletionVariants(word: string): string[] {
  if (word.length < 4) return [word]
  return [word, ...Array.from(word, (_, index) => word.slice(0, index) + word.slice(index + 1))]
}

function addPosting(
  postings: Map<string, Map<number, number>>,
  key: string,
  position: number,
  weight: number,
): void {
  const posting = postings.get(key) ?? new Map<number, number>()
  posting.set(position, (posting.get(position) ?? 0) + weight)
  postings.set(key, posting)
}

export function buildProductIndex(products: readonly Product[]): ProductIndex {
  const gramPostings = new Map<string, Map<number, number>>()
  const wordPostings = new Map<string, Map<number, number>>()

  products.forEach((product, position) => {
    const text = normalize(`${product.name} ${product.sku} ${product.category}`)
    for (const gram of grams(text)) addPosting(gramPostings, gram, position, 1)
    for (const word of text.split(' ')) {
      for (const variant of deletionVariants(word))
        addPosting(wordPostings, variant, position, variant === word ? 4 : 2)
    }
  })

  return {
    search: (term, limit) => {
      const query = normalize(term)
      if (!query) return []
      const scores = new Map<number, number>()
      for (const gram of grams(query)) {
        for (const [position, weight] of gramPostings.get(gram) ?? [])
          scores.set(position, (scores.get(position) ?? 0) + weight)
      }
      for (const word of query.split(' ')) {
        for (const variant of deletionVariants(word)) {
          for (const [position, weight] of wordPostings.get(variant) ?? [])
            scores.set(position, (scores.get(position) ?? 0) + weight)
        }
      }
      return [...scores]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, limit)
        .flatMap(([position]) => {
          const product = products[position]
          return product ? [product] : []
        })
    },
  }
}
