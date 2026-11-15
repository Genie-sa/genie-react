import type { OwnershipCause, OwnershipConflict } from '../protocol'

/** Calls without a caller identity (older CLIs, raw sockets) share one anonymous caller. */
export const ANONYMOUS_CALLER = ''

/** A caller that has not used a tab for this long no longer keeps other callers' untargeted calls off it. */
export const TAB_CLAIM_IDLE_MS = 10 * 60_000
/** A caller that has not used a document for this long no longer blocks resets of the overrides or simulations it applied. */
export const HOLD_IDLE_MS = 5 * 60_000

const MAX_TRACKED_TABS = 256
const MAX_CALLERS_PER_SCOPE = 64
const MAX_REPLACED_RECORDINGS = 64

type Interruption = {
  cause: Exclude<OwnershipCause, 'held' | 'claimed' | 'reloaded'>
  tool: string
  at: number
}

/** A render window lives in one document of a tab; claims are kept per tab so a read after a reload can tell the window is gone. */
export interface WindowScope {
  tabKey: string
  documentId: string
}

interface WindowClaim {
  documentId: string
  observationId: string | null
  interruption?: Interruption
}

interface TimelineClaim {
  caller: string
  endsAt: number
  stopped: boolean
}

interface SimulationClaim {
  caller: string
  queryKey?: string
}

interface DocumentLedger {
  lastSeen: Map<string, number>
  overrides: Map<string, number>
  simulations: Map<string, SimulationClaim>
  timelines: Map<string, TimelineClaim>
  replacedTimelines: Map<string, { by: string; at: number }>
}

export interface Holders {
  otherCallers: number
  ageMs: number
}

/** Who started which per-document observation and who applied which per-document state, so one agent cannot silently read or reset another agent's. */
export class OwnershipLedger {
  private readonly documents = new Map<string, DocumentLedger>()
  private readonly tabs = new Map<string, Map<string, number>>()
  private readonly windows = new Map<string, Map<string, WindowClaim>>()

  constructor(private readonly now: () => number = Date.now) {}

  clear(): void {
    this.documents.clear()
    this.tabs.clear()
    this.windows.clear()
  }

  forgetDocument(documentId: string): void {
    this.documents.delete(documentId)
  }

  recordTabUse(tabKey: string, caller: string): void {
    const users = this.tabs.get(tabKey) ?? new Map<string, number>()
    this.tabs.delete(tabKey)
    this.tabs.set(tabKey, users)
    touch(users, caller, this.now())
    evictOldest(this.tabs, MAX_TRACKED_TABS)
  }

  /** Other callers that used the tab within {@link TAB_CLAIM_IDLE_MS}. */
  otherTabUsers(tabKey: string, caller: string): number {
    const users = this.tabs.get(tabKey)
    if (!users) return 0
    const cutoff = this.now() - TAB_CLAIM_IDLE_MS
    let others = 0
    for (const [user, at] of users) if (user !== caller && at >= cutoff) others += 1
    return others
  }

  /** Whether untargeted calls from `caller` must leave the tab alone: another caller uses it and this caller never has. */
  isClaimedByOthers(tabKey: string, caller: string): boolean {
    return this.tabs.get(tabKey)?.has(caller) !== true && this.otherTabUsers(tabKey, caller) > 0
  }

  recordDocumentUse(documentId: string, caller: string): void {
    touch(this.document(documentId).lastSeen, caller, this.now())
  }

  /** Starts `caller`'s render window; returns how many other callers' live windows it replaced. */
  windowStarted(
    scope: WindowScope,
    caller: string,
    observationId: string | null,
    tool: string,
  ): number {
    const displaced = this.interruptOthers(scope, caller, { cause: 'restarted', tool })
    const claims = this.windows.get(scope.tabKey) ?? new Map<string, WindowClaim>()
    this.windows.delete(scope.tabKey)
    this.windows.set(scope.tabKey, claims)
    evictOldest(this.windows, MAX_TRACKED_TABS)
    claims.delete(caller)
    claims.set(caller, { documentId: scope.documentId, observationId })
    evictOldest(claims, MAX_CALLERS_PER_SCOPE)
    return displaced
  }

  /** A pause stops counting other callers' renders; a state-changing call adds renders they did not cause. Returns how many live windows it disturbed. */
  windowInterrupted(
    scope: WindowScope,
    caller: string,
    cause: 'paused' | 'changed-state',
    tool: string,
  ): number {
    return this.interruptOthers(scope, caller, { cause, tool })
  }

  /** Why evidence read by `caller` does not belong to the window it started; `observed` is the observation the read reported, `undefined` when the read reports none. */
  windowConflict(
    scope: WindowScope,
    caller: string,
    observed: string | null | undefined,
  ): OwnershipConflict | null {
    const claim = this.windows.get(scope.tabKey)?.get(caller)
    if (!claim) return null
    if (claim.documentId !== scope.documentId)
      return { resource: 'render-window', cause: 'reloaded' }
    if (claim.interruption) {
      const { cause, tool, at } = claim.interruption
      return { resource: 'render-window', cause, tool, ageMs: this.ageOf(at) }
    }
    if (observed === undefined || claim.observationId === null || observed === claim.observationId)
      return null
    return { resource: 'render-window', cause: 'restarted' }
  }

  overridesApplied(documentId: string, caller: string): void {
    const document = this.document(documentId)
    touch(document.overrides, caller, this.now())
  }

