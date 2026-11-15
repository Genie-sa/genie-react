import { type Fiber, getLatestFiber } from 'bippy'
import { getFiberHooks, type HooksNode } from 'bippy/source'
import { classifyHook, hookChain } from './fiber'
import { type HookSlot, hookSlots } from './hook-groups'
import {
  packageNameFromFile,
  type ResolvedSource,
  resolveHookCallsite,
  type SourceOwnership,
  sourceOwnershipForSource,
} from './source'

export type EffectDeclarationReason =
  | 'exact-hook-order'
  | 'called-by-library-hook'
  | 'library-component'
  | 'hook-source-unresolved'
  | 'hook-count-mismatch'
  | 'hook-inspection-unavailable'
  | 'attribution-budget-exhausted'
  | 'report-state-advanced'

export interface EffectHookAncestryFrame {
  name: string
  source: ResolvedSource | null
  ownership: SourceOwnership
  packageName: string | null
}

/** Who declared one effect: the hook call that created it, the custom hooks around that call, and the ownership that follows from where the call lives. */
export interface EffectDeclaration {
  hookIndex: number
  hook: string | null
  customHooks: string[] | null
  source: ResolvedSource | null
  ownership: SourceOwnership
  evidence: 'exact' | 'inferred' | 'unknown'
  reason: EffectDeclarationReason
  packageName: string | null
  hookAncestry: EffectHookAncestryFrame[]
}

export interface EffectDeclarationRequest {
  fiber: Fiber
  hookIndices: readonly number[]
  componentOwnership: SourceOwnership
}

const DECLARATION_FIBER_LIMIT = 80
const DECLARATION_BUDGET_MS = 500

interface InspectedHooks {
  hookCount: number
  tree: HooksNode[]
}

/** Hook call sites belong to the component's code, not to an instance, so one inspection serves every instance of a type until its hook count changes. */
const inspectedByType = new WeakMap<object, InspectedHooks>()
const declaredByType = new WeakMap<object, Map<number, EffectDeclaration>>()

/** Resolves declarations for each request within one shared budget; requests past it are explicitly unattributed rather than guessed. */
export async function resolveEffectDeclarations(
  requests: readonly EffectDeclarationRequest[],
  isCurrent: () => boolean = () => true,
): Promise<Map<number, EffectDeclaration>[]> {
  const startedAt = Date.now()
  const results: Map<number, EffectDeclaration>[] = []
  for (const [index, request] of requests.entries()) {
    const withinBudget =
      index < DECLARATION_FIBER_LIMIT && Date.now() - startedAt < DECLARATION_BUDGET_MS
    results.push(
      withinBudget
        ? await declarationsFor(request)
        : unattributed(request, 'attribution-budget-exhausted'),
    )
  }
  return isCurrent()
    ? results
    : requests.map((request) => unattributed(request, 'report-state-advanced'))
}

async function declarationsFor(
  request: EffectDeclarationRequest,
): Promise<Map<number, EffectDeclaration>> {
  const fiber = getLatestFiber(request.fiber) ?? request.fiber
  const key = typeKey(fiber)
  const known = key ? declaredByType.get(key) : undefined
  const slots = inspectSlots(fiber)
  if (slots === 'unavailable' || slots === null) {
    const reason = slots === null ? 'hook-count-mismatch' : 'hook-inspection-unavailable'
    return known ? withKnown(request, known, reason) : unattributed(request, reason)
  }
  const declarations = new Map<number, EffectDeclaration>()
  for (const hookIndex of request.hookIndices) {
    const slot = slots[hookIndex]
    declarations.set(
      hookIndex,
      slot?.customHooks
        ? await declarationOf(hookIndex, slot, request.componentOwnership)
        : fallback(hookIndex, request.componentOwnership, 'hook-count-mismatch'),
    )
  }
  if (key) declaredByType.set(key, new Map([...(known ?? []), ...declarations]))
  return declarations
}

