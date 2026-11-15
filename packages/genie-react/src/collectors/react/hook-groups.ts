import type { HookSource, HooksNode } from 'bippy/source'
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

interface CustomHookFrame {
  name: string
  /** Where this custom hook was called, inside its caller. */
  source: HookSource | null
}

interface Primitive {
  id: number
  name: string
  source: HookSource | null
  chain: CustomHookFrame[]
}

/** A slot's custom-hook chain, outermost first; null for a slot whose primitive the hook tree omits (useEffectEvent), so its chain is unknown. */
export type CustomHookChain = string[] | null

/** Stands in for a custom hook whose function has no name (an anonymous factory result, or a frame of eval-bundled code), so no name is invented for it. */
export const UNNAMED_CUSTOM_HOOK = '(anonymous)'

/** One fiber hook slot as the hook tree accounts for it: the React hook that allocated it (null when the tree omits that primitive), its custom-hook chain, and where the primitive and each custom hook were called. */
export interface HookSlot {
  hook: string | null
  customHooks: CustomHookChain
  source?: HookSource | null
  customHookSources?: (HookSource | null)[]
}

/** Each fiber hook slot's allocating hook and custom-hook chain, or null unless the hook tree accounts for every slot with a matching kind. */
export function hookSlots(
  tree: HooksNode[],
  slotKinds: readonly HookKind[],
  truncated: boolean,
): HookSlot[] | null {
  const primitives = slotAllocatingPrimitives(tree)
  for (const layout of SLOT_LAYOUTS) {
    const slots = alignSlots(primitives, slotKinds, truncated, layout)
    if (slots) return slots
  }
  return null
}

// Repeated calls from one callsite (a loop) make the inspector wrap them in a phantom custom hook named after the primitive itself.
const isPhantomPrimitiveWrapper = (node: HooksNode): boolean =>
  node.subHooks.every((child) => child.subHooks.length === 0 && child.name === node.name)

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/
const NAMELESS_FRAMES = new Set(['eval', 'anonymous', 'use'])

/** V8 names a method called through another property `receiver.method [as alias]`; the alias is the name the caller wrote. */
function callableNameOf(frameName: string): string {
  const alias = /\[as ([^\]]+)\]$/.exec(frameName)?.[1]
  const name = alias ?? frameName.replace(/\s*\[as [^\]]+\]$/, '')
  return name.slice(name.lastIndexOf('.') + 1)
}

function isNamed(name: string): boolean {
  return IDENTIFIER.test(name) && !NAMELESS_FRAMES.has(name)
}

// The tree strips "use" from names and also lists plain helper functions, so the first child's callsite frame gives the real name.
function customHookName(node: HooksNode): string {
  const frameName = node.subHooks[0]?.hookSource?.functionName
  const fromFrame = frameName ? callableNameOf(frameName) : ''
  if (isNamed(fromFrame)) return fromFrame
  const fromTree = `use${node.name}`
  return node.name && isNamed(fromTree) && isNamed(node.name) ? fromTree : UNNAMED_CUSTOM_HOOK
}

function slotAllocatingPrimitives(tree: HooksNode[]): Primitive[] {
  const primitives: Primitive[] = []
  const visit = (nodes: HooksNode[], chain: CustomHookFrame[]): void => {
    for (const node of nodes) {
      if (node.subHooks.length > 0) {
        visit(
          node.subHooks,
          isPhantomPrimitiveWrapper(node)
            ? chain
            : [...chain, { name: customHookName(node), source: node.hookSource }].slice(
                0,
                MAX_CUSTOM_HOOK_DEPTH,
              ),
        )
      } else if (node.id !== null) {
        primitives.push({ id: node.id, name: node.name, source: node.hookSource, chain })
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
): HookSlot[] | null {
  const slots: HookSlot[] = []
  // The hook tree omits some primitives (useEffectEvent) but still counts their ids; each skipped id is one hidden slot.
  const fillHidden = (count: number): boolean => {
    for (let hidden = 0; hidden < count && slots.length < slotKinds.length; hidden++) {
      if (slotKinds[slots.length] !== 'other') return false
      slots.push({ hook: null, customHooks: null })
    }
    return true
  }
  let nextId = 0
  for (const primitive of primitives) {
    if (!fillHidden(primitive.id - nextId)) return null
    nextId = primitive.id + 1
    const kind = slotKinds[slots.length]
    if (!kind) return truncated ? slots : null
    const expected = EXPECTED_KINDS[primitive.name]
    if (expected && !expected.includes(kind)) return null
    const width = layout[primitive.name] ?? 1
    if (!truncated && slots.length + width > slotKinds.length) return null
    for (let offset = 0; offset < width && slots.length < slotKinds.length; offset++) {
      slots.push({
        hook: `use${primitive.name}`,
        customHooks: primitive.chain.map((frame) => frame.name),
        source: primitive.source,
        customHookSources: primitive.chain.map((frame) => frame.source),
      })
    }
  }
  return fillHidden(slotKinds.length - slots.length) ? slots : null
}