  overridesReset(documentId: string): void {
    this.documents.get(documentId)?.overrides.clear()
  }

  overrideHolders(documentId: string, caller: string): Holders | null {
    const document = this.documents.get(documentId)
    return document ? this.holders(document, [...document.overrides], caller) : null
  }

  simulationApplied(
    documentId: string,
    caller: string,
    queryHash: string,
    queryKey: string | undefined,
  ): void {
    const document = this.document(documentId)
    document.simulations.set(queryHash, { caller, ...(queryKey ? { queryKey } : {}) })
  }

  /** Holders of the simulations a `query_restore_state` or `query_simulate_state` would end; `selector` undefined means every simulation. */
  simulationHolders(
    documentId: string,
    caller: string,
    selector?: { queryHash?: string; queryKey?: string },
  ): Holders | null {
    const document = this.documents.get(documentId)
    if (!document) return null
    const held = [...document.simulations].filter(
      ([queryHash, claim]) =>
        selector === undefined ||
        queryHash === selector.queryHash ||
        (claim.queryKey !== undefined && claim.queryKey === selector.queryKey),
    )
    return this.holders(
      document,
      held.map(([, claim]) => [claim.caller, document.lastSeen.get(claim.caller) ?? 0]),
      caller,
    )
  }

  simulationsRestored(documentId: string, queryHashes: readonly string[] | 'all'): void {
    const simulations = this.documents.get(documentId)?.simulations
    if (!simulations) return
    if (queryHashes === 'all') simulations.clear()
    else for (const queryHash of queryHashes) simulations.delete(queryHash)
  }

  /** Records a recording `caller` started; stopped recordings of other callers are gone, because the app keeps only one. */
  timelineStarted(documentId: string, caller: string, id: string, endsAt: number): void {
    const document = this.document(documentId)
    for (const [previousId, claim] of document.timelines) {
      if (claim.caller !== caller) {
        document.replacedTimelines.set(previousId, { by: caller, at: this.now() })
      }
    }
    evictOldest(document.replacedTimelines, MAX_REPLACED_RECORDINGS)
    document.timelines.clear()
    document.timelines.set(id, { caller, endsAt, stopped: false })
  }

  timelineStopped(documentId: string, id: string): void {
    const claim = this.documents.get(documentId)?.timelines.get(id)
    if (claim) claim.stopped = true
  }

  /** Another caller's recording that is still running and would block or be replaced by a new one. */
  activeTimelineOfOther(documentId: string, caller: string): Holders | null {
    const document = this.documents.get(documentId)
    if (!document) return null
    const now = this.now()
    const active = [...document.timelines.values()].filter(
      (claim) => claim.caller !== caller && !claim.stopped && claim.endsAt > now,
    )
    return this.holders(
      document,
      active.map((claim) => [claim.caller, document.lastSeen.get(claim.caller) ?? 0]),
      caller,
    )
  }

  timelineConflict(documentId: string, caller: string, id: string): OwnershipConflict | null {
    const replaced = this.documents.get(documentId)?.replacedTimelines.get(id)
    if (!replaced || replaced.by === caller) return null
    return {
      resource: 'timeline',
      cause: 'restarted',
      tool: 'timeline_start',
      ageMs: this.ageOf(replaced.at),
    }
  }

  private document(documentId: string): DocumentLedger {
    let document = this.documents.get(documentId)
    if (!document) {
      document = {
        lastSeen: new Map(),
        overrides: new Map(),
        simulations: new Map(),
        timelines: new Map(),
        replacedTimelines: new Map(),
      }
      this.documents.set(documentId, document)
    }
    return document
  }

  private interruptOthers(
    scope: WindowScope,
    caller: string,
    change: Omit<Interruption, 'at'>,
  ): number {
    let displaced = 0
    for (const [owner, claim] of this.windows.get(scope.tabKey) ?? []) {
      if (owner === caller || claim.interruption || claim.documentId !== scope.documentId) continue
      claim.interruption = { ...change, at: this.now() }
      displaced += 1
    }
    return displaced
  }

  /** Holders other than `caller` still active on the document; `entries` pair each holder with when it applied the state. */
  private holders(
    document: DocumentLedger,
    entries: ReadonlyArray<readonly [string, number]>,
    caller: string,
  ): Holders | null {
    const cutoff = this.now() - HOLD_IDLE_MS
    const active = new Map<string, number>()
    for (const [holder, appliedAt] of entries) {
      if (holder === caller) continue
      const lastSeen = Math.max(document.lastSeen.get(holder) ?? 0, appliedAt)
      if (lastSeen >= cutoff) active.set(holder, Math.max(active.get(holder) ?? 0, lastSeen))
    }
    if (active.size === 0) return null
    return { otherCallers: active.size, ageMs: this.ageOf(Math.max(...active.values())) }
  }

  private ageOf(at: number): number {
    return Math.max(0, Math.round(this.now() - at))
  }
}

function touch(entries: Map<string, number>, caller: string, at: number): void {
  entries.delete(caller)
  entries.set(caller, at)
  evictOldest(entries, MAX_CALLERS_PER_SCOPE)
}

function evictOldest<K, V>(entries: Map<K, V>, limit: number): void {
  while (entries.size > limit) {
    const oldest = entries.keys().next()
    if (oldest.done) return
    entries.delete(oldest.value)
  }
}
