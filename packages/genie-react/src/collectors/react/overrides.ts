import { type Fiber, getLatestFiber, getRDTHook, getRenderer, instrument } from 'bippy'
import { previewValue, type ToolOutput } from '../../protocol'
import type { reactListOverridesContract, reactResetOverridesContract } from './contracts'
import {
  classifyHook,
  contextDependencies,
  contextDisplayName,
  contextOf,
  findAllCommittedRootFibers,
  findRootFiber,
  type HookKind,
  hookChain,
  isStatefulHook,
  nameOf,
  nearestContextProvider,
  registerFiber,
} from './fiber'
import { safeUnmountHandler } from './safe-instrumentation'
import { isClassComponentFiber, isContextProviderFiber, isSuspenseFiber } from './work-tags'

// Dev-only live overrides via the dev-renderer contract React DevTools uses; context has no renderer override, so it edits the nearest Provider's `value` prop; forced-fiber membership is always checked against both double-buffer fibers.

/** The dev-build renderer methods these overrides need, structurally compatible with bippy's ReactRenderer. */
export interface DevRenderer {
  scheduleUpdate?: (fiber: Fiber) => void
  setSuspenseHandler?: (shouldSuspend: (instance: unknown) => boolean) => void
  setErrorHandler?: (shouldError: (fiber: Fiber) => boolean) => void
  overrideHookState?: (fiber: Fiber, hookIndex: number, path: string[], value: unknown) => void
  overrideProps?: (fiber: Fiber, path: string[], value: unknown) => void
}

type DevCapability =
  | 'scheduleUpdate'
  | 'setSuspenseHandler'
  | 'setErrorHandler'
  | 'overrideHookState'
  | 'overrideProps'

const canDrive = (renderer: DevRenderer | null, capability: DevCapability): boolean =>
  typeof renderer?.scheduleUpdate === 'function' && typeof renderer[capability] === 'function'

/** The renderer owning `fiber` so multi-renderer apps drive the right one; only unclaimed (detached or pre-commit) fibers fall back to the first capable one, since another renderer's methods corrupt a foreign fiber. */
function requireRenderer(capability: DevCapability, fiber?: Fiber): DevRenderer {
  const owner = fiber ? getRenderer(fiber) : null
  if (owner) {
    if (canDrive(owner, capability)) return owner
    throw new Error(
      `This component's React renderer does not expose ${capability}: it is a production build, typically a widget that bundles its own React (e.g. Clerk). Read it with react_inspect_component; only components rendered by a development build can be overridden.`,
    )
  }
  for (const renderer of getRDTHook()?.renderers?.values() ?? []) {
    if (canDrive(renderer, capability)) return renderer
  }
  throw new Error(
    `The React renderer does not expose ${capability} — live overrides need a development build of react-dom 18+; a production build cannot be driven.`,
  )
}

const isForced = (fibers: ReadonlySet<Fiber>, fiber: Fiber): boolean =>
  fibers.has(fiber) || (fiber.alternate !== null && fibers.has(fiber.alternate))

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Applies pre-merged props in ONE renderer call — dev `overrideProps` rebuilds `pendingProps` from `memoizedProps` on every call, so per-key calls would clobber each other. */
export function overrideFiberProps(
  fiber: Fiber,
  partial: Record<string, unknown>,
  renderer: DevRenderer = requireRenderer('overrideProps', fiber),
): void {
  const current = propsOf(fiber)
  renderer.overrideProps?.(fiber, [], { ...current, ...partial })
  ensureUnmountPruning()
  recordPropsOverride(fiber, partial, current)
}

const propsOf = (fiber: Fiber): Record<string, unknown> =>
  isPlainObject(fiber.memoizedProps) ? fiber.memoizedProps : {}

// ── Override registry (list / reset) ─────────────────────────────────────────

type ListOverridesOutput = ToolOutput<typeof reactListOverridesContract>
type ResetOverridesOutput = ToolOutput<typeof reactResetOverridesContract>

// The one source of truth for override kinds is the list contract's enum; every other type flows from it.
type OverrideKind = ListOverridesOutput['overrides'][number]['kind']
type ResetOutcome = ResetOverridesOutput['cleared'][number]['outcome']

