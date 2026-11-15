export interface DomBox {
  x: number
  y: number
  width: number
  height: number
  /** The element's innerHTML, which separates elements that share the box. */
  html?: string
}

export interface DomMatch {
  elements: Element[]
  scanTruncated: boolean
}

/** Absorbs sub-pixel rounding between two reads of one layout; an element that moved or resized differs by more. */
const BOX_TOLERANCE_PX = 0.5
export const DOM_SCAN_LIMIT = 5000

/** Elements whose border box is `box`, innermost first: those under its centre when that point is on screen, else the first {@link DOM_SCAN_LIMIT} elements of the document. With `box.html`, only those whose innerHTML equals it, unless none does. */
export function elementsWithBox(doc: Document, box: DomBox): DomMatch {
  const match = elementsAtBox(doc, box)
  const { html } = box
  if (html === undefined) return match
  const same = match.elements.filter((element) => element.innerHTML === html)
  return same.length > 0 ? { ...match, elements: same } : match
}

function elementsAtBox(doc: Document, box: DomBox): DomMatch {
  if (box.width === 0 && box.height === 0) {
    throw new Error(
      'The box is 0×0: the element is hidden or has no layout, so its box names no single element. Pass a CSS selector instead.',
    )
  }
  const fits = (element: Element): boolean => sameBox(element.getBoundingClientRect(), box)
  const underCentre =
    typeof doc.elementsFromPoint === 'function'
      ? doc.elementsFromPoint(box.x + box.width / 2, box.y + box.height / 2).filter(fits)
      : []
  if (underCentre.length > 0) return { elements: underCentre, scanTruncated: false }
  const all = Array.from(doc.getElementsByTagName('*'))
  return {
    elements: all.slice(0, DOM_SCAN_LIMIT).filter(fits).reverse(),
    scanTruncated: all.length > DOM_SCAN_LIMIT,
  }
}

function sameBox(rect: DOMRect, box: DomBox): boolean {
  return (
    Math.abs(rect.x - box.x) <= BOX_TOLERANCE_PX &&
    Math.abs(rect.y - box.y) <= BOX_TOLERANCE_PX &&
    Math.abs(rect.width - box.width) <= BOX_TOLERANCE_PX &&
    Math.abs(rect.height - box.height) <= BOX_TOLERANCE_PX
  )
}
