import {
  devtoolsCaptureCreateContract,
  devtoolsInteractionBeginContract,
  devtoolsInteractionStopContract,
  type HubErrorCode,
  type OwnershipConflict,
  type OwnershipResource,
  type ToolDescriptor,
  type ToolErrorDetails,
} from '../protocol'
import type { Holders, OwnershipLedger, WindowScope } from './ownership-ledger'
import { tabKeyOf } from './session-routing'
import { numberField, recordOf, stringField } from './wire-guards'

export interface GuardedDocument {
  sessionId: string
  logicalSessionId?: string
  tools: ToolDescriptor[]
}

export interface ProbeResponse {
  ok: boolean
  result?: unknown
}

export interface OwnershipFailure {
  ok: false
  error: string
  errorCode: 'conflict'
  errorDetails: ToolErrorDetails
}

export interface OwnershipOutcome {
  failure?: OwnershipFailure
  displaced?: { resource: OwnershipResource; otherCallers: number }
}

const WINDOW_STARTS = new Set(['react_clear_renders', 'react_profile_start'])
const WINDOW_PAUSES = new Set(['react_profile_stop'])
/** Window-dependent reports whose results carry no observation ID to compare. */
const WINDOW_REPORTS = new Set([
  'react_profile_report',
  'react_renders_diff',
  'react_profile_snapshot',
])
const OVERRIDE_TOOLS = new Set([
  'react_override_props',
  'react_override_hook_state',
  'react_override_context',
  'react_toggle_suspense_fallback',
  'react_force_error_boundary',
])
/** Not marked read-only, but they only open or read labelled spans; they change no app state. */
const INSTRUMENTATION_TOOLS = new Set(['react_measure', 'react_renders_since'])

/** Applies {@link OwnershipLedger} rules around one call: refuses resets of state another caller holds, records what each call started or changed, and fails reads from a window another caller disturbed. */
export class OwnershipGuard<TDocument extends GuardedDocument = GuardedDocument> {
  constructor(
    private readonly ledger: OwnershipLedger,
    private readonly probe: (
      document: TDocument,
      tool: string,
      args: unknown,
    ) => Promise<ProbeResponse>,
  ) {}

  /** A conflict that must stop the call before it runs; null admits it. */
  async admit(
    document: TDocument,
    caller: string,
    tool: string,
    args: unknown,
  ): Promise<OwnershipFailure | null> {
    const input = recordOf(args) ?? {}
    const documentId = document.sessionId
    switch (tool) {
      case 'react_reset_overrides': {
        const holders = this.ledger.overrideHolders(documentId, caller)
        if (!holders) return null
        const listed = await this.probe(document, 'react_list_overrides', {})
        if (listed.ok && numberField(recordOf(listed.result), 'total') === 0) {
          this.ledger.overridesReset(documentId)
          return null
        }
        return heldFailure('overrides', tool, holders)
      }
      case 'query_restore_state':
      case 'query_simulate_state': {
        const selector =
          input.all === true
            ? undefined
            : { queryHash: stringField(input, 'queryHash') ?? undefined, queryKey: keyOf(input) }
        const holders = this.ledger.simulationHolders(documentId, caller, selector)
        return holders && heldFailure('query-simulation', tool, holders)
      }
      case 'timeline_start': {
        const holders = this.ledger.activeTimelineOfOther(documentId, caller)
        return holders && heldFailure('timeline', tool, holders)
      }
      case devtoolsCaptureCreateContract.name: {
        const conflict = this.ledger.windowConflict(scopeOf(document), caller, undefined)
        return conflict && supersededFailure(conflict)
      }
      default:
        return null
    }
  }

  /** Records the call and decides whether its result may be returned. */
  settle(
    document: GuardedDocument,
    caller: string,
    tool: string,
    args: unknown,
    response: { ok: boolean; result?: unknown },
  ): OwnershipOutcome {
    const documentId = document.sessionId
    const scope = scopeOf(document)
    const input = recordOf(args) ?? {}
    this.ledger.recordDocumentUse(documentId, caller)
    if (!response.ok) {
      const id = stringField(input, 'id')
      const conflict =
        (tool === 'timeline_read' || tool === 'timeline_stop') && id !== null
          ? this.ledger.timelineConflict(documentId, caller, id)
          : null
      return conflict ? { failure: supersededFailure(conflict) } : {}
    }
    const result = recordOf(response.result)
    if (WINDOW_STARTS.has(tool) || tool === devtoolsInteractionBeginContract.name) {
      const observationId =
        tool === devtoolsInteractionBeginContract.name
          ? stringField(result, 'observationId')
          : stringField(recordOf(result?.observation), 'id')
      return displacedBy(
        'render-window',
        this.ledger.windowStarted(scope, caller, observationId, tool),
      )
    }
    if (WINDOW_PAUSES.has(tool)) {
      return displacedBy(
        'render-window',
        this.ledger.windowInterrupted(scope, caller, 'paused', tool),
      )
    }
    if (tool === 'timeline_start') {
      const id = stringField(result, 'id')
      const maxDurationMs = numberField(result, 'maxDurationMs')
      if (id !== null && maxDurationMs !== null) {
        this.ledger.timelineStarted(documentId, caller, id, Date.now() + maxDurationMs)
      }
      return {}
    }
    if (tool === 'timeline_stop') {
      const id = stringField(input, 'id')
      if (id !== null) this.ledger.timelineStopped(documentId, id)
      return {}
    }
    this.recordAppliedState(documentId, caller, tool, input, result)
    if (changesAppState(document, tool)) {
      return displacedBy(
        'render-window',
        this.ledger.windowInterrupted(scope, caller, 'changed-state', tool),
      )
    }
    const observed =
      result && 'observation' in result
        ? (stringField(recordOf(result.observation), 'id') ?? null)
        : undefined
    if (
      observed === undefined &&
      !WINDOW_REPORTS.has(tool) &&
      tool !== devtoolsInteractionStopContract.name
    )
      return {}
    const conflict = this.ledger.windowConflict(scope, caller, observed)
    return conflict ? { failure: supersededFailure(conflict) } : {}
  }

