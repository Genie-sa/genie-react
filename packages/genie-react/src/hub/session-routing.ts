import type { AgentErrorCode, AnsweringSession, ToolErrorDetails } from '../protocol'

export interface RoutableDocument {
  sessionId: string
  logicalSessionId?: string
  sessionName?: string
}

export interface SessionUnavailable {
  error: string
  errorCode: Extract<AgentErrorCode, 'not-connected' | 'unknown-session'>
  errorDetails?: ToolErrorDetails
  retryInMs?: number
}

export type SessionResolution<TSession> =
  | { ok: true; session: TSession; retargeted?: boolean }
  | ({ ok: false } & SessionUnavailable)

/** One browser tab: documents sharing a logical id, or a legacy document that never announced one. */
export function tabKeyOf(document: RoutableDocument): string {
  return document.logicalSessionId ?? document.sessionId
}

export function answeringSessionOf(document: RoutableDocument): AnsweringSession {
  return {
    sessionId: document.sessionId,
    ...(document.logicalSessionId === undefined
      ? {}
      : { logicalSessionId: document.logicalSessionId }),
    ...(document.sessionName === undefined ? {} : { sessionName: document.sessionName }),
  }
}

export function tabLabel(document: RoutableDocument & { app: { url?: string } }): string {
  const id = tabKeyOf(document)
  const target = document.sessionName ? `${document.sessionName} [${id}]` : id
  return document.app.url ? `${target} at ${document.app.url}` : target
}
