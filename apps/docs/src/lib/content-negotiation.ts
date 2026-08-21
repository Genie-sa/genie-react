export type PageRepresentation = 'html' | 'markdown'

interface MediaRange {
  type: string
  subtype: string
  quality: number
}

export function parseAcceptHeader(header: string): MediaRange[] {
  const ranges: MediaRange[] = []

  for (const part of header.split(',')) {
    const [range = '', ...parameters] = part.trim().split(';')
    const [type, subtype] = range.trim().toLowerCase().split('/')
    if (!type || !subtype) continue

    let quality = 1
    for (const parameter of parameters) {
      const [key, value] = parameter.trim().split('=')
      if (key?.trim().toLowerCase() !== 'q') continue
      const parsed = Number.parseFloat(value ?? '')
      quality = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 1)
    }
    ranges.push({ type, subtype, quality })
  }

  return ranges
}

export function acceptedQuality(header: string | null, mediaType: string): number {
  if (header === null || header.trim() === '') return 1

  const [type, subtype] = mediaType.toLowerCase().split('/')
  let bestSpecificity = 0
  let quality = 0

  for (const range of parseAcceptHeader(header)) {
    const specificity =
      range.type === type && range.subtype === subtype
        ? 3
        : range.type === type && range.subtype === '*'
          ? 2
          : range.type === '*' && range.subtype === '*'
            ? 1
            : 0
    if (specificity === 0 || specificity < bestSpecificity) continue
    quality = specificity === bestSpecificity ? Math.max(quality, range.quality) : range.quality
    bestSpecificity = specificity
  }

  return quality
}

export function negotiatePageRepresentation(header: string | null): PageRepresentation | null {
  const html = acceptedQuality(header, 'text/html')
  const markdown = acceptedQuality(header, 'text/markdown')

  if (html === 0 && markdown === 0) return null
  return markdown > html ? 'markdown' : 'html'
}

export function prefersHtmlStrictly(header: string | null): boolean {
  return acceptedQuality(header, 'text/html') > acceptedQuality(header, 'text/markdown')
}