/** A prop as it was before the first override: absent props are deleted again on restore rather than set to undefined. */
type OriginalProp = { present: true; value: unknown } | { present: false }

interface RegistryEntry {
  kind: OverrideKind
  /** Nulled on unmount so a dead subtree is not pinned; the entry stays listed (mounted:false) until reset. */
  fiber: Fiber | null
  /** Hook entries are keyed per hook slot, so overriding two hooks of one component keeps two restorable entries. */
  hookIndex?: number
  componentName: string
  detail: string
  /** Receives the live buffer: an edit applied to the stale alternate is discarded by the next render. Reports superseded, without writing, when the app replaced the overridden value since. */
  restore?: (renderer: DevRenderer, live: Fiber) => 'restored' | 'superseded'
  originals?: ReadonlyMap<string, OriginalProp>
  latest?: Record<string, unknown>
  prevValue?: unknown
  originalState?: unknown
  assignments?: ReadonlyMap<string, string>
}

const registry: RegistryEntry[] = []

const sameFiber = (a: Fiber, target: Fiber): boolean =>
  a === target || a === target.alternate || a.alternate === target

function findEntry(
  kind: OverrideKind,
  fiber: Fiber,
  hookIndex?: number,
): RegistryEntry | undefined {
  return registry.find(
    (existing) =>
      existing.kind === kind &&
      existing.hookIndex === hookIndex &&
      existing.fiber !== null &&
      sameFiber(existing.fiber, fiber),
  )
}

// The registry stores exactly one entry per (kind, target) so a re-override updates rather than stacks; suspense/error are keyed by boundary, props/context by the edited fiber, hooks by fiber and hook slot.
function upsertEntry(entry: RegistryEntry): void {
  const existing = entry.fiber ? findEntry(entry.kind, entry.fiber, entry.hookIndex) : undefined
  if (existing) registry[registry.indexOf(existing)] = entry
  else registry.push(entry)
}

function removeEntry(kind: OverrideKind, fiber: Fiber): void {
  for (let i = registry.length - 1; i >= 0; i--) {
    const entry = registry[i]
    if (entry && entry.kind === kind && entry.fiber !== null && sameFiber(entry.fiber, fiber))
      registry.splice(i, 1)
  }
}

/** The committed buffer of a stored fiber, or null once React deleted it. A child's `return` is rewritten only when its parent re-renders, so after a commit that bailed out above it the chain ends at the stale HostRoot buffer; the FiberRoot both buffers share decides instead, and deletion nulls `return` so a removed fiber reaches none. */
function mountedFiber(fiber: Fiber): Fiber | null {
  const liveFiberRoots = new Set<unknown>(
    findAllCommittedRootFibers().roots.map((root) => root.stateNode),
  )
  const primary = findRootFiber()
  if (primary) liveFiberRoots.add(primary.stateNode)
  for (const candidate of [fiber, fiber.alternate]) {
    let top = candidate
    while (top?.return) top = top.return
    if (top && liveFiberRoots.has(top.stateNode)) return getLatestFiber(fiber)
  }
  return null
}

function recordPropsOverride(
  fiber: Fiber,
  partial: Record<string, unknown>,
  currentProps: Record<string, unknown>,
): void {
  const existing = findEntry('props', fiber)
  // First capture wins per key — a re-override reads already-overridden props, not the app's originals.
  const originals = new Map(existing?.originals)
  for (const key of Object.keys(partial)) {
    if (!originals.has(key)) originals.set(key, originalProp(currentProps, key))
  }
  const latest: Record<string, unknown> = { ...existing?.latest, ...partial }
  const detail = Object.keys(latest)
    .map(
      (key) => `${key}=${previewValue(latest[key])} (was ${originalPreview(originals.get(key))})`,
    )
    .join(', ')
  upsertEntry({
    kind: 'props',
    fiber,
    componentName: nameOf(fiber),
    detail,
    originals,
    latest,
    restore: (renderer, live) => {
      const props = propsOf(live)
      // A parent render replaces every overridden prop with its own value; writing the captured originals then would undo the app.
      if (!Object.keys(latest).every((key) => Object.is(props[key], latest[key]))) {
        return 'superseded'
      }
      const restored = { ...props }
      for (const [key, original] of originals) {
        if (original.present) restored[key] = original.value
        else delete restored[key]
      }
      renderer.overrideProps?.(live, [], restored)
      return 'restored'
    },
  })
}