/** React clears an unmounted fiber's hooks, so an instance that is gone reuses what a mounted instance of its type declared at the same hook index. */
function withKnown(
  request: EffectDeclarationRequest,
  known: ReadonlyMap<number, EffectDeclaration>,
  reason: EffectDeclarationReason,
): Map<number, EffectDeclaration> {
  return new Map(
    request.hookIndices.map((hookIndex) => [
      hookIndex,
      known.get(hookIndex) ?? fallback(hookIndex, request.componentOwnership, reason),
    ]),
  )
}

function typeKey(fiber: Fiber): object | null {
  const type: unknown = fiber.type
  return typeof type === 'function' || (typeof type === 'object' && type !== null) ? type : null
}

async function declarationOf(
  hookIndex: number,
  slot: HookSlot,
  componentOwnership: SourceOwnership,
): Promise<EffectDeclaration> {
  const [source, ancestrySources] = await Promise.all([
    resolveHookCallsite(slot.source ?? null),
    Promise.all((slot.customHookSources ?? []).map((frame) => resolveHookCallsite(frame))),
  ])
  const customHooks = slot.customHooks ?? []
  const hookAncestry = customHooks.map((name, position): EffectHookAncestryFrame => {
    const frameSource = ancestrySources[position] ?? null
    const ownership = sourceOwnershipForSource(frameSource)
    return {
      name,
      source: frameSource,
      ownership,
      packageName:
        ownership === 'library' && frameSource ? packageNameFromFile(frameSource.file) : null,
    }
  })
  const ownership = sourceOwnershipForSource(source)
  const base = { hookIndex, hook: slot.hook, customHooks, source, hookAncestry }
  if (ownership !== 'unknown') {
    return {
      ...base,
      ownership,
      evidence: 'exact',
      reason: 'exact-hook-order',
      packageName: ownership === 'library' && source ? packageNameFromFile(source.file) : null,
    }
  }
  // Library code called the innermost custom hook, so the hook runs as part of that library; an app call site says nothing, since apps call library hooks.
  const innermostCall = hookAncestry.findLast((frame) => frame.source !== null)
  if (innermostCall?.ownership === 'library') {
    return {
      ...base,
      ownership: 'library',
      evidence: 'inferred',
      reason: 'called-by-library-hook',
      packageName: innermostCall.packageName,
    }
  }
  return { ...fallback(hookIndex, componentOwnership, 'hook-source-unresolved'), ...base }
}

function fallback(
  hookIndex: number,
  componentOwnership: SourceOwnership,
  reason: EffectDeclarationReason,
): EffectDeclaration {
  const library = componentOwnership === 'library'
  return {
    hookIndex,
    hook: null,
    customHooks: null,
    source: null,
    ownership: library ? 'library' : 'unknown',
    evidence: library ? 'inferred' : 'unknown',
    reason: library ? 'library-component' : reason,
    packageName: null,
    hookAncestry: [],
  }
}

function unattributed(
  request: EffectDeclarationRequest,
  reason: EffectDeclarationReason,
): Map<number, EffectDeclaration> {
  // A report that ran out of budget or went stale says nothing, not even what the component's ownership implies.
  const ownership =
    reason === 'attribution-budget-exhausted' || reason === 'report-state-advanced'
      ? 'unknown'
      : request.componentOwnership
  return new Map(
    request.hookIndices.map((hookIndex) => [hookIndex, fallback(hookIndex, ownership, reason)]),
  )
}

/** The hook slots of a mounted component, from the same shadow render React DevTools runs when a component is selected; null when the inspected hooks do not line up with the fiber's. */
function inspectSlots(fiber: Fiber): HookSlot[] | null | 'unavailable' {
  const chain = hookChain(fiber)
  const kinds = chain.map(classifyHook)
  const truncated = chain.at(-1)?.next != null
  const key = typeKey(fiber)
  const cached = key ? inspectedByType.get(key) : undefined
  if (cached?.hookCount === chain.length) {
    const slots = hookSlots(cached.tree, kinds, truncated)
    if (slots) return slots
  }
  let tree: HooksNode[]
  try {
    tree = getFiberHooks(fiber)
  } catch {
    return 'unavailable'
  }
  const slots = hookSlots(tree, kinds, truncated)
  if (slots && key) inspectedByType.set(key, { hookCount: chain.length, tree })
  return slots
}
