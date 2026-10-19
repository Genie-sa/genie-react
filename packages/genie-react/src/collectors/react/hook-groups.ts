import type { HooksNode } from 'bippy/source'
import { MAX_CUSTOM_HOOK_DEPTH } from './contracts'
import type { HookKind } from './fiber'

// Fiber hook slots each primitive allocates (React 18/19 client renders); unlisted primitives allocate one. Zero-slot primitives (useContext, useDebugValue, use) need no entry: the hook tree gives them a null id.
const MULTI_SLOT_PRIMITIVES: Readonly<Record<string, number>> = {
  Transition: 2,
  SyncExternalStore: 2,
  ActionState: 3,
  FormState: 3,
}
// useDeferredValue was useState + useEffect in early React 18 releases (two slots) and one slot from 18.3 on. Alignment tries both.
const SLOT_LAYOUTS: ReadonlyArray<Readonly<Record<string, number>>> = [
  MULTI_SLOT_PRIMITIVES,
  { ...MULTI_SLOT_PRIMITIVES, DeferredValue: 2 },
]

const EXPECTED_KINDS: Readonly<Record<string, readonly HookKind[]>> = {
  State: ['state'],
  Reducer: ['reducer'],
  Effect: ['effect'],
  LayoutEffect: ['layout-effect'],
  Memo: ['memo', 'callback'],
  Callback: ['memo', 'callback'],
  Ref: ['ref'],
}

interface Primitive {
  id: number
  name: string
  customHooks: string[]
}

/** A slot's custom-hook chain, outermost first; null for a slot whose primitive the hook tree omits (useEffectEvent), so its chain is unknown. */
export type CustomHookChain = string[] | null

/** Each fiber hook slot's custom-hook chain, or null unless the hook tree accounts for every slot with a matching kind. */
export function customHookChains(
  tree: HooksNode[],
  slotKinds: readonly HookKind[],
  truncated: boolean,
): CustomHookChain[] | null {
  const primitives = slotAllocatingPrimitives(tree)
  for (const layout of SLOT_LAYOUTS) {
    const chains = alignSlots(primitives, slotKinds, truncated, layout)
    if (chains) return chains
  }
  return null
}

// Repeated calls from one callsite (a loop) make the inspector wrap them in a phantom custom hook named after the primitive itself.
const isPhantomPrimitiveWrapper = (node: HooksNode): boolean =>
  node.subHooks.every((child) => child.subHooks.length === 0 && child.name === node.name)

// The tree strips "use" from names and also lists plain helper functions, so the first child's callsite frame gives the real name.
function customHookName(node: HooksNode): string {
  const frameName = node.subHooks[0]?.hookSource?.functionName
  return frameName?.slice(frameName.lastIndexOf('.') + 1) || `use${node.name}`
}

function slotAllocatingPrimitives(tree: HooksNode[]): Primitive[] {
  const primitives: Primitive[] = []
  const visit = (nodes: HooksNode[], customHooks: string[]): void => {
    for (const node of nodes) {
      if (node.subHooks.length > 0) {
        visit(
          node.subHooks,
          isPhantomPrimitiveWrapper(node)
            ? customHooks
            : [...customHooks, customHookName(node)].slice(0, MAX_CUSTOM_HOOK_DEPTH),
        )
      } else if (node.id !== null) {
        primitives.push({ id: node.id, name: node.name, customHooks })
      }
    }
  }
  visit(tree, [])
  return primitives
}

function alignSlots(
  primitives: readonly Primitive[],
  slotKinds: readonly HookKind[],
  truncated: boolean,
  layout: Readonly<Record<string, number>>,
): CustomHookChain[] | null {
  const chains: CustomHookChain[] = []
  // The hook tree omits some primitives (useEffectEvent) but still counts their ids; each skipped id is one hidden slot.
  const fillHidden = (count: number): boolean => {
    for (let hidden = 0; hidden < count && chains.length < slotKinds.length; hidden++) {
      if (slotKinds[chains.length] !== 'other') return false
      chains.push(null)
    }
    return true
  }
  let nextId = 0
  for (const primitive of primitives) {
    if (!fillHidden(primitive.id - nextId)) return null
    nextId = primitive.id + 1
    const kind = slotKinds[chains.length]
    if (!kind) return truncated ? chains : null
    const expected = EXPECTED_KINDS[primitive.name]
    if (expected && !expected.includes(kind)) return null
    const width = layout[primitive.name] ?? 1
    if (!truncated && chains.length + width > slotKinds.length) return null
    for (let offset = 0; offset < width && chains.length < slotKinds.length; offset++) {
      chains.push(primitive.customHooks)
    }
  }
  return fillHidden(slotKinds.length - chains.length) ? chains : null
}