function originalProp(props: Record<string, unknown>, key: string): OriginalProp {
  return Object.hasOwn(props, key) ? { present: true, value: props[key] } : { present: false }
}

function originalPreview(original: OriginalProp | undefined): string {
  return original?.present ? previewValue(original.value) : 'absent'
}

function recordHookOverride(
  fiber: Fiber,
  flatIndex: number,
  path: Array<string | number>,
  value: unknown,
  priorState: unknown,
): void {
  // First capture wins — a re-override reads the already-overridden hook value, not the app's original.
  const existing = findEntry('hook', fiber, flatIndex)
  const originalState = existing ? existing.originalState : priorState
  const appliedState = hookChain(fiber)[flatIndex]?.memoizedState
  const assignments = new Map(existing?.assignments)
  assignments.set(path.map(String).join('.'), previewValue(value))
  upsertEntry({
    kind: 'hook',
    fiber,
    hookIndex: flatIndex,
    componentName: nameOf(fiber),
    detail: [...assignments]
      .map(([pathKey, preview]) => `hook ${flatIndex}${pathKey ? ` ${pathKey}` : ''} ← ${preview}`)
      .join(', '),
    originalState,
    assignments,
    restore: (renderer, live) => {
      const hook = hookChain(live)[flatIndex]
      // The component's own setState replaced the overridden value; it is app state now.
      if (!hook || !Object.is(hook.memoizedState, appliedState)) return 'superseded'
      renderer.overrideHookState?.(live, flatIndex, [], originalState)
      return 'restored'
    },
  })
}

function recordContextOverride(
  provider: Fiber,
  contextName: string,
  prevValue: unknown,
  nextValue: unknown,
): void {
  // First capture wins — a re-override reads the already-overridden provider value, not the app's original.
  const existing = findEntry('context', provider)
  const original = existing ? existing.prevValue : prevValue
  upsertEntry({
    kind: 'context',
    fiber: provider,
    componentName: contextName,
    detail: `${contextName} value ← ${previewValue(nextValue)} (was ${previewValue(original)})`,
    prevValue: original,
    restore: (renderer, live) => {
      // The Provider's parent re-rendered and passed its own value, which the override no longer shadows.
      if (!Object.is(propsOf(live).value, nextValue)) return 'superseded'
      overrideFiberPropsRaw(live, { value: original }, renderer)
      return 'restored'
    },
  })
}

// Applies props WITHOUT re-recording — the restore path must not push a new registry entry for the value it is undoing.
function overrideFiberPropsRaw(
  fiber: Fiber,
  partial: Record<string, unknown>,
  renderer: DevRenderer,
): void {
  renderer.overrideProps?.(fiber, [], { ...propsOf(fiber), ...partial })
}

/** Every override genie has applied and not yet reset, with a live componentId when the target is still mounted (else null + mounted:false). */
export function listOverrides(): ListOverridesOutput {
  const overrides = registry.map((entry) => {
    const live = entry.fiber ? mountedFiber(entry.fiber) : null
    return {
      kind: entry.kind,
      componentId: live ? registerFiber(live) : null,
      componentName: entry.componentName,
      detail: entry.detail,
      mounted: live !== null,
    }
  })
  return { overrides, total: overrides.length }
}

/** Clear every override from module state, restoring props/context originals when the fiber is still mounted; works even when findFiberById would fail (suspense/error clear via their sets). */
export function resetOverrides(renderer?: DevRenderer): ResetOverridesOutput {
  const propsRenderer = renderer ?? optionalRenderer('overrideProps')
  const hookRenderer = renderer ?? optionalRenderer('overrideHookState')
  const scheduleRenderer = renderer ?? optionalRenderer('scheduleUpdate')
  const cleared = registry.map((entry) => ({
    kind: entry.kind,
    componentName: entry.componentName,
    outcome: clearEntry(entry, propsRenderer, hookRenderer, scheduleRenderer),
  }))
  registry.length = 0
  forcedSuspense.clear()
  return { ok: true, cleared, remaining: registry.length }
}

