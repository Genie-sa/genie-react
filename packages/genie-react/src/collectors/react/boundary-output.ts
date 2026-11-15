import { type Fiber, isHostFiber } from 'bippy'
import { isHiddenOffscreen } from './suspense-debug-info'
import { isHostTextFiber } from './work-tags'

const HOST_SCAN_LIMIT = 2_000
const TEXT_LIMIT = 120

/** What a boundary puts on screen in place of its children. */
export interface RenderedOutput {
  /** nothing: no DOM at all, so the user sees no sign of the failure. empty: DOM without text or a box with size. visible: text or a sized box. unknown: the renderer has no DOM to read, as on React Native. */
  output: 'nothing' | 'empty' | 'visible' | 'unknown'
  hostNodes: number
  text: string | null
}

function isVisibleElement(node: Element): boolean {
  try {
    if (typeof node.checkVisibility === 'function' && !node.checkVisibility()) return false
    const box = node.getBoundingClientRect()
    return box.width > 0 && box.height > 0
  } catch {
    return false
  }
}

function visibleText(node: Node): string {
  const parent = node.nodeType === 3 ? node.parentElement : (node as Element)
  try {
    if (parent && typeof parent.checkVisibility === 'function' && !parent.checkVisibility())
      return ''
  } catch {
    return ''
  }
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The top-level DOM nodes a fiber's subtree commits, without descending into hidden Offscreen content such as a Suspense boundary's hidden children. */
function topHostNodes(fiber: Fiber): Node[] {
  const nodes: Node[] = []
  const stack: Fiber[] = fiber.child ? [fiber.child] : []
  let visited = 0
  while (stack.length > 0 && visited < HOST_SCAN_LIMIT) {
    const node = stack.pop() as Fiber
    visited += 1
    if (node.sibling) stack.push(node.sibling)
    if (isHiddenOffscreen(node)) continue
    if (isHostFiber(node) || isHostTextFiber(node)) {
      if (node.stateNode instanceof Node) nodes.push(node.stateNode)
      continue
    }
    if (node.child) stack.push(node.child)
  }
  return nodes
}

/** Reads the committed DOM below a boundary, so a boundary that swallowed an error and renders nothing can be told from one showing a message. */
export function renderedOutputOf(boundary: Fiber): RenderedOutput {
  if (typeof Node === 'undefined') return { output: 'unknown', hostNodes: 0, text: null }
  const nodes = topHostNodes(boundary)
  const text = nodes.map(visibleText).filter(Boolean).join(' ').trim()
  const sized = nodes.some((node) => node.nodeType === 1 && isVisibleElement(node as Element))
  return {
    output: nodes.length === 0 ? 'nothing' : text || sized ? 'visible' : 'empty',
    hostNodes: nodes.length,
    text: text ? text.slice(0, TEXT_LIMIT) : null,
  }
}
