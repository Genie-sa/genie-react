// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOM_SCAN_LIMIT, type DomBox, elementsWithBox } from './dom-box'

const SAVE: DomBox = { x: 8, y: 66.4375, width: 46.390625, height: 21 }

function placed(tag: string, box: DomBox, parent: Element = document.body): Element {
  const element = document.createElement(tag)
  parent.append(element)
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: box.x, y: box.y, width: box.width, height: box.height }),
  )
  return element
}

/** jsdom has no layout, so hit testing is given as the stack a browser would paint at the point, topmost first. */
function paintedAt(stack: () => Element[]): void {
  document.elementsFromPoint = () => stack()
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('elementsWithBox', () => {
  it('finds an element another element covers at the box centre', () => {
    const save = placed('button', SAVE)
    const overlay = placed('div', { x: 0, y: 0, width: 800, height: 600 })
    paintedAt(() => [overlay, save, document.body])

    expect(elementsWithBox(document, SAVE)).toEqual({ elements: [save], scanTruncated: false })
  })

  it('orders nested elements with one box innermost first', () => {
    const wrapper = placed('span', SAVE)
    const save = placed('button', SAVE, wrapper)
    paintedAt(() => [save, wrapper, document.body])

    expect(elementsWithBox(document, SAVE).elements).toEqual([save, wrapper])
  })

  it('tells apart elements that share the box by their innerHTML', () => {
    const section = placed('section', SAVE)
    const covered = placed('button', SAVE, section)
    covered.textContent = 'Covered'
    const overlay = placed('div', SAVE, section)
    paintedAt(() => [overlay, covered, section, document.body])

    expect(elementsWithBox(document, { ...SAVE, html: 'Covered' }).elements).toEqual([covered])
    expect(elementsWithBox(document, { ...SAVE, html: section.innerHTML }).elements).toEqual([
      section,
    ])
  })

  it('keeps every element with the box when none has that innerHTML any more', () => {
    const wrapper = placed('span', SAVE)
    const save = placed('button', SAVE, wrapper)
    paintedAt(() => [save, wrapper])

    expect(elementsWithBox(document, { ...SAVE, html: 'Saved!' }).elements).toEqual([save, wrapper])
  })

  it('scans the document for an element off screen, where nothing is painted at its centre', () => {
    const offscreen = { ...SAVE, y: 4200 }
    placed('button', SAVE)
    const below = placed('button', offscreen)
    const wrapper = placed('section', offscreen)
    const inner = placed('a', offscreen, wrapper)
    paintedAt(() => [])

    expect(elementsWithBox(document, offscreen)).toEqual({
      elements: [inner, wrapper, below],
      scanTruncated: false,
    })
  })

  it('scans the document when the element is not hit-testable, as with pointer-events: none', () => {
    const save = placed('button', SAVE)
    const label = placed('span', { ...SAVE, x: SAVE.x + 5 })
    paintedAt(() => [label, document.body])

    expect(elementsWithBox(document, SAVE).elements).toEqual([save])
  })

  it('accepts sub-pixel rounding but not an element that moved by a pixel', () => {
    const rounded = placed('button', { ...SAVE, y: SAVE.y + 0.5 })
    placed('button', { ...SAVE, y: SAVE.y + 1 })
    placed('button', { ...SAVE, width: SAVE.width - 1 })
    paintedAt(() => [])

    expect(elementsWithBox(document, SAVE).elements).toEqual([rounded])
  })

  it('reports no element, not a near one, when nothing has the box', () => {
    placed('button', SAVE)
    paintedAt(() => [])

    expect(elementsWithBox(document, { ...SAVE, x: 300 })).toEqual({
      elements: [],
      scanTruncated: false,
    })
  })

  it('rejects an empty box, which every hidden element shares', () => {
    placed('div', { x: 0, y: 0, width: 0, height: 0 })

    expect(() => elementsWithBox(document, { x: 0, y: 0, width: 0, height: 0 })).toThrow(
      /hidden or has no layout/,
    )
  })

  it('keeps a zero-width box that still has height', () => {
    const rule = placed('hr', { x: 10, y: 10, width: 0, height: 2 })
    paintedAt(() => [])

    expect(elementsWithBox(document, { x: 10, y: 10, width: 0, height: 2 }).elements).toEqual([
      rule,
    ])
  })

  it('says the scan was truncated when the element lies past the scan limit', () => {
    const filler = Array.from({ length: DOM_SCAN_LIMIT }, () => document.createElement('i'))
    document.body.append(...filler)
    placed('button', SAVE)
    paintedAt(() => [])

    expect(elementsWithBox(document, SAVE)).toEqual({ elements: [], scanTruncated: true })
  })
})