function clearEntry(
  entry: RegistryEntry,
  propsRenderer: DevRenderer | null,
  hookRenderer: DevRenderer | null,
  scheduleRenderer: DevRenderer | null,
): ResetOutcome {
  if (entry.fiber === null) return entry.kind === 'hook' ? 'released' : 'skipped-unmounted'
  if (entry.kind === 'suspense') return releaseSuspense(entry.fiber, scheduleRenderer)
  if (entry.kind === 'error') return releaseError(entry.fiber, scheduleRenderer)
  const renderer = entry.kind === 'hook' ? hookRenderer : propsRenderer
  const live = mountedFiber(entry.fiber)
  if (!live || !renderer || !entry.restore)
    return entry.kind === 'hook' ? 'released' : 'skipped-unmounted'
  const outcome = entry.restore(renderer, live)
  if (outcome === 'restored') scheduleRenderer?.scheduleUpdate?.(live)
  return outcome
}

function releaseSuspense(boundary: Fiber, renderer: DevRenderer | null): ResetOutcome {
  const wasForced = isForced(forcedSuspense, boundary)
  forcedSuspense.delete(boundary)
  if (boundary.alternate) forcedSuspense.delete(boundary.alternate)
  const live = mountedFiber(boundary)
  if (live && renderer) renderer.scheduleUpdate?.(live)
  return wasForced ? 'released' : 'skipped-unmounted'
}

function releaseError(boundary: Fiber, renderer: DevRenderer | null): ResetOutcome {
  const key = forcedErrorKeyOf(boundary)
  if (key) {
    forcedErrors.delete(key)
    forcedErrors.set(boundary, false)
  }
  const live = mountedFiber(boundary)
  if (live && renderer) renderer.scheduleUpdate?.(live)
  return key ? 'released' : 'skipped-unmounted'
}

// Like requireRenderer but returns null instead of throwing — reset is a recovery path that must degrade gracefully when no dev renderer is present.
function optionalRenderer(capability: DevCapability, fiber?: Fiber): DevRenderer | null {
  try {
    return requireRenderer(capability, fiber)
  } catch {
    return null
  }
}

// ── Unmount pruning ──────────────────────────────────────────────────────────

const forcedSuspense = new Set<Fiber>()
const forcedErrors = new Map<Fiber, boolean>()

let unmountPruningInstalled = false
let unmountPruningDispose: (() => void) | null = null

export function ensureUnmountPruning(): void {
  if (unmountPruningInstalled) return
  unmountPruningInstalled = true
  unmountPruningDispose = instrument({
    name: 'genie-overrides',
    onCommitFiberUnmount: safeUnmountHandler((_rendererId, fiber) =>
      pruneUnmountedOverrides(fiber),
    ),
  })
}

export function disposeUnmountPruning(): void {
  unmountPruningDispose?.()
  unmountPruningDispose = null
  unmountPruningInstalled = false
}

/** Unmount teardown: forced sets drop the fiber; registry entries keep their row (mounted:false until reset) but release the fiber and restore closure so the dead subtree is not pinned. */
export function pruneUnmountedOverrides(fiber: Fiber): void {
  forcedSuspense.delete(fiber)
  forcedErrors.delete(fiber)
  if (fiber.alternate) {
    forcedSuspense.delete(fiber.alternate)
    forcedErrors.delete(fiber.alternate)
  }
  for (const entry of registry) {
    if (entry.fiber !== null && sameFiber(entry.fiber, fiber)) {
      entry.fiber = null
      entry.restore = undefined
    }
  }
}

/** Boundaries currently forced into their error state via react_force_error_boundary — so react_error_state can surface DevTools-driven errors alongside organic ones. Unmount pruning keeps the set to live fibers. */
export function forcedErrorBoundaries(): Fiber[] {
  const out: Fiber[] = []
  for (const [fiber, forced] of forcedErrors) if (forced) out.push(fiber)
  return out
}