  private recordAppliedState(
    documentId: string,
    caller: string,
    tool: string,
    input: Record<string, unknown>,
    result: Record<string, unknown> | null,
  ): void {
    if (OVERRIDE_TOOLS.has(tool)) this.ledger.overridesApplied(documentId, caller)
    else if (tool === 'react_reset_overrides') this.ledger.overridesReset(documentId)
    else if (tool === 'query_simulate_state') {
      const queryHash = stringField(result, 'queryHash')
      if (queryHash !== null)
        this.ledger.simulationApplied(documentId, caller, queryHash, keyOf(input))
    } else if (tool === 'query_restore_state') {
      const outcomes = Array.isArray(result?.outcomes) ? result.outcomes : []
      this.ledger.simulationsRestored(
        documentId,
        input.all === true
          ? 'all'
          : outcomes.flatMap((outcome) => stringField(recordOf(outcome), 'queryHash') ?? []),
      )
    }
  }
}

function scopeOf(document: GuardedDocument): WindowScope {
  return { tabKey: tabKeyOf(document), documentId: document.sessionId }
}

function changesAppState(document: GuardedDocument, tool: string): boolean {
  if (INSTRUMENTATION_TOOLS.has(tool)) return false
  const descriptor = document.tools.find((candidate) => candidate.name === tool)
  return descriptor !== undefined && descriptor.annotations?.readOnlyHint !== true
}

function keyOf(input: Record<string, unknown>): string | undefined {
  return Array.isArray(input.queryKey) ? JSON.stringify(input.queryKey) : undefined
}

function displacedBy(resource: OwnershipResource, otherCallers: number): OwnershipOutcome {
  return otherCallers > 0 ? { displaced: { resource, otherCallers } } : {}
}

const RESOURCE_LABELS: Record<OwnershipResource, string> = {
  'render-window': 'render window',
  timeline: 'timeline recording',
  overrides: 'React overrides',
  'query-simulation': 'Query simulation',
  tab: 'tab',
}

function heldFailure(
  resource: Extract<OwnershipResource, 'overrides' | 'query-simulation' | 'timeline'>,
  tool: string,
  holders: Holders,
): OwnershipFailure {
  const others =
    holders.otherCallers === 1 ? 'Another agent' : `${holders.otherCallers} other agents`
  const verb = resource === 'timeline' ? 'is recording' : 'applied'
  return failure(
    'STATE_HELD',
    `${others} ${verb} ${RESOURCE_LABELS[resource]} on this tab (last active ${holders.ageMs}ms ago), so "${tool}" was not run: it would end what they set up. Use your own tab (open the app with ?_genie=<your-name> and pass --session), or wait until they finish; their hold lapses after 5 minutes without a call.`,
    { resource, cause: 'held', tool, ageMs: holders.ageMs, otherCallers: holders.otherCallers },
  )
}

function supersededFailure(conflict: OwnershipConflict): OwnershipFailure {
  const label = RESOURCE_LABELS[conflict.resource]
  const ago = `${conflict.ageMs ?? 0}ms ago, after you started your ${label}`
  const who =
    conflict.cause === 'reloaded'
      ? `The tab loaded a new document (reload or navigation) after you started your ${label}, and a new document starts with empty evidence`
      : conflict.tool === undefined
        ? `The ${label} you started was replaced outside this hub's view (for example by app code)`
        : conflict.cause === 'paused'
          ? `Another agent paused profiling on this tab ${ago}`
          : conflict.cause === 'changed-state'
            ? `Another agent ran the state-changing tool "${conflict.tool}" on this tab ${ago}`
            : `Another agent started a new ${label} on this tab ${ago}`
  return failure(
    'OBSERVATION_SUPERSEDED',
    `${who}, so this evidence would not be yours. Start a new ${label} and repeat the interaction; use your own tab (?_genie=<your-name> with --session) so other agents cannot disturb it.`,
    conflict,
  )
}

function failure(
  hubCode: Extract<HubErrorCode, 'STATE_HELD' | 'OBSERVATION_SUPERSEDED'>,
  error: string,
  ownership: OwnershipConflict,
): OwnershipFailure {
  return { ok: false, error, errorCode: 'conflict', errorDetails: { hubCode, ownership } }
}
