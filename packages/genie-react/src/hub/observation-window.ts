import type { AgentErrorCode, ToolDescriptor, ToolErrorDetails } from '../protocol'
import type { RetainedTool } from './verify/evidence'
import { numberField, recordOf, stringField } from './wire-guards'

/** The shared seam both window owners use to reach the app document. */
export interface ObservationSession {
  sessionId: string
  tools: ToolDescriptor[]
}

export interface ObservationRequestResult {
  ok: boolean
  result?: unknown
  error?: string
  errorCode?: AgentErrorCode
  errorDetails?: ToolErrorDetails
  retryInMs?: number
}

export type ObservationRequest<TSession> = (
  session: TSession,
  tool: string,
  args: unknown,
) => Promise<ObservationRequestResult>

export interface ObservationStartArgs {
  components: string[]
  roots: number[]
  budget: unknown
  lifecycle: unknown
}

export type ObservationStart =
  | {
      ok: true
      observationId: string | null
      startDocumentCommitId: number | null
      observationConfig?: unknown
      result: unknown
    }
  | ({ ok: false } & ObservationRequestResult)

export function hasTool(session: ObservationSession, tool: string): boolean {
  return session.tools.some((descriptor) => descriptor.name === tool)
}

/** Starts one observation window with `react_clear_renders`, reserving analysis for the named components. */
export async function startObservationWindow<TSession extends ObservationSession>(
  request: ObservationRequest<TSession>,
  session: TSession,
  args: ObservationStartArgs,
): Promise<ObservationStart> {
  const response = await request(session, 'react_clear_renders', args)
  if (!response.ok) return { ...response, ok: false }
  const result = recordOf(response.result)
  const observation = result ? recordOf(result.observation) : null
  return {
    ok: true,
    observationId: stringField(observation, 'id'),
    startDocumentCommitId: numberField(result, 'documentCommitId'),
    ...(result && 'observationConfig' in result
      ? { observationConfig: result.observationConfig }
      : {}),
    result: response.result,
  }
}

/** Calls one evidence tool and retains its bounded result, or records why it is missing. */
export async function captureToolEvidence<TSession extends ObservationSession>(
  request: ObservationRequest<TSession>,
  session: TSession,
  tool: string,
  args: unknown,
): Promise<RetainedTool> {
  const started = Date.now()
  const capturedAt = new Date().toISOString()
  if (!hasTool(session, tool)) {
    return {
      status: 'unavailable',
      tool,
      args,
      capturedAt,
      durationMs: 0,
      error: `Tool ${tool} is not advertised by this app session.`,
    }
  }
  const response = await request(session, tool, args)
  return {
    status: response.ok ? 'ok' : 'error',
    tool,
    args,
    capturedAt,
    durationMs: Date.now() - started,
    ...(response.ok
      ? { result: structuredClone(response.result) }
      : { error: response.error ?? `${tool} failed.` }),
  }
}