/** Suspense boundaries currently forced to show their fallback via react_toggle_suspense_fallback. */
export function forcedSuspenseBoundaries(): Fiber[] {
  return [...forcedSuspense]
}

// ── Suspense fallback forcing ────────────────────────────────────────────────

const suspenseHandlerInstalled = new WeakSet<DevRenderer>()

export function findSuspenseBoundary(fiber: Fiber): Fiber | null {
  let current: Fiber | null = fiber
  while (current && !isSuspenseFiber(current)) current = current.return
  return current
}

export interface BoundaryToggle {
  boundary: Fiber
  active: number
}

export function applySuspenseOverride(
  target: Fiber,
  showFallback: boolean,
  renderer: DevRenderer = requireRenderer('setSuspenseHandler', target),
): BoundaryToggle {
  const boundary = findSuspenseBoundary(target)
  if (!boundary)
    throw new Error(
      `No <Suspense> boundary at or above ${nameOf(target)} — pass the id of a component rendered inside one, or a boundaryId from react_error_state.`,
    )
  if (!suspenseHandlerInstalled.has(renderer)) {
    renderer.setSuspenseHandler?.((instance) => isForced(forcedSuspense, instance as Fiber))
    suspenseHandlerInstalled.add(renderer)
  }
  if (showFallback) {
    ensureUnmountPruning()
    if (!isForced(forcedSuspense, boundary)) forcedSuspense.add(boundary)
    upsertEntry({
      kind: 'suspense',
      fiber: boundary,
      componentName: nameOf(boundary),
      detail: 'fallback forced',
    })
  } else {
    removeEntry('suspense', boundary)
    if (!isForced(forcedSuspense, boundary)) return { boundary, active: forcedSuspense.size }
    forcedSuspense.delete(boundary)
    if (boundary.alternate) forcedSuspense.delete(boundary.alternate)
  }
  renderer.scheduleUpdate?.(boundary)
  return { boundary, active: forcedSuspense.size }
}

// ── Error boundary forcing ───────────────────────────────────────────────────

const errorHandlerInstalled = new WeakSet<DevRenderer>()

export function isErrorBoundaryFiber(fiber: Fiber): boolean {
  if (!isClassComponentFiber(fiber)) return false
  const ctor = fiber.type as { getDerivedStateFromError?: unknown } | null
  const instance = fiber.stateNode as { componentDidCatch?: unknown } | null
  return (
    typeof ctor?.getDerivedStateFromError === 'function' ||
    typeof instance?.componentDidCatch === 'function'
  )
}

export function findErrorBoundary(fiber: Fiber): Fiber | null {
  let current: Fiber | null = fiber
  while (current && !isErrorBoundaryFiber(current)) current = current.return
  return current
}

const forcedErrorKeyOf = (fiber: Fiber): Fiber | null => {
  if (forcedErrors.has(fiber)) return fiber
  if (fiber.alternate && forcedErrors.has(fiber.alternate)) return fiber.alternate
  return null
}

// true forces the catch; false resets exactly once then self-clears (back to real errors only); absent returns null, which React's dev contract treats as "no override".
const shouldForceError = (fiber: Fiber): boolean | null => {
  const key = forcedErrorKeyOf(fiber)
  if (!key) return null
  const forced = forcedErrors.get(key) ?? null
  if (forced === false) forcedErrors.delete(key)
  return forced
}

const activeErrorCount = (): number => [...forcedErrors.values()].filter(Boolean).length

export function applyErrorOverride(
  target: Fiber,
  forceError: boolean,
  renderer: DevRenderer = requireRenderer('setErrorHandler', target),
): BoundaryToggle {
  const boundary = findErrorBoundary(target)
  if (!boundary)
    throw new Error(
      `No error boundary at or above ${nameOf(target)} — an error boundary is a class component with getDerivedStateFromError or componentDidCatch (e.g. react-error-boundary's <ErrorBoundary>).`,
    )
  if (!errorHandlerInstalled.has(renderer)) {
    // React's dev contract also accepts null ("no override"); bippy's type is narrower than the contract.
    renderer.setErrorHandler?.(shouldForceError as (fiber: Fiber) => boolean)
    errorHandlerInstalled.add(renderer)
  }
  const key = forcedErrorKeyOf(boundary)
  if (forceError) {
    ensureUnmountPruning()
    if (key) forcedErrors.delete(key)
    forcedErrors.set(boundary, true)
    upsertEntry({
      kind: 'error',
      fiber: boundary,
      componentName: nameOf(boundary),
      detail: 'error forced',
    })
  } else {
    removeEntry('error', boundary)
    if (!key) return { boundary, active: activeErrorCount() }
    forcedErrors.delete(key)
    forcedErrors.set(boundary, false)
  }
  renderer.scheduleUpdate?.(boundary)
  return { boundary, active: activeErrorCount() }
}

