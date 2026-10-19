/** Structured failure an app tool handler can throw; `code`, `detail`, and `hint` reach the agent as structured error details, and fold into `message` for logs. */
export class GenieToolError extends Error {
  readonly code: string | undefined
  readonly hint: string | undefined
  /** The message as thrown, without the folded code and hint. */
  readonly detail: string

  constructor(message: string, options: { code?: string; hint?: string } = {}) {
    const prefix = options.code ? `[${options.code}] ` : ''
    const suffix = options.hint ? ` — hint: ${options.hint}` : ''
    super(`${prefix}${message}${suffix}`)
    this.name = 'GenieToolError'
    this.code = options.code
    this.hint = options.hint
    this.detail = message
  }
}