// ── Hook state ───────────────────────────────────────────────────────────────

interface StatefulHook {
  flatIndex: number
  stateIndex: number
  kind: HookKind
  preview: string
}

const MAX_PREVIEW_KEYS = 4

// A compact one-line value preview for error enumerations — shallow object keys so `value={step:1}` teaches the agent what it is overriding, falling back to the shared previewValue for everything else.
function shortPreview(value: unknown): string {
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
    if (keys.length === 0) return '{}'
    const shown = keys.slice(0, MAX_PREVIEW_KEYS).map((key) => `${key}:${previewValue(value[key])}`)
    if (keys.length > MAX_PREVIEW_KEYS) shown.push('…')
    return `{${shown.join(',')}}`
  }
  return previewValue(value)
}

/** Every useState/useReducer hook on a fiber, with both its flat and stateful ordinal index, kind, and a value preview — the material every override error enumerates so a failed call teaches the correct next one. */
export function statefulHooks(
  fiber: Fiber,
  chain: ReturnType<typeof hookChain> = hookChain(fiber),
): StatefulHook[] {
  const out: StatefulHook[] = []
  let stateIndex = 0
  chain.forEach((hook, flatIndex) => {
    if (!isStatefulHook(hook)) return
    out.push({
      flatIndex,
      stateIndex: stateIndex++,
      kind: classifyHook(hook),
      preview: shortPreview(hook.memoizedState),
    })
  })
  return out
}

const enumerateStateful = (hooks: StatefulHook[]): string =>
  hooks.length === 0
    ? 'none'
    : hooks
        .map((h) => `[${h.flatIndex}] ${h.kind} stateIndex ${h.stateIndex} value=${h.preview}`)
        .join(', ')

export interface ResolvedStatefulTarget {
  flatIndex: number
  stateIndex: number
}

/** Resolve the override target from exactly one of hookIndex / stateIndex, throwing an enumerating error otherwise; one hook-chain walk covers both lookups. */
export function resolveStatefulTarget(
  fiber: Fiber,
  target: { hookIndex?: number; stateIndex?: number },
): ResolvedStatefulTarget {
  if (isClassComponentFiber(fiber))
    throw new Error(
      `${nameOf(fiber)} is a class component — it has no hooks. Use react_override_props, or target a function component.`,
    )
  const hooks = hookChain(fiber)
  const stateful = statefulHooks(fiber, hooks)
  const enumerated = `stateful hooks: ${enumerateStateful(stateful)}`

  if (target.stateIndex !== undefined) {
    const match = stateful.find((h) => h.stateIndex === target.stateIndex)
    if (!match)
      throw new Error(
        stateful.length === 0
          ? `${nameOf(fiber)} has no stateful hooks (useState/useReducer) to override — ${enumerated}.`
          : `${nameOf(fiber)} has no stateful hook at stateIndex ${target.stateIndex} (has ${stateful.length}) — ${enumerated}.`,
      )
    return overridableTarget(fiber, match, enumerated)
  }

  const hookIndex = target.hookIndex
  if (hookIndex === undefined)
    throw new Error(
      `Provide exactly one of hookIndex or stateIndex to override ${nameOf(fiber)} — ${enumerated}.`,
    )
  const hook = hooks[hookIndex]
  if (!hook)
    throw new Error(
      hooks.length === 0
        ? `${nameOf(fiber)} has no hooks — pass a function component that uses useState/useReducer. ${enumerated}.`
        : `${nameOf(fiber)} has ${hooks.length} hooks (indices 0–${hooks.length - 1}); hook ${hookIndex} does not exist. ${enumerated}.`,
    )
  const match = stateful.find((h) => h.flatIndex === hookIndex)
  if (!match)
    throw new Error(
      `Hook ${hookIndex} of ${nameOf(fiber)} is not a stateful hook — only useState/useReducer values can be overridden. ${enumerated} (pass stateIndex to target by stateful ordinal).`,
    )
  return overridableTarget(fiber, match, enumerated)
}

// useOptimistic and useActionState keep dispatch queues that are not plain state: overwriting the action slot would replace the app's action function.
function overridableTarget(
  fiber: Fiber,
  hook: StatefulHook,
  enumerated: string,
): ResolvedStatefulTarget {
  if (hook.kind !== 'state' && hook.kind !== 'reducer')
    throw new Error(
      `Hook ${hook.flatIndex} of ${nameOf(fiber)} (stateIndex ${hook.stateIndex}) is internal state of a hook such as useOptimistic or useActionState, not a useState/useReducer value, so it cannot be overridden. ${enumerated}.`,
    )
  return { flatIndex: hook.flatIndex, stateIndex: hook.stateIndex }
}

export function applyHookStateOverride(
  fiber: Fiber,
  target: { hookIndex?: number; stateIndex?: number },
  path: Array<string | number>,
  value: unknown,
  renderer: DevRenderer = requireRenderer('overrideHookState', fiber),
): ResolvedStatefulTarget {
  const resolved = resolveStatefulTarget(fiber, target)
  const priorState = hookChain(fiber)[resolved.flatIndex]?.memoizedState
  renderer.overrideHookState?.(fiber, resolved.flatIndex, path.map(String), value)
  // Schedule explicitly on the latest mounted fiber: the renderer's own scheduling can land on a stale alternate or bail through a memo boundary, leaving the value changed but never committed.
  renderer.scheduleUpdate?.(mountedFiber(fiber) ?? fiber)
  ensureUnmountPruning()
  recordHookOverride(fiber, resolved.flatIndex, path, value, priorState)
  return resolved
}

// ── Context (via the nearest Provider's value prop) ──────────────────────────

export interface ProviderMatch {
  provider: Fiber
  contextName: string
}

export function resolveContextProvider(fiber: Fiber, contextName?: string): ProviderMatch {
  if (isContextProviderFiber(fiber))
    return { provider: fiber, contextName: contextDisplayName(contextOf(fiber)) }

  const consumed = contextDependencies(fiber)
  const componentName = nameOf(fiber)
  if (consumed.length === 0)
    throw new Error(
      `${componentName} consumes no contexts — pass a component that reads the context (react_inspect_context shows what a component consumes), or the Provider itself.`,
    )

  const names = consumed.map((entry) => entry.name).join(', ')
  const target = contextName
    ? consumed.find((entry) => entry.name === contextName)
    : consumed.length === 1
      ? consumed[0]
      : undefined
  if (!target)
    throw new Error(
      contextName
        ? `${componentName} does not consume a context named "${contextName}". It consumes: ${names}.`
        : `${componentName} consumes ${consumed.length} contexts (${names}) — pass \`context\` to pick one.`,
    )

  const provider = nearestContextProvider(fiber, target.context)
  if (provider) return { provider, contextName: target.name }
  throw new Error(
    `No Provider for "${target.name}" above ${componentName} — the context is running on its default value, which cannot be overridden live. Render a Provider, or change the default in source.`,
  )
}

export function applyContextOverride(
  fiber: Fiber,
  contextName: string | undefined,
  value: unknown,
  renderer: DevRenderer = requireRenderer('overrideProps', fiber),
): ProviderMatch {
  const match = resolveContextProvider(fiber, contextName)
  const currentValue = isPlainObject(match.provider.memoizedProps)
    ? match.provider.memoizedProps.value
    : undefined
  const nextValue =
    isPlainObject(value) && isPlainObject(currentValue) ? { ...currentValue, ...value } : value
  overrideFiberPropsRaw(match.provider, { value: nextValue }, renderer)
  ensureUnmountPruning()
  recordContextOverride(match.provider, match.contextName, currentValue, nextValue)
  return match
}
